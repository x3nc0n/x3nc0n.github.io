---
permalink: /2026/07/07/Information-Protection-as-Code.html
layout: post
title:  "Information Protection as Code: Automating Data Governance at Scale"
description: "Data governance dies in the gap between a taxonomy everyone agreed to in a meeting and the portal clicks nobody audits. Here's how treating labels and controls as code — declarative, reviewed, drift-checked — makes governance at scale actually tractable."
categories: security devsecops purview information-protection data-governance dlp
linkedin_promote: true
linkedin_promote_date: 2026-07-07
---

# Information Protection as Code: Automating Data Governance at Scale

Almost every data governance program I've seen fails at the same place. It isn't the strategy layer — leadership can usually agree that data should be classified and protected. It's the *implementation* layer. The taxonomy gets argued into existence over months of workshops, lands in a slide deck, and then goes to die as a set of undocumented clicks in the Microsoft Purview portal. Six months later nobody can tell you who created the "Confidential — Financial" label, why its encryption template grants EXPORT to a group that no longer exists, or what the configuration looked like before someone "fixed" it on a Thursday.

That gap — between the governance you *designed* and the governance you can actually *prove* — is where I want to spend this post. Because the thing that closes it isn't a bigger taxonomy or a stricter policy PDF. It's treating your labels and their controls the way you treat any other production system: as code.

## Why Data Governance Is Genuinely Hard

It's worth being honest that this is a hard problem, and not only for technical reasons.

The **organizational** problem is taxonomy agreement. Get five stakeholders in a room and you'll get five opinions on whether "internal" and "confidential" are the same thing, whether legal needs its own tier, and how many sublabels a human can reasonably be asked to choose between. Over-classify and people drown in choices and mislabel everything; under-classify and the labels stop meaning anything. Taxonomy design is a security control *and* a UX problem at the same time.

The **technical** problem is that the control plane is portal clicks. There's no version history, no peer review, no drift detection. You cannot answer "what was this label's encryption configuration three months ago?" because the only record the change ever happened is buried in an activity log nobody reads. And a sensitivity label is not cosmetic — it's a *security control*. A misconfigured label can silently leave regulated data unencrypted, or over-encrypt to the point where legitimate users route around it entirely. When the control plane for your data protection is a series of undocumented clicks, you don't have data protection. You have data-protection cosplay.

## The Taxonomy Problem: Less Is More

The first hard lesson I had to learn — and then re-learn after over-building — is that **a taxonomy nobody can remember is a taxonomy nobody uses.** My early attempt sprawled to a dozen labels and sublabels. It looked thorough. In practice, every extra label is a decision a human has to make at save-time, and decision fatigue is exactly how you get sensitive content tagged "General" because that was the fastest way to close the dialog.

A workable starting point is four tiers:

```
Public                 (priority 10)
General                (priority 20)
Confidential           (priority 30)
Highly Confidential    (priority 40)
```

Then add a sublabel *only where a real control actually differs.* "Confidential — Security Operations" earns its place if — and only if — it carries a control the parent doesn't, like zero offline access. If a sublabel's protection is identical to its parent, it's not a control, it's clutter. Keeping the taxonomy small is the single highest-leverage governance decision you'll make, and it's the one most programs get wrong by going big.

## Declare the Control, Not Just the Name

Once the taxonomy is small enough to defend, the labels go into source control as declarative desired-state. The important part is that each label carries its *full security definition* — encryption, rights assignments, scope — not just a display name:

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

That `allowOfflineAccess: false` isn't a checkbox somebody might forget to tick. It's in the file, in git, reviewed in a pull request. If you want to change who can export incident data, you open a PR and at least two people have to agree. The desired state is legible, diffable, and attributable — three things the portal will never give you.

## Idempotency Is the Whole Game

The deploy tooling's only job is to make the live tenant match the declared state — whether the label already exists or not. That means every operation has to be idempotent, safe to run a hundred times. The pattern is a `Get` followed by a branch between create and update:

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

`SupportsShouldProcess` is what gives you `-WhatIf` for free, which is what lets a CI pipeline do a dry run on a PR without touching the tenant. Idempotency plus a dry run is what makes the whole thing safe to automate — you can show a reviewer exactly what *would* change before anything does.

## The Honest Constraint: OIDC Can't Reach the Compliance Plane

Throughout this series I evangelize OIDC federated identity — no stored secrets, ever. I have to break that streak here, because the Purview/compliance control plane doesn't support it. Sensitivity-label and DLP management runs through `Connect-IPPSSession` (the Security & Compliance PowerShell endpoint), and that module does **not** support OIDC federated credentials in GitHub Actions. The supported non-interactive path is **certificate-based app authentication**:

```powershell
Connect-IPPSSession `
  -AppId $AppId `
  -Organization $Organization `
  -CertificateFilePath $CertificatePath `
  -CertificatePassword $CertificatePassword | Out-Null
```

So the pipeline stores a PFX as a base64 GitHub secret, decodes it to the runner's temp directory, uses it, and deletes it in an `always()` cleanup step. It's not as clean as OIDC — there's a credential, and it has an expiry you have to rotate — but it's a *certificate*, not a password, and it never touches the source tree. When the platform doesn't give you the ideal control, you document the compromise and minimize the blast radius. Pretending the limitation doesn't exist is how you get surprised.

## Controls Beyond the Label

A taxonomy on its own doesn't govern anything; the controls wired to it do. Two of those controls are where automation pays for itself, and both encode a piece of hard-won judgment:

- **DLP starts in shadow mode.** New DLP policies deploy in `TestWithoutNotify` for a two-week baseline before enforcement flips on. You learn what the policy *would* have blocked before it blocks anything real. This single habit prevents most "the DLP rule broke the business" incidents — and because it's in code, "shadow for two weeks, then enforce" is a reviewable rule, not a sticky note.
- **Auto-labeling so classification doesn't depend on memory.** If protecting data requires every user to correctly choose a label every time, you've already lost. Service-side auto-labeling rules — declared as code, reviewed like everything else — apply classification based on content, so the taxonomy works even when humans forget.

## Auditability Is the Point

Here's the part that actually enables governance at scale: **source control turns a policy you assert into a posture you can prove.**

- A scheduled drift check compares live tenant state to the repo daily and alerts if someone made a portal change behind the pipeline's back. Configuration drift becomes a notification, not a discovery you make during an audit.
- `git log` answers "what changed, who changed it, and when" for every control in your environment. The encryption config from three months ago isn't a mystery; it's a commit.
- Every change is a pull request, which means every change had a second set of eyes and a recorded reason. "We have a governance policy" is a PDF. "Every control change in our data-protection plane was reviewed, tested in dry-run, and is reproducible from git" is a posture — and it's the difference between hoping you're compliant and being able to demonstrate it.

## Governance Doesn't Stop at Documents

The same posture extends to structured data. SQL sensitivity classification applies the *same taxonomy* to Azure SQL columns idempotently — drop the existing classification, re-apply from desired state:

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

Map `SocialSecurityNumber → Highly Confidential / PII`, `CreditCardNumber → Highly Confidential / Financial`, and now your database columns and your documents speak the same sensitivity language, declared in the same repo. The taxonomy stops being a document-only concept and becomes a property of your data estate.

## The AI Angle: Automating the Hard, Tedious Part

Information-protection-as-code is heavy on correct-but-tedious detail: rights-definition string formats, offline-access day counts per tier, the exact `Connect-IPPSSession` parameter set, the JSON-schema validation idiom, the idempotent apply loop, the cert-decode-and-cleanup dance. This is precisely the work that makes data governance feel impossibly heavy for a small team — and precisely where AI earns its keep. It has read the docs, it knows the idioms, and it produces a structurally-correct first draft in minutes instead of days.

What AI did **not** do is make the governance decisions. Which roles get EXPORT on incident data? Does security-ops content allow offline access at all (it doesn't)? How long should the DLP shadow-mode baseline run? Is four tiers right, or does this org genuinely need a fifth? Those are risk decisions, and they don't delegate. The agents generated the mechanics; I owned the policy. That division of labor is the entire reason governance-at-scale becomes feasible for a small team — automate the tedium, concentrate human attention on the judgment.

## What This Cost to Build (and Write)

- **Source build cost (estimated):** The deploy-as-code implementation I built for my demo org's tenant doesn't track a `COST.md`, so this is a labeled **estimate: roughly $30–60** in AI agent tokens — a small label taxonomy, DLP and auto-labeling policies, the idempotent PowerShell apply tooling, JSON-schema validators and tests, a drift-alert, and the SQL classification layer. As always, that's AI **build** cost — the tokens to generate the IaC and tooling — **not** the Azure/licensing bill to *run* Purview, which is a separate number.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). The review line earned it here: the source material carried a real management-subscription ID that had to be scrubbed before anything was published. And per the rule I hold all series: I don't count the cost of writing this cost section. No recursion.

## What to Steal

1. **Start with four tiers.** Public, General, Confidential, Highly Confidential. Add a sublabel only where a real control differs. A small taxonomy people can remember beats a thorough one they route around.
2. **Declare the control, not just the name.** A label JSON without encryption and rights assignments is a label list, not a control definition. Put the whole thing in the file.
3. **Idempotency first, or nothing else works.** `Get` → branch on create-vs-update, plus `SupportsShouldProcess` for a free `-WhatIf`. Safe re-runs and PR dry-runs depend on it.
4. **When OIDC isn't available, say so and minimize.** Certificate app-auth for the compliance plane, PFX as a base64 secret, decoded to temp, deleted in `always()`. Document the compromise instead of hiding it.
5. **Ship DLP in shadow mode first.** Two weeks of `TestWithoutNotify` tells you what you'd have blocked before you block it.
6. **Detect drift on a schedule.** If someone clicks in the portal, you want to know within a day — not at the next audit.
7. **Extend the taxonomy to your databases.** SQL sensitivity classification using the same labels closes the gap between "protected documents" and "wide-open data warehouse."
8. **Let AI draft the mechanics; own the policy.** The rights matrices, offline-access tiers, and schema idioms are correct-but-tedious. The risk decisions are yours.

Data governance doesn't fail because the strategy was wrong. It fails in the gap between the taxonomy you agreed to and the controls nobody can audit. Close that gap by making the controls *code* — small, declarative, reviewed, tested, and monitored for drift — and governance stops being a quarterly fire drill and starts being a property of the system. AI just made building that proof a weekend instead of a quarter.

*Next: verifiable credentials and passwordless onboarding with Entra Verified ID — including the mid-build pivot from App Service to Container Apps when the landing zone had exactly zero App Service quota.*
