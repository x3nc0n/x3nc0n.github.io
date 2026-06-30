---
layout: post
title:  "Verifiable Identity and Passwordless Onboarding with Entra Verified ID"
description: "A full employee onboarding portal built on Entra Verified ID, FIDO2, and manager approval — plus the mid-build pivot from App Service to Container Apps when the landing zone had zero App Service quota."
categories: security devsecops entra verified-id fido2 passwordless identity
linkedin_promote: true
linkedin_promote_date: 2026-07-08
---

# Verifiable Identity and Passwordless Onboarding with Entra Verified ID

Day-one onboarding is one of the most under-secured moments in an organization's identity lifecycle. A new hire arrives, and somewhere in the next few hours a chain of loosely-connected manual steps decides what they can access for the rest of their tenure. HR confirms the start date. IT provisions an account. Someone enrolls MFA. Someone else grants group memberships. Each handoff is a social-engineering opportunity — "hi, I'm the new contractor, my manager said to give me access" — and each one is mostly undocumented.

I wanted to see how much of that I could collapse into a single, sequenced, auditable, *cryptographic* flow. The result is a full onboarding portal built around **Microsoft Entra Verified ID**, with the Node.js application in `entra-verifiedid-example` and the CI/CD automation in `entra-verifiedid-deploy`. It covers in-person identity proofing, manager approval, issuance of a W3C Verifiable Credential into Microsoft Authenticator, and FIDO2 passkey registration — so the employee is passwordless from their first hour.

## The Flow: Four Boundaries, One Sequence

The portal is a Node.js/Express app with four route groups, each handling one trust boundary:

```
New Employee / Guest (browser)
        │
        ▼
  Azure Container App (Node.js portal)
    ├── /onboarding   ─► IdentityPass proofing → manager approval → callback
    ├── /issuance     ─► Entra Verified ID issuance (id_token_hint attestation)
    ├── /verification ─► Verified ID presentation request
    └── /passkey      ─► FIDO2/WebAuthn registration
        │
        ├── Microsoft Graph (User.Read, UserAuthenticationMethod.ReadWrite.All)
        ├── Key Vault (secrets via managed-identity KV references)
        └── Application Insights
```

The sequence matters. Identity proofing happens *before* manager approval, which happens *before* credential issuance, which happens *before* access. Each step produces an artifact the next step depends on. You can't skip ahead, and the whole chain is logged.

## Bootstrapping as Numbered, Idempotent Scripts

Standing this up involves a lot of one-time Entra and Graph configuration that you absolutely do not want to do by hand in a portal — app registration, API permissions, admin consent, Verified ID authority registration, the credential contract, the FIDO2 policy. So it's all scripted as six numbered, idempotent PowerShell files orchestrated by a `bootstrap.ps1`:

```
scripts/01-configure-app-registration.ps1   # Graph SDK: app reg + perms + consent
scripts/02-configure-verified-id.ps1         # Graph beta: did:web authority + contract
scripts/03-configure-identitypass.ps1        # Webhook + Logic App approval flow
scripts/04-configure-fido2-policy.ps1        # FIDO2/passkey policy
scripts/05-deploy-infrastructure.ps1         # az deployment group create
scripts/06-seed-demo-data.ps1                # demo employee/guest data
```

The app registration script requests exactly the permissions the portal needs — and no more. The interesting pairing is Graph's `UserAuthenticationMethod.ReadWrite.All` (so the portal can register a FIDO2 key and a Temporary Access Pass on the user's behalf during provisioning) alongside the Verifiable Credentials Service permissions for issuing and presenting credentials:

```powershell
$GRAPH_PERMISSIONS = @(
    @{ Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"; Type = "Scope" }  # User.Read
    @{ Id = "50483e42-d915-4231-9639-7fdb7fd190e5"; Type = "Role"  }  # UserAuthenticationMethod.ReadWrite.All
)
# Verifiable Credentials Service Request (well-known AppId 3db474b9-...)
$VCS_PERMISSIONS = @(
    @{ Id = "b1949c8b-6e1e-4a6c-a8b8-f8ed1a4f3ac3"; Type = "Role" }  # VerifiableCredential.Create.IssueRequest
    @{ Id = "680c2f48-4d1c-4e89-9bea-cfce432ee60e"; Type = "Role" }  # VerifiableCredential.Create.PresentRequest
)
```

Every script checks for existing state before creating, so re-running `bootstrap.ps1` is safe:

```powershell
$existing = Get-MgApplication -Filter "displayName eq '$APP_DISPLAY_NAME'" | Select-Object -First 1
if ($existing) {
    Write-Warning "App registration already exists (AppId: $($existing.AppId))"
    $app = $existing
} else {
    $app = New-MgApplication @appParams
}
```

Admin consent — the step everyone forgets in the portal and then spends an afternoon debugging — is granted programmatically via `New-MgServicePrincipalAppRoleAssignment`. No clicking, no forgetting, no accidental over-permissioning.

## The Credential: Employer-Issued, Cryptographically Signed

The Verified ID setup registers a `did:web` authority and defines an `EmployeeOnboardingCredential` contract. The credential is branded for Microsoft Authenticator and carries the claims that matter for an employee identity:

```powershell
card = @{
    title    = "Employee Onboarding"
    issuedBy = "Your Organisation"
    backgroundColor = "#003087"
    textColor       = "#FFFFFF"
}
claims = @(
    @{ claim = "$.employeeId";  label = "Employee ID"; type = "String" }
    @{ claim = "$.email";       label = "Work Email";  type = "String" }
    @{ claim = "$.displayName"; label = "Full Name";   type = "String" }
    @{ claim = "$.department";  label = "Department";   type = "String" }
    @{ claim = "$.startDate";   label = "Start Date";   type = "String" }
)
```

The attestation model is `id_token_hint` — the backend passes verified claims directly, because this is an *employer-issued* credential, not a self-asserted one. Validity is 365 days; the employee renews annually. The payoff is that the employee no longer re-proves their identity at every internal system. They present a cryptographically-signed credential that the verifying system trusts because it trusts the issuing authority. That's the whole promise of verifiable credentials, made concrete.

## The Mid-Build Pivot: App Service → Container Apps

Here's the part I find most representative of how real infrastructure work actually goes — and where AI-assisted iteration earned its keep.

The original design targeted Azure App Service. At deployment time, the landing zone subscription (an Enterprise-Scale Landing Zone) returned a quota wall: **zero App Service quota**. Not "a little"; none. In the old world this is where you file a quota-increase ticket and lose two days, or you start manually rewriting Bicep.

Instead, the architecture pivoted to **Azure Container Apps** — a different resource provider (`Microsoft.App`) with separate quota, scale-to-zero, and consumption billing — in a single commit (`switch from App Service to Azure Container Apps`). The Bicep module decomposition (monitoring → storage → keyvault → container-app, in dependency order) made the swap surgical rather than catastrophic:

```bicep
module containerApp 'modules/container-app.bicep' = {
  name: 'containerApp'
  params: {
    verifiedIdAuthority: verifiedIdAuthority
    credentialManifestUrl: credentialManifestUrl
    credentialType: credentialType            // 'VerifiedEmployee'
    appInsightsConnectionString: monitoring.outputs.connectionString
    keyVaultUrl: keyVault.outputs.vaultUri    // KV references, not plaintext
  }
}
```

A follow-up two-commit sequence then chased down and fixed a Key Vault circular-dependency issue and switched the Container App secrets to **Key Vault references** resolved at runtime via managed identity — eliminating the last plaintext secret placeholders. The lesson isn't "AI is magic." It's that when your infrastructure is modular Bicep and you have a fast pair-programmer, an architecture constraint discovered at deploy time becomes an afternoon's pivot instead of a sprint's worth of rework.

## CI/CD: OIDC, Staging Slots, Approval Gates

The automation repo runs three workflows — `validate.yml` (Bicep what-if + lint on PR), `infra.yml` (infrastructure deploy), and `deploy.yml` (app build → staging → smoke test → production). Auth is OIDC throughout:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: azure/login@v2
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

A subtle but important distinction in this design: the CI/CD identity (the OIDC federated credential GitHub uses to deploy) is **completely separate** from the application identity (the app registration the portal uses to call the Verified ID API). The deploy pipeline can stand up infrastructure; it cannot impersonate the credential-issuing application. The app-deploy chain is gated by named GitHub Environments with required reviewers, so a human approves before production gets a new build.

## Security Outcomes, Concretely

- **Passwordless from hour one.** FIDO2/WebAuthn passkey registered during onboarding, not retrofitted months later after a phishing scare.
- **No secrets in CI/CD.** OIDC federated credentials; nothing stored.
- **No plaintext at runtime.** Container App secrets are Key Vault references via managed identity.
- **Single-tenant by design.** `SignInAudience: AzureADMyOrg` — corporate accounts only.
- **Documented authorization chain.** The manager-approval Logic App (a Teams adaptive card requiring explicit approval) creates an auditable record *before* any access is provisioned.
- **HMAC-validated webhooks.** The identity-proofing callbacks are verified with a shared secret before processing.

## What This Cost to Build (and Write)

This pair of repos actually tracks costs, so these are validated figures, not estimates:

- **Source build cost:** ~**$10–12** combined across both repos, built in essentially a single session. The portal repo's `COST.md` breaks it down: Opus-class coordinator ~$4.43, Sonnet-class agents ~$3.63, for the full Node.js portal, six bootstrap scripts, Bicep IaC, and CI/CD. The companion deploy repo adds ~$1.50–2.00 for its CI/CD and docs share. I validated the line items against the stated totals — they reconcile.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). The well-known Graph and Verifiable-Credentials permission GUIDs are public Microsoft identifiers, so the redaction pass here was light — mostly confirming no real tenant or employee data leaked from the demo seed script.

That's the headline that still surprises people: a complete, OIDC-deployed, FIDO2-enabled, Verified-ID onboarding portal for roughly the price of a sandwich in AI tokens. The infrastructure isn't free to *run*, but the cost to *build* it has collapsed.

## What to Steal

1. **Sequence your onboarding trust boundaries.** Proof identity → approve → issue → grant. Each step gates the next, each produces an artifact, the whole chain is logged.
2. **Script the Entra setup as numbered, idempotent files.** App registration, consent, authority, contract, FIDO2 policy — none of this should live in your memory of which portal buttons you clicked.
3. **Grant admin consent in code.** `New-MgServicePrincipalAppRoleAssignment` removes the single most-forgotten manual step in app provisioning.
4. **Keep modules dependency-ordered so pivots stay surgical.** When the landing zone says "zero App Service quota," a clean Bicep decomposition turns a rewrite into a one-module swap.
5. **Separate the deploy identity from the app identity.** The pipeline that builds your infrastructure should not be able to act as your credential-issuing application.
6. **Make passkeys part of onboarding, not an afterthought.** The cheapest time to go passwordless is before the user ever sets a password.

Verifiable credentials have been "the future of identity" for a few years now. Building one end-to-end made it concrete for me: the technology is ready, the Azure primitives are there, and with AI handling the configuration scaffolding, the build cost is no longer the obstacle. The obstacle is deciding to sequence your trust boundaries deliberately — and that's a design decision, not a budget one.

*Next: the zero-trust edge — Azure Front Door to APIM to a private AKS cluster with no public IP, and why the Developer-SKU APIM constraint forces a clever header-validation pattern instead of internal VNet mode.*
