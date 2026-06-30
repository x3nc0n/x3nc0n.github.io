---
permalink: /2026/07/02/Detection-as-Code-Sentinel-Then-and-Now.html
layout: post
title:  "Detection-as-Code: Sentinel CI/CD, Then and Now"
description: "In 2021 I wrote Sentinel detections by typing KQL into a browser and hitting save. In 2026 every rule is Bicep, syntax-validated in CI, and deployed over OIDC. Here's the contrast — and what AI changed."
categories: security devsecops azure sentinel detection-as-code kql
linkedin_promote: true
linkedin_promote_date: 2026-07-02
---

# Detection-as-Code: Sentinel CI/CD, Then and Now

I have a confession that will be familiar to anyone who built Microsoft Sentinel content before about 2023: my detection rules used to live in a browser tab. I'd write KQL directly in the Sentinel analytics-rule wizard, tune the threshold by eyeballing a few weeks of data, hit **Save**, and move on. No pull request. No syntax validation. No second pair of eyes. If someone deleted the rule, the only record it ever existed was Sentinel's own activity log.

I know this because I wrote about it at the time. Back in 2021 I published a few posts on [CI/CD for ASIM functions](https://www.spaid.dev/) and [writing Sentinel abnormality detections](https://www.spaid.dev/) — and reading them back now is a useful time capsule. They were *good* posts for 2021. They were also a snapshot of an era where "detection-as-code" meant "I connected a GitHub repo to the Sentinel Repositories blade and let it generate a workflow for me."

This post is the before-and-after. Same practitioner, same product, five years apart — and a completely different engineering posture, much of it enabled by AI agents authoring the content.

## The "Then": Artisanal KQL, 2021

Here's roughly what my 2021 workflow looked like, reconstructed from those old posts:

1. **Author KQL in the portal.** Start with a static threshold — `let threshold = 100;` — then, if I was feeling rigorous, upgrade to a dynamic per-host average plus standard deviation using ASIM functions like `imFileEvent` and `bin(TimeGenerated, 1h)` bucketing.
2. **Deploy by hand.** Save the rule in the Sentinel GUI. That *was* the deployment.
3. **For parsers, use the Repositories blade.** Sentinel had a preview feature that connected a GitHub repo and auto-generated a GitHub Actions workflow. You forked a repo, pointed it at your `/Parsers` directory, and it deployed on push.
4. **Authenticate with a stored secret.** The auto-generated workflow used `creds: ${{ secrets.AZURE_SENTINEL_CREDENTIALS_<guid> }}` — a full service principal JSON blob sitting in repo secrets.

One of those 2021 posts literally has an `UPDATE` banner at the top saying *"ASIM is now built-in to Sentinel, so don't do this."* The approach was obsolete almost as fast as I documented it. That's not a criticism of past-me; it's the nature of a fast-moving platform. But it tells you something: in 2021, detection engineering was reactive, manual, and brittle. A new CVE dropped (CVE-2021-42306, say) and I'd write a one-off rule in response, with no MITRE tagging, no entity mappings, and no CI/CD.

## The "Now": `alz-sentinel`, 2026

Fast-forward to my demo org's current Sentinel repo, `alz-sentinel`. Same goal — get detections into Sentinel — but the entire pipeline is rebuilt around the principles I'd apply to any production code.

The repo is organized by content type, matching Sentinel's own content taxonomy:

```
alz-sentinel/
├── .github/
│   ├── scripts/
│   │   ├── sentinel-content.sh      # Auto-discovering deploy helper
│   │   ├── KqlSyntaxValidator.cs    # Custom C# KQL checker (built at CI time)
│   │   └── enable-phase1-ueba.ps1   # UEBA prerequisites
│   └── workflows/
│       ├── sentinel-validate.yml    # PR → ARM validate + KQL syntax check
│       └── sentinel-deploy.yml      # push to main → deploy 9 categories
├── AnalyticsRules/      # ARM JSON scheduled rules
├── ContentHub/          # Bicep content-suite bundles
├── HuntingQueries/
├── DataConnectors/
├── Playbooks/  Watchlists/  Workbooks/  AutomationRules/  Parsers/
└── DEPLOYMENT_PLAN.md
```

Three things in here didn't exist in my 2021 world, and all three matter.

### 1. A custom KQL syntax validator that runs in CI

There's no off-the-shelf GitHub Action that tells you whether your KQL actually parses before you deploy it. So `alz-sentinel` ships its own — a small C# console app, `KqlSyntaxValidator.cs`, built **ephemerally at CI time** against the `Microsoft.Azure.Kusto.Language` SDK (the same language services that power Kusto tooling):

```yaml
- name: Build KQL validation tool
  run: |
    validator_dir="$RUNNER_TEMP/kql-validator"
    dotnet new console --framework net8.0 --output "$validator_dir"
    cp .github/scripts/KqlSyntaxValidator.cs "$validator_dir/Program.cs"
    dotnet add "$project_file" package Microsoft.Azure.Kusto.Language
    dotnet build "$project_file" --configuration Release

- name: Validate HuntingQueries and Parsers KQL
  run: |
    mapfile -t files < <(find HuntingQueries Parsers -type f \
      \( -iname '*.json' -o -iname '*.kql' -o -iname '*.csl' \) | sort)
    dotnet run --project "${{ steps.build-validator.outputs.project_file }}" -- "${files[@]}"
```

No binary is checked into the repo — only the source. The validator gets compiled fresh on every run. A KQL typo now fails the PR check instead of silently failing at 2:00 AM when the rule was supposed to fire.

### 2. Detections as Bicep content suites

The headline pattern in the modern repo is **one Bicep file = one content suite**. The `ContentHub/entra-id.bicep` file deploys an entire Phase 1 identity detection package — two scheduled analytics rules, two hunting queries, two playbooks, a workbook, and an incident-creation rule — all idempotently, with MITRE ATT&CK tags and entity mappings declared inline.

Here's the core of the "privileged user signs in from a new country" rule. Note the 14-day dynamic baseline — this is the grown-up version of my 2021 `let threshold = 100;`:

```kql
let baselineWindow = 14d;
let detectionWindow = 1d;
let privilegedUsers = IdentityInfo
  | where TimeGenerated >= ago(baselineWindow)
  | summarize arg_max(TimeGenerated, *) by AccountUPN
  | where AssignedRoles has_any (
      'Global Administrator', 'Privileged Role Administrator',
      'Security Administrator', 'Conditional Access Administrator')
  | project UserPrincipalName = AccountUPN;
let baselineCountries = SigninLogs
  | where TimeGenerated between (ago(baselineWindow) .. ago(detectionWindow))
  | where ResultType == 0
  | summarize by UserPrincipalName, Location;
SigninLogs
  | where TimeGenerated >= ago(detectionWindow)
  | where ResultType == 0
  | join kind=inner privilegedUsers on UserPrincipalName
  | join kind=leftanti baselineCountries on UserPrincipalName, Location
  | project TimeGenerated, UserPrincipalName, Location, IPAddress, AppDisplayName
```

The suite also includes an **MFA-fatigue** hunt — three or more MFA denials followed by a success within 30 minutes, the signature of the push-bombing attacks that hit Lapsus$ and MGM targets — and a **token-reuse** hunt looking for the same session token across three-plus IPs and two-plus countries, the fingerprint of an adversary-in-the-middle phish. These aren't reactive CVE responses. They're a *coverage plan* (Phase 1 = identity + UEBA), with later phases sketched in `DEPLOYMENT_PLAN.md`.

### 3. OIDC and a PR gate, everywhere

The deploy workflow authenticates with federated identity — no stored credentials:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: azure/login@v2
    with:
      client-id: ${{ vars.AZURE_CLIENT_ID }}
      tenant-id: ${{ vars.AZURE_TENANT_ID }}
      subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

Compare that to the 2021 `secrets.AZURE_SENTINEL_CREDENTIALS_<guid>` JSON blob. The blast radius of a leaked OIDC config is "nothing persists"; the blast radius of a leaked SP JSON is "someone has standing access to my Sentinel workspace until I notice."

And critically: **every detection change is now a pull request.** Bad KQL can't reach production without passing the syntax validator and getting reviewed. In 2021, "code review for a detection rule" wasn't even a concept I had.

## Then vs Now, on One Page

| Dimension | 2021 (artisanal) | 2026 (`alz-sentinel`) |
|---|---|---|
| Auth | Stored SP JSON secret | OIDC federated identity |
| Deploy trigger | GUI **Save** button | PR validate + push deploy |
| KQL validation | None | Custom C# validator (Kusto SDK) |
| Source of truth | KQL in the portal | ARM JSON + Bicep in git |
| MITRE tagging | None | `tactics` + `techniques` per rule |
| Entity mappings | Manual, inconsistent | Declared in Bicep |
| Thresholds | Static (`= 100`) | 14-day dynamic baseline |
| Triage guidance | In my head | Embedded as Bicep tags / playbooks |
| Coverage model | One-off CVE responses | Phased plan (identity → UEBA → …) |

## The AI Angle: Where the Agents Earned Their Keep

The entire Phase 1 Entra ID + UEBA content hub — the Bicep, the KQL, the MITRE annotations, the playbook triage HTML — was authored in a **single session** by a Squad of AI agents (Dillon, Dutch, Hawkins, and Mac, if you're curious about the cast) and committed as `Phase 1 Content Hub deployment: Entra ID + UEBA`.

Be clear about what that does and doesn't mean. It does **not** mean "AI invented novel detections." The privileged-user-new-country pattern, MFA-fatigue detection, token-reuse hunting — these are established techniques. What AI did was collapse the distance between "I know I want a 14-day baseline new-country detection with proper entity mappings and a leftanti join" and "here is syntactically valid, MITRE-tagged, idempotent Bicep that deploys it." The custom `KqlSyntaxValidator.cs` is a nice example: writing a Kusto-SDK console app from scratch is a 30–45 minute yak-shave; describing what I wanted and reviewing the result took a fraction of that.

The judgment stayed with me. *Which* roles count as privileged? Is a 14-day baseline right, or does it need to be 30 for a low-traffic tenant? Should the MFA-fatigue threshold be three denials or five? Those are security calls, and I made every one of them. The agents generated; I decided.

## What This Cost to Build (and Write)

Keeping with the transparency standard for this series:

- **Source build cost (`alz-sentinel`):** This repo doesn't track a `COST.md`, so this is a labeled **estimate**: roughly **$20–40** in AI agent tokens. A four-agent Squad delivered the Phase 1 Entra ID + UEBA content hub — a KQL validator, a bash deploy helper, a 9-category deploy pipeline, and three Bicep content files — in essentially one focused session. Medium-large scope, single session.
- **This post's production:** ~**$1.00** — research brief (~$0.40), drafting (~$0.30), and editorial/redaction review (~$0.30), at roughly Sonnet-class rates. The "then vs now" framing required cross-referencing my 2021 posts against the 2026 repo, which is the bulk of the research line.

I track these because if I'm going to claim AI accelerates security engineering, I should be willing to show the bill. (And no — I don't count the cost of writing the cost section. That way lies madness.)

## What to Steal

1. **Put a syntax gate on your KQL.** You don't need a managed service. A tiny Kusto-SDK console app built at CI time will catch the typos that otherwise fail silently in production.
2. **Treat one content suite as one deployable unit.** A Bicep file that bundles the rules, hunts, playbooks, and workbook for a coverage area is far easier to review and reason about than 30 loose ARM files.
3. **Kill the stored SP secret.** OIDC works for Sentinel deploys exactly like it does for everything else. If your detection pipeline still has an `AZURE_*_CREDENTIALS` JSON blob, that's your next PR.
4. **Plan coverage in phases, not in reaction to headlines.** "Phase 1 = identity + UEBA" is a posture. "Write a rule when a CVE trends" is a treadmill.
5. **Let AI draft, but own the thresholds.** The baseline windows, the privileged-role list, the alert-grouping logic — those are your security decisions. Make the agent show its work and review every one.

The 2021 version of me shipped detections that worked. The 2026 version ships detections that are reviewed, validated, tagged, version-controlled, and reproducible — and does it faster. That's the whole pitch of this series in one repo.

*Next up: turning Microsoft Purview sensitivity labels and DLP into a GitOps control plane — including an honest note about where OIDC still can't reach.*
