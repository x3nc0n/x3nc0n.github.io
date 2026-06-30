---
layout: post
title:  "Azure Landing Zones as Code: Governing the Cloud at Machine Speed"
description: "How I rebuilt enterprise Azure governance as Bicep IaC with per-module what-if gating, OIDC, and an AI pair-programmer."
categories: security devsecops azure bicep iac landing-zones
linkedin_promote: true
linkedin_promote_date: 2026-07-01
---

# Azure Landing Zones as Code: Governing the Cloud at Machine Speed

Most enterprise Azure environments are governed by good intentions and accumulated regret. Someone clicked through the portal to stand up a resource "real quick" six months ago, and now that resource exists in a configuration nobody fully understands, attached to an RBAC assignment nobody remembers granting, with no audit trail for any of it. Multiply that by a hundred engineers over two years and you have an environment that you can describe but can't reliably reproduce, can't safely modify, and can't audit with confidence.

I've been rebuilding my demo org's Azure environment from scratch using Azure Landing Zones as Code — Bicep, not Terraform, backed by a GitHub Actions CI/CD pipeline with per-module what-if gating, OIDC authentication, and a shared reusable workflow library. And I had an AI pair-programmer doing a meaningful chunk of the heavy lifting.

Here's the architecture, the security design choices, and the honest story about where AI actually accelerated the work.

## The ALZ Foundation: Management Groups and Policy at Scale

The Azure Landing Zone Accelerator (v7.1.1) sets you up with an opinionated management group hierarchy that looks like this:

```
Tenant Root Group
└── sc  (intermediate root — my demo org)
    ├── sc-platform
    │   ├── sc-platform-connectivity
    │   ├── sc-platform-identity
    │   ├── sc-platform-management
    │   └── sc-platform-security
    ├── sc-landingzones
    │   ├── sc-landingzones-corp
    │   └── sc-landingzones-online
    ├── sc-sandbox
    └── sc-decommissioned
```

This isn't just organizational tidiness. Every policy assignment, every RBAC scope, every budget alert is anchored to one of these management groups. The hierarchy *is* the governance model. When you want to enforce "no public IP on any platform subscription," you assign that policy at `sc-platform`, and it cascades. You don't chase individual subscriptions.

The Bicep template tree mirrors this hierarchy exactly — one folder per management group, one `main.bicep` plus parameters per scope. That 1:1 mapping is what makes per-module CI/CD gating tractable: a change to `templates/core/governance/mgmt-groups/platform-connectivity/` only needs to run a what-if against the connectivity subscription, not all 21 modules.

The `templates/core/governance/lib/alz/` directory contains 100+ policy definitions from the ALZ reference implementation: `Deny-MgmtPorts-From-Internet`, `Deny-AppGW-Without-WAF`, `Deny-CognitiveServices-NetworkAcls`, `Deny-MachineLearning-PublicAccessWhenBehindVnet`, and on. These are Deny and Audit effects applied at management group scope — they're not suggestions. The landing zone enforces them on every subscription beneath the scope, including workload subscriptions you haven't deployed yet.

This is the point of the "landing zone → workload" model. The ALZ layer sets the guardrails. A workload team deploys their app into the `sc-landingzones-online` subscription and the policies are already there, already active. They can't accidentally expose a management port to the internet from inside their subscription because the policy won't allow the resource to be created.

## The Bicep Workload Pattern

Workload repos use the same Bicep-first pattern. Here's a condensed version of the `main.bicep` from my seismic analysis PoC (`deepseismic2-infra`) running in the online landing zone:

```bicep
targetScope = 'resourceGroup'

param environment string = 'dev'
param location string = resourceGroup().location
param projectName string = 'deepseismic2'
param tags object = { project: 'deepseismic2', environment: 'dev', owner: 'jospaid' }

// Unique suffix prevents global name collisions — ALZ-aligned naming convention
var uniqueSuffix = substring(uniqueString(subscription().subscriptionId, resourceGroup().name, projectName, environment), 0, 6)
var compactName = toLower('${projectName}${environment}${uniqueSuffix}')
var storageAccountName = 'st${compactName}'
var acrName = 'acr${compactName}'
var keyVaultName = 'kv-ds2${environment}${uniqueSuffix}'
var containerEnvName = 'cae-${projectName}-${environment}'
var backendAppName = 'ca-${projectName}-api-${environment}'

// Private endpoints for all PaaS services
param enableContainerRegistryPrivateEndpoint bool = false
```

The `uniqueString()` approach is standard ALZ naming practice — you get consistent, reproducible names that don't collide across subscriptions without maintaining a manual name registry. Private endpoints are parameterized and toggled off for dev, on for production. That's intentional: the security controls exist in code from day one, and enabling them for production is a config change, not a build change.

## The CI/CD Design: What-If Gating That Actually Scales

Twenty-one Bicep modules covering platform, networking, governance, and workload infrastructure. If every PR runs a what-if against all 21, you burn quota, you slow feedback, and engineers start ignoring the results. The solution is path-filter gating: only run what-if for the modules whose templates actually changed.

The CI workflow uses `dorny/paths-filter@v3` to produce a boolean output per module:

```yaml
# .github/workflows/ci.yaml — detect_changes job
- name: Detect changed paths
  id: filter
  if: github.event_name == 'pull_request'
  uses: dorny/paths-filter@v3
  with:
    filters: |
      _shared: &shared
        - 'parameters.json'
        - 'templates/core/governance/lib/**'
      any:
        - 'templates/**'
        - 'parameters.json'
      governance-int-root:
        - *shared
        - 'templates/core/governance/mgmt-groups/int-root/**'
      networking-hubnetworking:
        - *shared
        - 'templates/networking/hubnetworking/**'
      # ... 21 modules total
```

The `&shared` YAML anchor is the key design choice: any change to `parameters.json` or the shared governance policy library fans out to every module. A change to a single module's templates runs only that module's what-if. The CI validate job then calls the shared reusable workflow library — more on that in a moment.

CD operates differently. Push-to-main triggers a pure bash `git diff --name-only HEAD~1 HEAD` to detect changed paths, with a `FULL_RUN=true` shortcut when `parameters.json` or the governance lib changes:

```yaml
name: 02 Azure Landing Zones Continuous Delivery
on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      skip_what_if:
        description: 'Skip What If Check?'
        type: boolean
        default: false
      # ... 14 boolean module toggles for manual overrides
```

`skip_what_if` exists as an escape hatch — breaking glass in production emergencies only. In normal operation, every deploy runs `az deployment group what-if` before `az deployment group create`.

## The Shared Workflow Library: `alz-mgmt-templates`

Duplicating deploy logic across 21 modules in two workflows (CI and CD) is a maintenance nightmare. The solution is a separate repository — `alz-mgmt-templates` — that functions as a shared library of composite actions and reusable workflows:

```
alz-mgmt-templates/
└── .github/
    ├── actions/
    │   ├── bicep-deploy/action.yaml          # Core deploy composite action
    │   ├── bicep-first-deployment-check/     # Detects if resource group is new
    │   ├── bicep-installer/action.yaml       # Installs Bicep + updates Az module
    │   └── bicep-variables/action.yaml       # Extracts parameters.json into env vars
    └── workflows/
        ├── ci-template.yaml                  # Reusable what-if template
        └── cd-template.yaml                  # Reusable deploy template
```

The calling side is clean:

```yaml
validate_and_plan:
  uses: Spava-Corp/alz-mgmt-templates/.github/workflows/ci-template.yaml@main
  permissions:
    id-token: write
    contents: read
    pull-requests: write
  secrets: inherit
```

`ci-template.yaml` accepts 21 boolean inputs (one per module) plus environment and concurrency group params. The actual what-if logic lives once, in the template. When the logic needs updating — new module added, what-if flag format changes, Bicep version bumps — you change one file in `alz-mgmt-templates` and both `alz-mgmt` and any other consuming repo get the update on the next run. This is how shared libraries should work.

## OIDC Auth: No Stored Credentials, Period

Every deploy step authenticates via OIDC federated identity:

```yaml
- name: Sign in to Azure with OIDC
  uses: azure/login@v2
  with:
    client-id: ${{ vars.AZURE_CLIENT_ID }}
    tenant-id: ${{ vars.AZURE_TENANT_ID }}
    subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

The `id-token: write` permission on the calling job is what makes this work. GitHub mints a short-lived OIDC token for the workflow run; Azure's federated identity validates it against the configured subject claim; the workflow gets an ephemeral bearer token scoped to the target subscription. Nothing gets stored. There's no `AZURE_CREDENTIALS` JSON blob sitting in your repo secrets that, if leaked, gives someone persistent access to your Azure subscriptions.

If you're still using service principal JSON credentials in GitHub Actions for Azure deployments, please stop. OIDC is available on the free tier. The migration is a two-hour project. The credential-leak blast radius reduction is not incremental — it's categorical.

## The Supply Chain Security Angle: Immutable Image Digests

One of the more interesting security patterns in the workload repos is digest pinning. In `deepseismic2-infra`, the deploy workflow pulls container images from GitHub Container Registry into Azure Container Registry, then pins the SHA digest back into the Bicep parameter file and commits it to git:

```yaml
# From deploy-infra.yml — digest pinning step
- name: Pin digests in dev.bicepparam
  run: |
    for p in backendImage preprocessJobImage inferenceJobImage bakeJobImage; do
      sed -i -E "s#(param ${p} = ').*(')#\1${API_REF}\2#" "$PARAM"
    done
    git commit -m "chore(deploy): pin ${ACR_TAG} image digests [skip ci]"
    git push
```

This means every deployed container image version is recorded in git as an immutable reference. You can look at any commit and know exactly what image was running. You can't accidentally re-deploy a mutable `:latest` tag and get a different binary than what you tested. Tag mutation attacks — where a malicious actor pushes a compromised image to the same tag — are neutralized because your Bicep parameters reference the digest, not the tag.

## The AI Angle: Where Copilot Actually Helped

Here's the concrete version. The per-module path-filter CI logic — the YAML anchor pattern, the `_shared: &shared` structure, the 21 module gates — was authored with GitHub Copilot in the CLI. So was the CD bash path-detection script that runs `git diff --name-only` and constructs the module gate matrix. The `alz-mgmt-templates` reusable action library architecture itself — composite actions for `bicep-installer`, `bicep-variables`, `bicep-deploy`, plus the two reusable workflow templates — was built with Copilot pair-programming throughout.

The commit history shows `Co-authored-by: Copilot` on the most recent CI/CD work. This is what I mean when I say AI accelerates the work: not "AI wrote the whole thing," but "AI wrote the bash path-detection script while I focused on the module gating logic." The kind of repetitive-but-must-be-correct scaffolding that eats 45 minutes of careful manual construction took 10-15 minutes of iterating with Copilot. The design decisions were still mine. The security review was still mine. But the boilerplate wasn't.

The `deepseismic2-infra` COST.md file tracks AI agent costs per work session. The full infra scaffold — Container Apps environment, Azure ML, Azure OpenAI, Key Vault, Log Analytics, ACR, ADLS Gen2, private endpoints — was generated from an architecture kickoff conversation in a single session. That's not a workflow that works without having a clear architecture in your head first. But if you do have the architecture clear, the gap between "I know what I want" and "there's valid Bicep for it" collapses significantly.

## What This Cost to Build (and Write)

A through-line of this series is putting a real number on the AI build cost of every repo, drawn from each repo's `COST.md` where one exists. The ALZ post spans four repos:

- **homeschool-hero-azure: ~$270 (tracked).** This one has a real `COST.md` and it's the big one — a full multi-agent landing-zone build. The breakdown validates cleanly: Opus 4.6 $192.50 + GPT-5.4 $64.00 + Haiku 4.5 $3.00 + Sonnet 4.6 $10.50 = $270.01. The largest single session was a Squad orchestration run that built CI/CD, infra modules, and deploy scripts in parallel (91.5M input tokens).
- **deepseismic2-infra: ~$19.50 (tracked).** Summed from its `COST.md` session log across ten sessions — the Volve dataset copy and the SP→UAMI OIDC migration were the costliest line items.
- **alz-mgmt + alz-mgmt-templates: ~$40–100 (estimated).** Neither tracks a `COST.md`. The 21-module Bicep repo with path-filtered CI/CD is the deeper of the two; the templates library was built alongside it in the same sessions.

**Source build cost: roughly $320–370** across all four repos ($289.50 tracked + $40–100 estimated). These are AI *build* costs — LLM tokens to generate the IaC and pipelines — **not** Azure runtime costs, which are a separate bill I keep separate in every post.

Producing this post itself ran the usual flat **~$1.00** (research, drafting, review). And per the rule I hold all series: I don't count the cost of writing this cost section. No recursion.

## What to Steal from This

If you're looking to apply any of this in your own environment:

1. **Adopt the management group hierarchy first, before the IaC.** The policy enforcement model depends on the hierarchy. Get the structure right, then codify it.

2. **One Bicep folder per management group scope.** The 1:1 mapping between management groups and template folders is what makes per-module CI/CD gating tractable. It's also what makes the repository self-documenting — you can read the directory tree and understand the governance model.

3. **Move to OIDC immediately.** Before you build anything else. Service principal JSON credentials are technical debt with a real security cost.

4. **Put your what-if gating in a shared library.** The `alz-mgmt-templates` pattern scales. When you add a new module, you wire it into the path filter and pass its boolean to the shared template. The deploy logic doesn't change.

5. **Pin container image digests in git.** It's five lines of `sed`. The supply chain auditability you get in return — "what was running at 2:00 AM when that alert fired?" answered with a `git log` — is worth it.

6. **Use AI for the scaffolding, own the architecture.** The path-filter YAML, the bash diff script, the composite action boilerplate — these are correct-but-tedious. Let Copilot draft them. Keep your attention on the design decisions that actually matter.

The portal-drift problem doesn't get solved by better documentation or stricter change controls. It gets solved by making IaC the only path to production, making every change auditable via PR, and making the policy enforcement automatic rather than aspirational. This stack does all three. The AI just made building it less of a slog.
