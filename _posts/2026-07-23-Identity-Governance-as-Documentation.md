---
layout: post
title:  "Identity Governance as Documentation"
description: "A Conditional Access policy scoped to a raw GUID is invisible to governance. A private DNS forwarder you forgot to add silently routes 'private' traffic over the public internet. Two PowerShell tools turn opaque identity and network config into living, auditable documentation — and they're exactly what AI now runs on a schedule."
categories: security devsecops identity conditional-access dns powershell governance
linkedin_promote: false
published: false
---

<!-- DRAFT — held out of the series. Built on older, pre-AI repos (ConditionalAccessDocumentation fork + AddAzPrivateDnsConditionalForwarders-pwsh); doesn't fit the AI-accelerated DevSecOps narrative. Keep as a draft; revisit only if reframed around AI-driven scheduling/automation of these tools. -->

# Identity Governance as Documentation

There's a failure mode that every Entra ID tenant eventually hits, and it's quiet. Conditional Access policies accumulate over years. Each one is a thicket of GUIDs — this policy excludes `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, that one targets `yyyyyyyy-...`. Group memberships rotate. Someone toggles a policy to report-only "temporarily" in 2024 and it's still report-only. Ask the obvious governance question — *"do we enforce phishing-resistant MFA for every admin role?"* — and the honest answer is a portal tour and a shrug. Zero visibility means zero governance.

The same thing happens at the network layer. Azure Private Link and private endpoints depend on DNS forwarding: your on-premises resolver has to forward `privatelink.blob.core.windows.net`, `privatelink.vaultcore.azure.net`, and dozens of other zones to Azure. Miss a zone and the failure isn't loud — the traffic just falls back to *public* DNS resolution, quietly routing around the private endpoint's entire reason for existing. You think you have network isolation. You have a split-brain where some workloads are private and some aren't, and nobody can tell which.

Two PowerShell tools in my estate exist to make these invisible things visible: `ConditionalAccessDocumentation` (a fork of Nicola Suter's excellent original — credit where it's due) and `AddAzPrivateDnsConditionalForwarders-pwsh`. Neither is AI-generated; both predate my AI-heavy period. That's exactly why they're worth writing about. They're the *foundation* — the good governance tooling that AI now schedules, runs, and feeds into a larger workflow.

## Turning Conditional Access Into a Spreadsheet a CISO Can Read

`Invoke-ConditionalAccessDocumentation` queries every Conditional Access policy in a tenant and resolves *every* GUID to a display name — users, groups, directory roles, applications, named locations — then exports a flat CSV (with optional Excel formatting). A policy that read "Exclude: `a1b2c3...`" becomes "Exclude: Finance-Admins, Legal-Reviewers." Suddenly it's auditable.

It connects with read-only Graph scopes — nothing here can change a policy:

```powershell
Connect-MgGraph -Scopes "Application.Read.All", "Group.Read.All", "Policy.Read.All",
    "RoleManagement.Read.Directory", "User.Read.All" -ContextScope Process
```

The clever engineering detail is a display-name cache. A tenant with dozens of policies references the same groups and apps over and over; naively resolving each one would hammer the Graph API. A simple hashtable cache collapses that to one lookup per object:

```powershell
if ($displayNameCache.ContainsKey($InputObject)) {
    return $displayNameCache[$InputObject]
} else {
    $directoryObject = Get-MgDirectoryObject -DirectoryObjectId $InputObject -ErrorAction Stop
    $displayName = $directoryObject.AdditionalProperties['displayName']
    $displayNameCache[$InputObject] = $displayName
    return $displayName
}
```

The export is 35+ columns per policy, and the security-relevant ones are exactly what you want for a review: resolved user/group/role includes and excludes, app conditions, named locations, **authentication strength** (critical for verifying phishing-resistant MFA enforcement), sign-in frequency and persistent-browser session controls, and the policy state — `Enabled` vs `Disabled` vs `EnabledForReportingButNotEnforced`. That last column is gold. It surfaces every policy that *should* be enforcing something but is quietly sitting in report-only mode. It's published to the PowerShell Gallery, so it's a one-liner to install:

```powershell
Install-Script -Name Invoke-ConditionalAccessDocumentation -Scope CurrentUser
```

Now the CISO's question — "do we have MFA enforced for all admin roles?" — gets answered with a spreadsheet filter, not a portal tour. That's the difference between governance and hope.

## Keeping Private Endpoints Actually Private

The DNS tool solves the split-brain problem in a single command. `Add-AzPrivateDnsConditionalForwarders` adds every Azure Private DNS zone for a given region as a conditional forwarder on a Windows DNS server, all pointing at Azure's platform resolver:

```powershell
Add-AzPrivateDnsConditionalForwarders -regionName "eastus2" -ReplicationScope Forest
```

Under the hood it iterates a list of 50+ zones — Key Vault (`privatelink.vaultcore.azure.net`), Cognitive Services / OpenAI (`privatelink.cognitiveservices.azure.com`), Blob storage, Container Registry, AKS, Log Analytics, and more — substituting region tokens where zones have region-specific subdomains, and pointing each at `168.63.129.16` (Azure's well-documented, non-routable platform DNS resolver):

```powershell
foreach ($zone in $dnsZones) {
    $zone = $zone -replace "{regionName}", $regionName
    $zone = $zone -replace "{regionCode}", $regionCode
    Add-DnsServerConditionalForwarderZone `
        -Name $zone `
        -MasterServers "168.63.129.16" `
        -ReplicationScope $ReplicationScope
}
```

Two design choices matter for security. It validates the region name against a known list and fails fast on an unknown region — better to warn than to create broken forwarders that half-work. And it defaults to `Forest` replication scope, so the forwarders propagate to *every* domain controller. That's what prevents the worst version of split-brain: some machines reaching private endpoints, others falling back to public resolution, depending on which DC answered. Forest-wide replication means private stays private, consistently, everywhere.

## The AI Angle: AI Accelerates What Already Works

Here's the honest framing, because these tools weren't built by AI. The AI story isn't *"Copilot wrote this."* It's *"good governance tooling becomes governance at scale when you put an AI workflow on top of it."*

Both of these are perfect inputs and post-deploy steps for an AI-assisted pipeline:

- **The CA export is an ideal input for a SecOps agent.** Run `Invoke-ConditionalAccessDocumentation` on a schedule, pipe the CSV into a [secops-squad](/2026/07/21/Squad-Standing-Up-an-AI-Agent-Team-for-the-SOC.html) skill, and ask: *"Diff this against last week's export — what changed? Any admin role that lost its MFA requirement? Any policy that slipped to report-only?"* The PowerShell produces the ground truth; the agent does the anomaly analysis a human never has time for. The repo already ships a `publish-powershellgallery.yml` workflow — it was CI/CD-aware before AI ever touched it, which is exactly why it slots so cleanly into an automated review loop.
- **The DNS forwarder function is a natural post-deploy step in a Copilot-generated IaC pipeline.** Deploy a new private endpoint with Bicep, then call `Add-AzPrivateDnsConditionalForwarders` to guarantee the forwarding exists. The thing that used to be a manual checklist item — the one everybody forgets — becomes an automated guarantee.

This is the pattern I keep coming back to across the series: AI doesn't replace the well-built tool. It runs it on a schedule, reads its output at a scale humans can't, and wires it into the broader governance loop. The PowerShell author from 2025 and the AI workflow from 2026 are collaborators, not competitors.

## What This Cost to Build (and Write)

- **Source build cost:** Labeled **estimate: $0–10.** These repos genuinely predate my Copilot-co-authored commit pattern — they're primarily fork maintenance and single-function scripts from the pre-AI-intensive era (last touched mid-2025). There's no meaningful AI build cost to claim here, and I'm not going to invent one. That honesty is part of the point: not everything in a mature estate is AI-built, and the foundational governance tools often aren't.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). No tenant IDs or real policy names appear; the original CA documentation tool is credited to Nicola Suter, and `168.63.129.16` is public Azure documentation.

## What to Steal

1. **Resolve every GUID to a display name before you review anything.** A policy scoped to a raw GUID is invisible to governance. Export it to a spreadsheet with names and your CA posture becomes auditable in minutes.
2. **Hunt for `EnabledForReportingButNotEnforced`.** The report-only policies that everyone forgot to enforce are your biggest silent gap. Make that column the first thing you filter.
3. **Automate complete private DNS forwarding.** A missing zone routes "private" traffic over public DNS. Use a tool that covers all 50+ zones, fails fast on bad input, and replicates forest-wide.
4. **Feed governance exports into an AI review loop.** The PowerShell produces ground truth; an agent diffs it week-over-week and flags anomalies. That's governance at a cadence humans can't sustain.
5. **Don't pretend everything is AI-built.** The foundational tools in a mature estate often predate AI. Crediting them honestly — and showing how AI amplifies them — is more useful than a fake origin story.

Identity and network governance fail quietly: a GUID nobody can read, a DNS zone nobody added. The fix is to make the configuration *documentation* — living, exportable, diffable — and then let AI read that documentation on a schedule you could never keep yourself.

*Next, and with appropriate caution: what AI-assisted vulnerability research actually looks like — including a responsibly disclosed BitLocker bypass — and where the AI helps versus where it doesn't.*
