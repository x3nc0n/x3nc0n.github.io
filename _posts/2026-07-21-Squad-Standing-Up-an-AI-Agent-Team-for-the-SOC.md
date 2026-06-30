---
layout: post
title:  "Squad: Standing Up an AI Agent Team for the SOC"
description: "A persistent, auditable AI team for security operations — built by an AI team. Here's the real structure: the .secops/ environment schema, Wire-cast agent charters, severity-based routing, 847 skills, and detection-as-a-GitHub-Issue with KQL validation in CI."
categories: security devsecops squad ai-agents soc sentinel automation
linkedin_promote: true
linkedin_promote_date: 2026-07-21
---

# Squad: Standing Up an AI Agent Team for the SOC

I wrote about Squad's architecture back in the [Project Glasswing post](/2026/05/02/Project-Glasswing-and-Mythos.html) — the `.squad/` directory structure, watch mode, the four-tier error escalation, the SDK-first TypeScript mode. That post answered *what Squad is*. This one answers a harder question: **how do you actually stand one up for security operations, and what does it look like when it's running real SOC work?**

The honest motivation is bottleneck math. A SOC analyst staring down 50 CVEs at 8 AM on a Monday is the bottleneck. So is a detection engineer with a three-week backlog of rule requests, and a hunt lead who never has time to chase a hypothesis. You can't hire your way out of it fast enough. What you *can* do is build a persistent AI team that knows your environment, remembers everything in git, and routes work to the right specialist automatically — while keeping a human in the loop at the layers that need judgment. That's what `secops-squad-starter-kit` is: a redistributable, install-and-go SecOps team. And the kicker is that **it was built by a Squad** — a team of AI agents cast from *The Wire*, dogfooding the framework to build the framework.

## The `.secops/` Environment: Teaching the Team Your World

The thing that makes a SecOps agent team useful instead of generic is that it knows *your* environment — your Sentinel workspace, your data tiers, your tenants, your compliance obligations. The starter kit encodes all of that in a `.secops/` directory with a versioned YAML schema. The root descriptor:

```yaml
schema_version: "1.0"

organization:
  name: "Contoso Corp"
  cloud: "azure-commercial"
  primary_region: "eastus2"
  data_residency: "us"
  org_type: "enterprise"    # enterprise | mssp

tenants:
  - id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    name: "Contoso Production"
    type: "primary"

subscriptions:
  - id: "11111111-2222-3333-4444-555555555555"
    name: "SOC-Production"
    purpose: "sentinel, soar-playbooks"

default_workspace: "example-workspace"
```

Around that root sit six subdirectories: `workspaces/` (per-workspace Sentinel config), `data-sources/` (a map of which tables live where and in which tier), `identity/` (Entra tenants and RBAC conventions), `alerting/` (escalation and routing), and `compliance/` (the frameworks and obligations the SOC operates under). Agents read these before they act. When Herc writes a detection, he already knows your data residency constraint. When Carver investigates, he already knows your RBAC conventions.

The cleverest piece is `discovery-log.yaml`, an **append-only** log where agents record facts they learn about your environment:

```yaml
# Agents append; humans promote confirmed facts to authoritative YAML.
discoveries: []
# Each entry: timestamp, agent, confidence (high|medium|low), fact, source,
#   + optional: data_source, location, workspace, tier, region, promoted_to
```

An agent discovers that a `DeviceNetworkEvents` table exists in a particular workspace, or that there's an ADX cluster holding archived logs. It appends a structured entry with a confidence level. A *human* then reviews and promotes confirmed facts into the authoritative YAML. This is the right trust model for security work: agents can observe and propose, but a person ratifies what becomes ground truth. No agent silently rewrites your environment's source of record.

You don't even hand-write the workspace config. The CLI auto-discovers it:

```bash
secops-squad env workspaces   # → az login → subscription picker → LA workspace discovery
```

It enumerates Log Analytics workspaces via `az monitor`, checks which ones have Sentinel enabled via the SecurityInsights REST API, and writes the YAML. Zero manual configuration of the thing that's most tedious to configure correctly.

## The Team: Roles, Boundaries, and a Reviewer Who Can Say No

The full-SOC persona ships an eight-member team mapped to real SOC functions, cast from *The Wire*:

| Name | Role | Expertise |
|------|------|-----------|
| Bunny Colvin | SOC Manager | Strategy, metrics, stakeholder comms |
| Bodie | L1 Analyst | Alert triage, playbook-driven response |
| Poot | L2 Analyst | Medium-severity investigation, enrichment |
| Carver | L3 Analyst | Cross-domain correlation, APT hunting |
| Herc | Detection Engineer | Analytics rules, MITRE mapping |
| Cutty | Automation Engineer | SOAR playbooks, Logic Apps |
| McNulty | Hunt Lead | Hypothesis-driven threat hunting |
| Lester | Threat Intel | IOC research, adversary profiling |

The names are an easter egg, nothing more — they don't change behavior. What matters is that each agent has a **charter** that defines not just what it owns but what it explicitly *doesn't*. Here's the heart of Carver's:

```
## Boundaries
I handle: Testing, validation, QA, edge case discovery, KQL verification.
I don't handle: Writing production KQL (Freamon), threat detections (Kima),
  or automation (Herc). I test what others build.

Carver has reviewer authority — can reject work that fails quality gates.
```

That last line is the part most "AI agent" demos skip. Carver can *reject* another agent's work. When a detection rule fails a quality gate, it doesn't merge — and per the framework's reviewer-rejection rules, the original author doesn't get to quietly re-submit their own fix; a different agent owns the revision. A SOC where the AI can approve its own output is a SOC with no quality gate. Building genuine reviewer authority — including the lockout semantics — into the team structure is what makes the output trustworthy.

Routing is severity-based and maps onto a real escalation ladder:

```
Informational → Bodie (L1):  auto-triage, known-good baselines
Low           → Bodie (L1):  playbook-driven, standard enrichment
Medium        → Poot (L2):   entity enrichment, timeline, escalate vs. close
High          → Carver (L3):  cross-domain correlation, APT, containment recs
Critical      → Bunny Colvin: coordinates responders, stakeholder comms

Bodie → Poot → Carver → Bunny Colvin → External (CISO, Legal)
```

## Work Arrives as GitHub Issues

Here's where it gets operationally real. SecOps work *intake* is a set of structured GitHub Issue templates: `JitAccess.yml` (just-in-time access request), `detection-request.md`, `hunt-request.md`, `playbook-request.md`. A new issue comes in, and a fleet of GitHub Actions does the triage:

- `squad-triage.yml` — auto-triages new issues to the right agent based on routing rules
- `squad-issue-assign.yml` — assigns based on the routing table
- `kql-validate.yml` — validates any KQL on push/PR
- `squad-heartbeat.yml` — periodic health check on squad state
- `sync-squad-labels.yml` — keeps issue labels consistent

Walk the detection lifecycle end to end: someone files a `detection-request` issue → `squad-triage` routes it to Herc (Detection Engineer) → Herc opens a PR with a KQL analytics rule → `kql-validate.yml` runs the query through a validator in CI → Carver reviews → merge. **The entire detection lifecycle lives in git, every step auditable.** Your CISO can read the commit history and see exactly who requested what, who built it, what validated it, and when it shipped. That maps directly onto NIST IR 800-61 documentation requirements — not as an afterthought, but as the natural byproduct of doing the work this way. Same for JIT access: a security control becomes a structured, reviewable, logged workflow instead of a Teams message and a prayer.

## 847 Skills: Compressed Expertise the Agents Read

An agent is only as good as what it knows, and re-deriving "how do I write a near-real-time Sentinel rule" every session is wasteful and error-prone. So the kit ships **847 skills** — Markdown files that encode API patterns, PowerShell wrappers, and KQL templates — across 11 core domains (detection, kql, log-analytics, msft-security, adx, soar, powershell, orchestration, platform, testing) plus 755 imported from the cybersecurity community. A skill is compressed, reusable knowledge: an agent reads `skills/kql/sentinel-analytics-rules.md` and produces a correct rule without re-researching the schema. The community import alone — 755 skills in a single session, triaged for relevance by the SecOps agent at High/Medium/Low confidence before import — is a vivid example of AI working at a scale that would be absurd by hand.

The kit also includes Bicep templates for the infrastructure the agents reason about: an ADX cluster for security data modeling and migration-from-Sentinel, and SOAR Logic App playbooks (compromised-account, phishing-response, malware-containment, IP-enrichment, Teams-notification). And a June 2026 add-on deploys Anthropic's Fable 5 on Azure AI Foundry as a bridge model — explicitly marked `deprecated-when: claude-fable-5 lands in the GitHub Copilot model catalog`, which is the right way to ship a temporary bridge: with its own expiry date written down.

## The AI Angle: The Product and the Process Are the Same Artifact

The most interesting thing about this kit is that its commit history *is* the AI-acceleration story. It was built in six phases — Foundation → Critical Skills → Platform Skills → Integration → Advanced → Polish — each a Copilot agent sprint by a Wire-cast team. Sydnor built the CLI env commands. Kima built the Microsoft Security skills. Freamon built the KQL patterns. The Scribe agent handled decision hygiene automatically — merging inbox decision files, archiving entries older than seven days to keep `decisions.md` under 50KB. You can read `Scribe: Merge 19 decisions from inbox` right there in the log. The framework for building auditable AI teams was itself built by an auditable AI team, and the audit trail is public.

## What This Cost to Build (and Write)

- **Source build cost:** The starter kit tracks a `COST.md` at **~$12–15** (validated: ~$10.74 Sonnet-tier + ~$1.75 Haiku-tier = ~$12.49, across six build phases). The `squad` fork and the private `secops-squad` instance don't track cost, so labeled **estimate: $15–40** combined. Total for the cluster: roughly **$27–55**. For context, $12–15 produced 847 skills, a CLI, the `.secops/` framework, seven personas, and the ADX + SOAR Bicep templates.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). The `.secops/` examples use Contoso placeholders by design; no real tenant, subscription, or workspace IDs appear.

## What to Steal

1. **Encode your environment as versioned YAML the agents read.** A SecOps agent that knows your data tiers and compliance constraints beats a generic one every time.
2. **Make discovery append-only, with human promotion.** Agents observe and propose; a person ratifies ground truth. Never let an agent silently rewrite your source of record.
3. **Give a reviewer agent real authority to reject — with lockout.** Self-approving AI output has no quality gate. The original author shouldn't revise their own rejected work.
4. **Route work intake through structured GitHub Issues.** JIT access, detection requests, hunts — as templates, triaged by Action, executed in PRs. The whole lifecycle becomes auditable in git.
5. **Treat skills as compressed, reusable knowledge.** Agents that read API/KQL/PowerShell patterns produce correct output without re-researching. It compounds.

The Glasswing post made the case that an AI team could do SecOps. This is what it looks like wired up for real: an environment schema, charters with boundaries, severity routing, GitHub-native intake, KQL validation in CI, and 847 skills of compressed expertise — built, auditably, by the very kind of team it helps you stand up.

*Next: taking all of this to the energy sector — a cloud-native seismic ML platform built end-to-end by an AI agent team for under $40 in tokens.*
