---
layout: post
title:  "Cost Governance Is a Security Control"
description: "Microsoft's reference solution for VM start/stop automation wants Contributor on every subscription. That's not a governance gap — it's a lateral-movement path. Here's how a tag-based scheduler with a 6-action custom role proves that FinOps and SecOps are the same discipline."
categories: security devsecops azure finops rbac bicep functions
linkedin_promote: true
linkedin_promote_date: 2026-07-16
---

# Cost Governance Is a Security Control

Here's a sentence that sounds like a stretch until you've worked an incident: **every idle VM is both a cost leak and an attack surface.** A dev/test box running 24/7 burns money, yes. It also sits there unpatched on weekends, accumulating a longer exposure window than anything in production, often with weaker credentials because "it's just dev." When an attacker lands, that idle VM is a foothold. FinOps people see waste; SecOps people see blast radius. They're looking at the same machine.

This is why I find the Microsoft reference solution for VM start/stop automation so frustrating. Start/Stop V2 is a genuinely useful tool — schedule your dev/test VMs to shut down at night, save 60%+ on compute. But the deployment guide tells you to assign **Contributor** at subscription scope to the Function App's identity. Contributor. On every subscription. So now your cost-saving tool can read, modify, and delete *every resource* in your landing zone. You've solved a cost problem by creating a lateral-movement path. A Function App with Contributor on five subscriptions is exactly the kind of thing an attacker dreams about finding.

`Spava-Corp/alz-startstopv2` is my answer: the same automation, but built so the function can do precisely three things — start VMs, stop VMs, read VMs — and nothing else. Its 25-commit history is also one of the better real-world records I have of what it actually takes to ship secure infrastructure through a strict Azure Landing Zone policy regime, with AI iterating through each blocker.

## A Custom Role With Exactly Six Actions

The heart of the security argument is this custom role. Instead of Contributor, the Function App's user-assigned managed identity gets a role with six actions — the precise set needed to do its job:

| Action | Purpose |
|--------|---------|
| `Microsoft.Compute/virtualMachines/read` | Enumerate VMs |
| `Microsoft.Compute/virtualMachines/instanceView/read` | Check power state |
| `Microsoft.Compute/virtualMachines/start/action` | Start VM |
| `Microsoft.Compute/virtualMachines/deallocate/action` | Deallocate VM |
| `Microsoft.Compute/virtualMachines/powerOff/action` | Power off VM |
| `Microsoft.Resources/subscriptions/resourceGroups/read` | List resource groups |

That's the entire blast radius. If this identity is compromised, the attacker can start and stop your VMs — annoying, but not catastrophic. They cannot read a storage account, exfiltrate a secret, modify a network rule, or delete a database. Compare that to Contributor, where a compromise is game-over for the whole subscription. The role is deployed at management-group scope and assigned to the UAMI, so it covers every landing-zone subscription with the same minimal permission set:

```bicep
targetScope = 'managementGroup'

module roleAssignment 'modules/role-assignment.bicep' = {
  name: 'deploy-role-assignment'
  params: {
    managementGroupId: managementGroupId
    principalId: principalId   // the UAMI's object ID, from main.bicep output
    roleDefinitionId: customRole.outputs.roleDefinitionId
  }
}
```

There's a deployment subtlety here that's worth knowing: the deployment service principal doesn't have `roleDefinitions/write` at MG scope (correctly — that's a high-privilege right). So the custom role is bootstrapped once via CLI and then *referenced* by its stable GUID in Bicep, rather than created inside the template. The setup guide documents this. It's a small example of working *with* a least-privilege deployment identity instead of demanding it be elevated.

## Opt-In, Not Opt-Out

The scheduling model is tag-based and opt-in. A VM gets touched only if it carries a recognized tag:

| Tag | Start (Central) | Stop (Central) | Days |
|-----|-----------------|----------------|------|
| `work` | 7:00 AM | 7:00 PM | Mon–Fri |
| `game-server` | 5:00 AM | 3:00 AM | Every day |

VMs without either tag are never touched. This matters for security, not just convenience: opt-in means there's no way for the automation to accidentally power off a production VM that someone forgot to exclude. The secure default is "do nothing." You have to explicitly tag a machine into a schedule. No scope creep, no surprises.

## The ALZ Policy Gauntlet (or: What Secure IaC Actually Costs)

The commit history of this repo tells the FinOps∩SecOps story better than I can. It's a two-week gauntlet of Azure Landing Zone policy enforcement, and each `fix:` commit is a Copilot-human dialogue where the CI/CD pipeline validated a proposed solution against *real* ALZ policy and the next commit refined it. A few highlights:

**The shared-key storage fight.** ALZ's Microsoft Cloud Security Benchmark includes `StorageAccountDisableLocalAuth`, which blocks shared-key access on storage accounts. But Azure Functions' `AzureWebJobsStorage` connection uses a key by default. The resolution path is the interesting bit:

```
fix: use managed identity storage to comply with ALZ shared-key policy
fix: add keyless WEBSITE_CONTENTAZUREFILECONNECTIONSTRING
fix: revert to connection strings with policy exemption
feat: migrate to Flex Consumption plan (FC1)
feat: complete Flex Consumption migration with functionAppConfig
```

The team briefly considered a policy *exemption* — punching a hole in the security policy to make the function work. That was rejected. Instead, the function migrated to the **Flex Consumption** plan (Linux, FC1), which supports fully keyless storage with a user-assigned managed identity. The better security posture was achieved by finding the right architectural pattern, not by weakening the policy. That's the right instinct, and it's recorded in the diffs.

**Metric alerts on resources that don't exist yet.** The `Http5xx` metric is IIS-specific and unavailable on Linux/Flex Consumption, so the alerting switched to `requests/failed` from Application Insights — and needed `skipMetricValidation=true` on fresh deployments, because you can't validate a metric that hasn't been emitted yet. Small, real, the kind of thing you only learn by deploying.

**A triple-locked destroy workflow.** The `destroy-infra.yml` workflow requires a manual `workflow_dispatch` trigger, *plus* typing the literal string `DESTROY`, *plus* the `production` environment approval gate. Three independent locks. An attacker who compromises the repo cannot casually wipe the infrastructure, and neither can a tired engineer with the wrong tab focused. This was a Copilot-suggested pattern that happens to map cleanly onto change-management requirements.

## The AI Angle

This repo is the clearest example in my estate of what AI-assisted secure IaC actually looks like — and it's *not* "AI writes perfect code." It's iterative. The 25 commits are 25 rounds of: human sets the constraint (*no Contributor, must pass every ALZ policy*), Copilot proposes an implementation, CI/CD validates it against the real policy engine, the run fails or passes, the next commit refines. Copilot scaffolded the initial 10-module Bicep structure, the three workflows, and the three validation scripts. Then it navigated the policy gauntlet blocker by blocker.

The `.squad/decisions.md` ledger in the repo is part of why this worked across many sessions: it records the two-schedule requirement, the two-phase deployment (main.bicep emits the UAMI principal ID, which feeds rbac.bicep), and the RBAC bootstrap rationale. Copilot read those decisions at the start of each session to stay consistent — so the work didn't drift as it spanned two weeks. The human held the security line; AI did the implementation spelunking that would otherwise have eaten days.

## What This Cost to Build (and Run)

- **Source build cost:** No `COST.md` in the repo, so labeled **estimate: $40–80.** This is one of the higher estimates in the series, and deservedly — 25 commits across a two-week policy gauntlet, 10 Bicep modules, three workflows including the triple-locked destroy, three test scripts, and multiple genuine fix cycles (the storage-key saga alone was five commits). Iterative security work against a strict policy regime is where the AI hours actually go.
- **What it saves (run cost):** the automation itself runs at roughly **$5–17/month** (Flex Consumption function ~$0–5, storage ~$1, Log Analytics + App Insights ~$1–10). Against dev/test VMs running 24/7 across multiple subscriptions, the ROI is immediate and measurable — and every hour those VMs are deallocated is an hour they're not an attack surface.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). The management subscription ID and an alert-contact email that appear in the repo are redacted here.

## What to Steal

1. **Never accept Contributor for a single-purpose tool.** Write the custom role with the exact actions it needs. Six, in this case. Blast radius is a design parameter.
2. **Make automation opt-in via tags.** The secure default is "touch nothing." Require explicit tagging to bring a resource into scope.
3. **Solve policy conflicts by changing architecture, not by exempting the policy.** The Flex Consumption migration beat a shared-key exemption. Find the pattern that satisfies the control.
4. **Triple-lock destructive workflows.** Manual trigger + typed confirmation + environment gate. Compromise of any one is not enough.
5. **Treat FinOps as SecOps.** Reducing idle compute reduces both your bill and your attack surface. They're the same discipline wearing two name tags.

The reference solution would have had me trade a cost problem for a security problem. The better version costs more AI hours to build — because secure IaC through a real policy regime is genuinely harder — but it ends with a tool that saves money *and* shrinks the attack surface, with a 6-action role you can hand to an auditor without flinching.

*Next: a deep dive into Squad itself — the AI agent team framework that built most of the repos in this series.*
