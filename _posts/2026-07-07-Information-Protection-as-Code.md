---
layout: post
title:  "Information Protection as Code: Purview Labels in a Pull Request"
description: "Sensitivity labels and DLP are usually portal-click art — no versioning, no review, no drift detection. Here's how I turned the Purview control plane into a GitOps target, and where OIDC still can't follow."
categories: security devsecops purview information-protection dlp gitops
linkedin_promote: true
linkedin_promote_date: 2026-07-07
---

# Information Protection as Code: Purview Labels in a Pull Request

Most organizations treat Microsoft Purview sensitivity labels the way they treat the office thermostat: somebody changed it once, nobody's quite sure who, and everyone's afraid to touch it. Labels get created by clicking through the compliance portal. A rights-management template gets tweaked in a meeting. An auto-labeling policy goes from simulation to enforcement because someone felt confident on a Thursday. There's no version history, no peer review, no drift detection, and no way to answer the question "what was this label's encryption configuration three months ago?"

That's a problem, because a sensitivity label is a *security control*. A misconfigured label can silently leave regulated data unencrypted, or over-encrypt to the point where legitimate users route around it. When the control plane for your data protection is a series of undocumented portal clicks, you don't actually have data protection — you have data-protection cosplay.

So I rebuilt it as code. Across three repos — `purview-information-protection-as-code` (the enterprise flagship), `purview-ip-labels` (a simpler personal-tenant version), and `alz-purview-payg` (the Bicep that provisions the Purview account itself) — the entire Purview control plane became a GitOps target: JSON desired-state, idempotent PowerShell, CI/CD with dry runs on every PR, environment-gated deployment, and automated drift alerting.

## The Taxonomy Is the Architecture

The flagship repo declares its sensitivity labels in a single `labels.json` — a 12-label taxonomy with a clean inheritance hierarchy:

```
Public                                  (priority 10)
General                                 (priority 20)
Confidential                            (priority 30)
├── Confidential\PII                    (priority 40)
├── Confidential\Financial              (priority 50)
├── Confidential\Security Operations    (priority 60)
└── Confidential\Legal                  (priority 70)
Highly Confidential                     (priority 80)
├── Highly Confidential\Threat Intel    (priority 90)
├── Highly Confidential\Incident Data   (priority 100)
├── Highly Confidential\Credentials/Keys(priority 110)
└── Highly Confidential\Executive Comms (priority 120)
```

Each label carries its full security definition — including encryption and rights assignments — declaratively:

```json
{
  "name": "confidential-security-operations",
  "displayName": "Confidential\\Security Operations",
  "parentName": "confidential",
  "encryption": {
    "enabled": true,
    "templateName": "Confidential - Security Operations Restricted",
    "allowOfflineAccess": false,
    "rightsAssignments": [
      { "principal": "SecurityOperationsTeam",
        "rights": ["VIEW","EDIT","PRINT","COPY","EXPORT"] },
      { "principal": "IncidentResponseLeads",
        "rights": ["OWNER","EXPORT"] }
    ]
  },
  "scope": { "Exchange": true, "SharePoint": true, "OneDrive": true, "Teams": true }
}
```

This JSON *is* the source of truth. The `allowOfflineAccess: false` on security-ops content isn't a checkbox somebody might forget to tick — it's in the file, in git, reviewed in a PR. If you want to change who can export incident data, you open a pull request, and at least two reviewers have to agree.

## Idempotency Is the Whole Game

The deploy script's job is to make the live tenant match the JSON, whether the label already exists or not. That means every operation has to be idempotent — safe to run a hundred times. The pattern is a `Get` followed by a branch between create and update:

```powershell
function Ensure-Label {
  param([hashtable] $Def)
  $existing = Get-Label -Identity $Def.Name -ErrorAction SilentlyContinue
  if (-not $existing) {
    if ($PSCmdlet.ShouldProcess("New-Label $($Def.Name)", "Create")) {
      New-Label -Name $Def.Name -DisplayName $Def.DisplayName `
        -Tooltip $Def.Tooltip -Priority $Def.Priority | Out-Null
    }
  } else {
    if ($PSCmdlet.ShouldProcess("Set-Label $($Def.Name)", "Update")) {
      Set-Label -Identity $Def.Name -DisplayName $Def.DisplayName `
        -Tooltip $Def.Tooltip -Priority $Def.Priority | Out-Null
    }
  }
}
```

`SupportsShouldProcess` is what gives you `-WhatIf` for free, which is what lets the CI pipeline do a dry run on a PR without touching the tenant. The encryption logic tiers offline access by sensitivity — Highly Confidential gets zero days offline, Confidential-Internal gets 30, HC-Internal gets a 7-day window locked to the tenant domain:

```powershell
"Internal" {
  if ($Def.GroupHint -eq "Highly Confidential") {
    Set-Label -Identity $Def.Name -EncryptionEnabled $true `
      -EncryptionProtectionType Template `
      -EncryptionRightsDefinitions "$($TenantDomain):$coAuthorRights" `
      -EncryptionOfflineAccessDays 7
  } else {
    Set-Label -Identity $Def.Name -EncryptionEnabled $true `
      -EncryptionProtectionType Template `
      -EncryptionRightsDefinitions "AuthenticatedUsers:$coAuthorRights" `
      -EncryptionOfflineAccessDays 30
  }
}
```

## The Honest Part: OIDC Can't Reach Here

I've spent the last two posts evangelizing OIDC federated identity — no stored secrets, ever. I have to break that streak here, because the Purview/compliance control plane doesn't support it.

Sensitivity label and DLP management runs through `Connect-IPPSSession` (the Security & Compliance PowerShell endpoint), and that module does **not** support OIDC federated credentials in GitHub Actions. The supported non-interactive path is **certificate-based app authentication**:

```powershell
Connect-IPPSSession `
  -AppId $AppId `
  -Organization $Organization `
  -CertificateFilePath $CertificatePath `
  -CertificatePassword $CertificatePassword | Out-Null
```

So the pipeline stores a PFX certificate as a base64 GitHub secret, decodes it to the runner's temp directory, uses it, and deletes it in an `always()` cleanup step. It's not as clean as OIDC — there's a credential, and it has an expiry you have to rotate. But it's a *certificate*, not a password, and it never touches the source tree. When the platform doesn't give you the ideal control, you document the compromise and minimize the blast radius. Pretending the limitation doesn't exist is how you end up surprised.

## CI/CD: WhatIf on the PR, Approval on the Merge

The workflow is a three-act structure that should feel familiar from the rest of this series — validate, deploy, verify:

```yaml
jobs:
  validate:                       # PR → schema lint + WhatIf
    steps:
      - name: Validate labels.json schema
        shell: pwsh
        run: |
          $json = Get-Content '.\purview-config\labels\labels.json' -Raw
          if (-not (Test-Json -Json $json -Schema $schema)) {
            throw 'labels.json failed schema validation.'
          }
  deploy:
    needs: validate
    environment: production        # ← required reviewer approval gate
  verify:
    needs: deploy
    steps:
      - name: Verify deployed label state
        run: .\purview-config\scripts\verify-deployment.ps1 -Scope labels -Verbose
```

The enterprise repo carries five workflows in total — labels, DLP, auto-labeling, SQL classification, and a scheduled drift check. Two governance rules are worth calling out because they're judgment encoded as policy:

- **DLP starts in shadow mode.** New DLP policies deploy in `TestWithoutNotify` for a two-week baseline before enforcement flips on. You learn what the policy *would* have blocked before it actually blocks anything.
- **Drift detection runs daily.** A scheduled `verify-deployment.ps1` compares live tenant state to the repo and fires a Logic App alert to Teams within 24 hours if someone made a portal change behind the pipeline's back.

## Classification Doesn't Stop at Documents

The same governance posture extends to structured data. The SQL classification layer applies `ADD SENSITIVITY CLASSIFICATION` to Azure SQL columns idempotently — drop the existing classification, re-apply from the desired state:

```sql
IF EXISTS (
    SELECT 1 FROM sys.sensitivity_classifications
    WHERE major_id = @ObjectId AND minor_id = @ColumnId
)
BEGIN
    SET @Sql = N'DROP SENSITIVITY CLASSIFICATION FROM ' + @QualifiedTarget + N';';
    EXEC sys.sp_executesql @Sql;
END;
SET @Sql = N'ADD SENSITIVITY CLASSIFICATION TO ' + @QualifiedTarget
    + N' WITH (LABEL = ''' + @LabelName + N''', INFORMATION_TYPE = '''
    + @InformationType + N''');';
EXEC sys.sp_executesql @Sql;
```

The sample classifications map directly to the label taxonomy — `SocialSecurityNumber → Highly Confidential / PII`, `CreditCardNumber → Highly Confidential / Financial`, `PasswordHash → Highly Confidential / Credentials`. Now your database columns and your documents speak the same sensitivity language, declared in the same repo.

Underneath all of this, the Purview account itself is provisioned as Bicep in `alz-purview-payg`, deployed into the ALZ Management subscription with a system-assigned identity and `Microsoft.Purview/accounts@2021-12-01` (chosen over the older API version for managed Event Hub state and managed-resources network access). Even the governance platform is governed as code.

## The AI Angle

The full 12-label taxonomy with its encryption rights matrices, all five GitHub Actions workflows, the idempotent PowerShell patterns (`SupportsShouldProcess`, structured logging, exit-code conventions), and the SQL classification cursor loop with its in-transaction idempotency — all of it was AI-authored, traceable through `Co-authored-by: Copilot` commit trailers.

What's worth dwelling on is the *kind* of work this is. Purview-as-code is heavy on correct-but-tedious detail: rights-definition string formats, offline-access day counts per tier, the exact `Connect-IPPSSession` parameter set, the schema-validation idiom. This is precisely where AI shines — it has read the docs, it knows the idioms, and it produces a structurally-correct first draft fast. The decisions that needed me were the *policy* ones: which roles get EXPORT on incident data, whether security-ops content allows offline access at all (it doesn't), how long the DLP shadow-mode baseline should run. Those are risk decisions, and they don't delegate.

## What This Cost to Build (and Write)

- **Source build cost (three repos):** None of these track a `COST.md`, so this is a labeled **estimate**: roughly **$40–85** in AI agent tokens across all three. The bulk is the enterprise `purview-information-protection-as-code` repo (~$30–60) — a 12-label taxonomy, five workflows, idempotent PowerShell, Pester tests, Python schema validators, and a drift-alert Logic App. The personal `purview-ip-labels` (~$5–10) and the `alz-purview-payg` Bicep account (~$5–15) are lighter companions.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). The review line did real work here: this brief carried a real management-subscription ID that had to be scrubbed to `<management-subscription-id>` before anything got published.

## What to Steal

1. **Declare the security properties, not just the names.** A label JSON that doesn't include encryption and rights assignments is a label list, not a control definition. Put the whole thing in the file.
2. **Idempotency first, or nothing else works.** `Get` → branch on create-vs-update, plus `SupportsShouldProcess` for free `-WhatIf`. This is what makes safe re-runs and PR dry-runs possible.
3. **When OIDC isn't available, say so and minimize.** Certificate app-auth for IPPS, PFX as a base64 secret, decoded to temp, deleted in `always()`. Document the compromise instead of hiding it.
4. **Ship DLP in shadow mode first.** Two weeks of `TestWithoutNotify` tells you what you'd have blocked before you block it. This single habit prevents most "the DLP policy broke the business" incidents.
5. **Detect drift on a schedule.** If someone clicks in the portal, you want to know within a day — not at the next audit.
6. **Extend the taxonomy to your databases.** SQL sensitivity classification using the same labels closes the gap between "protected documents" and "wide-open data warehouse."

Sensitivity labels are a security control. The moment you start treating them like one — versioned, reviewed, tested, monitored for drift — you stop guessing about your data-protection posture and start being able to prove it. AI just made building that proof a weekend instead of a quarter.

*Next: verifiable credentials and passwordless onboarding with Entra Verified ID — including the mid-build pivot from App Service to Container Apps when the landing zone had exactly zero App Service quota.*
