---
layout: post
title:  "Governing AI Capacity as Code: Security Copilot and Azure OpenAI"
description: "Standing AI capacity is both a budget leak and an attack surface. Here's how I deploy Microsoft Security Copilot and Azure OpenAI as Bicep — with a provision-one-then-zero pattern that drops standing cost to zero, OIDC instead of stored secrets, and data residency enforced in code."
categories: security devsecops azure security-copilot openai bicep finops
linkedin_promote: true
linkedin_promote_date: 2026-07-15
---

# Governing AI Capacity as Code: Security Copilot and Azure OpenAI

There's a category of cloud resource that's dangerous precisely because it's *useful*: AI capacity. Microsoft Security Copilot bills by the Security Compute Unit (SCU) at roughly $4/hour, each, whether you're running prompts or not. An Azure OpenAI deployment sits there with an endpoint and a key, ready to serve tokens — and ready to serve them to anyone who finds the key. Both are easy to spin up in the portal and easy to forget about. A forgotten SCU is a budget leak. A forgotten OpenAI endpoint with a key in a YAML file is a breach waiting to happen.

I run an AI agent team ("Squad") across my whole demo estate, and it needs both: Security Copilot for SecOps reasoning, an Azure OpenAI model to back the watcher process. So I had to solve the standing-cost and the secret-sprawl problems for real. The answer, in two Spava-Corp repos, is to treat AI capacity the same way I treat everything else — as code, in Bicep, behind OIDC, with the governance decisions visible in PR diffs instead of buried in portal blades.

**A scope note before the technique — this is a lab pattern.** If you're a Microsoft 365 **E5 or E7** customer, Security Copilot is *included* with your license: your tenant gets standing provisioned capacity once the inclusion is rolled out, and you generally shouldn't be hand-provisioning SCUs at all. See [Get started with Microsoft Security Copilot](https://learn.microsoft.com/en-us/copilot/security/get-started-security-copilot) and [the Security Copilot inclusion for E5/E7 tenants](https://learn.microsoft.com/en-us/copilot/security/security-copilot-inclusion); for the capacity models themselves, see [Understand Security Compute Units and capacity](https://learn.microsoft.com/en-us/copilot/security/security-compute-units-capacity). The provision-one-then-zero dance below is for the *other* case: a dev/test lab, a Visual Studio subscription sandbox, or any low-cost environment where you're paying for SCUs directly and want the standing bill at zero between experiments. Read it as a cost-control trick for labs and very-low-budget test estates — not a recommended posture for a licensed production tenant that already has capacity entitled.

## Provision One, Then Zero

Security Copilot's ARM API has an annoying constraint: `numberOfUnits` has a `@minValue(1)`. You cannot deploy a capacity resource with zero SCUs — the platform requires at least one at creation time. But one SCU running 24/7 is ~$4/hour, ~$2,900/month, for capacity you're using maybe an hour a day. That's the standing-cost trap.

The `alz-security-copilot` repo solves it with a two-step pattern: deploy at the minimum, then immediately PATCH to zero. The Bicep deploys the capacity with `overageBillingEnabled: true`, so pay-as-you-go burst is available when you actually run a prompt:

```bicep
resource resCapacity 'Microsoft.SecurityCopilot/capacities@2024-11-01-preview' = {
  name: parCapacityName
  location: parLocation
  properties: {
    numberOfUnits: parNumberOfUnits      // @minValue(1) — ARM demands >= 1 at deploy
    crossGeoCompute: parCrossGeoCompute  // 'NotAllowed' — data stays in US geo
    geo: parGeo
  }
}
```

Then a post-deploy PowerShell step, run from the CD workflow, PATCHes the capacity down to zero:

```powershell
# Set-ScuToZero.ps1 — eliminates the ~$4/hr standing cost
$body = @{ properties = @{ numberOfUnits = 0 } } | ConvertTo-Json -Depth 5
$patchResponse = Invoke-AzRestMethod -Uri $uri -Method PATCH -Payload $body

switch ($patchResponse.StatusCode) {
    { $_ -in 200, 201, 202 } { Write-Host "SUCCESS: Capacity set to 0 SCUs." }
    default {
        Write-Warning "API rejected 0 SCUs — capacity left at $($currentProps.numberOfUnits) SCU(s)."
    }
}
```

It's idempotent — safe to re-run, no-ops if already at zero — and it fails *loud*: if the API rejects the patch, it warns rather than silently leaving you billing $4/hour. The net result is zero standing SCU cost, with PAYG overage covering the actual usage. And there's a security dimension beyond the dollars: an always-on AI capacity is an always-on surface. Zero standing capacity means there's nothing idling for an attacker to abuse between the times you're actually using it.

Notice `crossGeoCompute: 'NotAllowed'` and `geo: 'US'`. That's data residency enforced in Bicep, reviewable in a PR diff — not a compliance assertion in a Word doc that may or may not match reality. The code *is* the control.

## OIDC Over Stored Secrets, Everywhere

Both repos authenticate to Azure via GitHub Actions OIDC with `azure/login@v2` — Entra ID app registrations with federated credentials, no long-lived client secrets sitting in GitHub. This is the single highest-leverage security change you can make to a CI/CD pipeline, because a leaked OIDC trust relationship is scoped and revocable in a way that a leaked `AZURE_CREDENTIALS` JSON blob simply is not.

The `jospaid-helios-core-azureopenai` repo deploys an Azure OpenAI (GPT-4.1) resource that backs the Squad watcher:

```bicep
resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: accountName
  kind: 'OpenAI'
  sku: { name: skuName }    // S0
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false    // deliberate trade-off — see below
  }
}

resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: modelName    // 'gpt-4.1'
  sku: { name: 'Standard'; capacity: capacityK }   // 30K TPM
  properties: { model: { format: 'OpenAI'; name: modelName; version: modelVersion } }
}
```

Here's an honest trade-off I want to call out instead of hide. `disableLocalAuth: false` enables API-key access — which is a weaker posture than managed identity. It was a deliberate fix in a follow-up commit (`fix: enable local auth for API key access`) because the Node.js watcher's SDK flow needs a key; managed identity wasn't viable for that path. This is a *known, documented* trade-off visible in git history, not an oversight. The CD workflow even writes the retrieved key to the GitHub Actions step summary for the operator to copy into `.env` manually — rather than automating secret rotation into another system. One conscious manual step, deliberately not automated, because automating secret distribution everywhere is its own risk. Security is full of these choices; the point is to *make them visibly*, not pretend they don't exist.

## When AI Gets It Wrong (and CI Catches It)

The most instructive part of this story isn't the code AI got right — it's the code it got wrong, and how the pipeline caught it. Both repos were built with GitHub Copilot co-authoring every single commit. Two bugs are worth highlighting because they show the *real* shape of AI-assisted infrastructure work:

1. **`overageState` rejected by ARM.** The initial Security Copilot Bicep included an `overageState` property that the ARM API rejected with `ResourceCreationValidateFailed`. The CI/CD validation run caught it — not a human reading docs, not a portal error at 2am, but the pipeline. The follow-up commit removed it. This is the system working: AI scaffolds fast, CI validates against the real API, the next commit fixes it.

2. **`disableLocalAuth` defaulting wrong for the use case.** The OpenAI resource initially couldn't be reached by the watcher because local auth was disabled by default. A one-line follow-up commit fixed it. AI-assisted scaffolding surfaced a security-default-versus-use-case mismatch on first run, in the open, in git history — exactly where you want such a decision recorded.

The pattern across both: the human sets the *constraint* (zero standing cost, US data residency, OIDC not secrets), and AI navigates the implementation space, with CI/CD as the validation gate. The `overageState` bug is a perfect counter to the "AI just hallucinates working code" critique — it scaffolded a plausible-but-wrong property, and the system caught it, and the history shows the fix. That's not a failure of AI-assisted development; that's it working as designed.

Both repos also gate deployments behind a `production` GitHub Environment with approval — so even an autonomous pipeline can't push AI capacity changes to a billing-relevant resource without a human nod.

## What This Cost to Build (and Write)

- **Source build cost:** Neither repo tracks a `COST.md`, so labeled **estimate: $8–18** combined. `alz-security-copilot` (~$5–10) is three commits — the Bicep orchestrator, the capacity module, `Set-ScuToZero.ps1`, and the CI/CD workflows, including the `overageState` fix cycle. `jospaid-helios-core-azureopenai` (~$3–8) is two commits, the second being the one-line `disableLocalAuth` fix. Small repos, fast sessions.
- **A note on running cost:** the whole point of the SCU-to-zero pattern is that the *standing* run cost is approximately $0, with PAYG overage only when prompts actually execute. The OpenAI deployment is a Standard S0 at 30K TPM, billed per token consumed. Build cost and run cost are different bills; this series tracks both.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). The subscription and tenant IDs that appear in the repos' OIDC setup docs are redacted here.

## What to Steal

1. **Provision-one-then-zero for any minimum-one AI capacity *you're paying for directly*.** Deploy at the floor, PATCH to zero post-deploy, let PAYG overage cover real use. Zero standing cost, zero idle attack surface. (If you're E5/E7, your tenant already has Security Copilot capacity included — this trick is for labs and low-budget test estates, not entitled production tenants.)
2. **Make the cost-control step fail loud.** If the patch-to-zero is rejected, warn — don't silently leave $4/hour running.
3. **OIDC, not stored secrets, for every pipeline.** A federated trust is scoped and revocable; a leaked credential JSON is a gift to an attacker.
4. **Encode data residency in code.** `crossGeoCompute: NotAllowed` in Bicep is a real control. The same statement in a compliance doc is a hope.
5. **Document your security trade-offs in git, not around it.** `disableLocalAuth: false` with a commit message explaining why beats a silent default any day.
6. **Let CI catch the AI's mistakes.** The `overageState` rejection proves the value of validating AI-scaffolded IaC against the real API before it ships.

AI capacity is too useful to avoid and too expensive (and too exposed) to leave running idle. Treating it as code — provisioned to zero, authenticated by OIDC, with residency enforced in Bicep and trade-offs recorded in commits — turns "we should probably govern that" into "it's governed by default."

*Next: the argument that cost governance isn't a FinOps nicety — it's a security control, and every idle VM is an attack surface.*
