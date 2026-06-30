---
permalink: /2026/07/29/How-I-Actually-Ship-This-Copilot-CLI-Squad-Workflow.html
layout: post
title:  "How I Actually Ship This: The Copilot CLI + Squad Workflow"
description: "Thirteen posts of security infrastructure, one repeating pattern. The capstone: the real end-to-end workflow — intent, scaffold, validate, iterate, govern, persist, compound — and the honest accounting of what AI changed (the ratio) and what it didn't (human accountability). Plus the whole estate's build cost."
categories: security devsecops copilot squad workflow capstone
linkedin_promote: true
linkedin_promote_date: 2026-07-29
---

# How I Actually Ship This: The Copilot CLI + Squad Workflow

Early in this series I made a claim: that AI had changed how I ship security infrastructure, and that I'd show you with real repos instead of slideware. We've now walked through landing zones, detection-as-code, information protection, verifiable identity, the zero-trust edge, AI-capacity governance, cost-as-security, an agent team for the SOC, and a two-Squad energy-sector ML build. This is the capstone, and it answers the only question that really matters: **after all of that, what actually changed in how the work gets done?**

The honest answer is in the commit histories, and it's more specific — and more boring, in a good way — than "AI is magic." Every meaningful repo in my estate since late April 2026 carries the same fingerprint. Let me show you the pattern, then the accounting.

## The Universal Fingerprint

Open any repo in my estate from the last few months — the **public** `x3nc0n` ones you can read for yourself, the **private** `Spava-Corp` ones I audit internally — and search the commits. You'll find this trailer on every meaningful one:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

That's not boilerplate — it's a verifiable record of collaboration. The human writes the commit title and makes the decision; Copilot is credited as co-author. Across the estate it's remarkably consistent: the public `secops-squad-starter-kit` (35+ commits), and — private by design, because they're built to deploy real infrastructure — `alz-startstopv2` (25 commits), `alz-security-copilot`, the OpenAI core, and more. For the public repos that's a claim you can verify yourself, commit by commit. The `Spava-Corp` repos stay private permanently — they're deploy-intended, not showcases — but they carry the identical fingerprint, audited the same way on the inside.

## The Repeating Pattern

Strip away the domain specifics and the same seven-step loop appears in every repo:

```
1. INTENT:    Human describes what should exist (in a README, an issue, a squad brief)
2. SCAFFOLD:  Copilot generates the IaC / code / workflow
3. VALIDATE:  GitHub Actions CI runs — catches policy blockers, syntax errors
4. ITERATE:   Human + Copilot fix each blocker — all in git, all auditable
5. GOVERN:    Merge gate — production environment approval, what-if review
6. PERSIST:   Squad agents update history.md and decisions.md with what was learned
7. COMPOUND:  Next session starts with full context from every prior iteration
```

Steps 2–4 happen inside a Copilot CLI session. Steps 3 and 5 happen in GitHub Actions. Step 6 happens automatically via the Scribe agent. And step 7 — the compounding — is the one that quietly changes everything. Let me draw out the three patterns within this loop that do the most work.

### Scaffolding: minutes, not days

From a README description of what should be deployed, Copilot produces a sensible Bicep module decomposition (`main.bicep` → `modules/`), the right `targetScope` for cross-scope deployments, consistent ALZ parameter naming, and a full OIDC GitHub Actions workflow. The [zero-trust edge post](/2026/07/09/Zero-Trust-Edge-AFD-APIM-AKS.html) had a genuinely fiddly WAF policy expression; the [IoT operations post](/2026/07/14/Securing-the-Edge-Azure-IoT-Operations.html) had three `DeployIfNotExists` policies with remediation RBAC. Both landed in a single session. That's the part everyone notices first, and it's real — but it's not the most important part.

### Iteration: the policy gauntlet

The [cost-governance post](/2026/07/16/Cost-Governance-Is-a-Security-Control.html) told this story, and it's the truest picture of AI-assisted infrastructure work I have. `alz-startstopv2` went through 25 commits over two weeks, each one a round of: human sets the constraint (*ALZ-compliant, least privilege, no Contributor*), Copilot proposes an implementation, CI validates it against the real Azure policy engine, the run fails or passes, the next commit refines. That's not "AI writes perfect code." It's AI doing the implementation spelunking — the read-three-docs-and-try-again grind — while the human holds the line on the constraints that matter. The `overageState` rejection from the [AI-governance post](/2026/07/15/Governing-AI-Capacity-as-Code.html) is the same lesson: AI scaffolds fast, CI catches the wrong bits, the history records the fix.

### Compounding: the part that actually changed the game

Here's what people miss. Every non-trivial repo got a Squad team with persistent agent identities. When Ripley (the IaC agent on the start/stop team) picks up a new session, she reads her `charter.md` (IaC expert, ALZ conventions) and her `history.md` (knows the current Flex Consumption config, the custom-role GUID, the policy-exemption status that was rejected). The `decisions.md` ledger records settled architecture — the two-schedule requirement, the two-phase deployment with principal-ID handoff — so the team never re-debates what's already decided. The knowledge accumulates in git: auditable, diffable, permanent. After a few weeks, the agents know a repo's environment as well as a senior engineer who's lived in it. *That's* the compounding advantage, and it's the thing a one-shot prompt to a chatbot can never give you.

## The Governance That Didn't Move

It would be easy to read all this as "the AI does the work now." It isn't, and the governance patterns are where I want to be most precise, because they're load-bearing:

- **OIDC everywhere, no stored secrets.** Every pipeline authenticates with federated credentials scoped to a branch or environment. A compromised feature branch yields a credential that *cannot* deploy to production.
- **Least-privilege RBAC, human-set.** The constraint ("not Contributor") comes from me; the 6-action custom role comes from Copilot; `validate-rbac.ps1` verifies it. AI defaults to minimum-viable RBAC *because the human demanded it*, not on its own initiative.
- **Merge gates and environment approval.** Every merge to main is human-reviewed. Every production deploy needs environment approval. The triple-locked destroy workflow needs a manual trigger *plus* a typed confirmation *plus* an environment gate.
- **Human-in-the-loop at the judgment layer, not the volume layer.** When a detection request comes in as a GitHub Issue, the agent triages, routes, writes the KQL, and opens the PR. The human reviews and merges. Steps 2–5 are the agent's; step 6 is mine.

One honest *evolution* worth flagging, because it's the through-line I've foreshadowed all series: "OIDC, no stored secrets" is the floor, not the ceiling. Most of these pipelines still federate to an **app-registration service principal** — far better than a stored secret, but still an Entra app object someone has to own, consent to, and govern. The pattern I'm converting the whole estate to is **OIDC federated to a User-Assigned Managed Identity (UAMI)** instead: the same `azure/login@v2` flow, but the identity is a plain Azure resource governed by IaC and RBAC — no app registration, no client secret, no consent sprawl. The `deepseismic2-infra` Squad already ran this cutover end-to-end (sub-scoped Contributor SP → RG-scoped UAMI with branch- and PR-federated credentials) as a single owned, rollback-planned issue. A dedicated post on converting every repo's Actions — and, where it fits, the apps' own runtime identity — from OIDC+SP to UAMI in **hours, not weeks**, is coming.

What changed isn't accountability — that's still entirely human, by design. What changed is **the ratio.** Before: one human, one task, one day. Now: one human directing eight parallel agents across multiple tasks in the same day, with every decision still signed by the person who made it. The AI took the volume, the iteration, the documentation, and the consistency. I kept the direction, the review, the governance, and the judgment.

## What the Whole Estate Cost

Throughout this series I've put a build-cost figure on every post, drawn from each repo's `COST.md` where one exists and labeled as an estimate where it doesn't. Here's the aggregate, and I want to be careful to separate *tracked* from *estimated*:

**Tracked figures (repos with a real COST.md):** roughly **$414.**
- homeschool-hero-azure: ~$270 (the big one — a full multi-agent landing-zone build)
- deepseismic2: ~$41.55 · deepseismic2-infra: ~$19.50
- secops-squad-starter-kit: ~$12–15
- entra-verifiedid (both repos): ~$10–12

**Including estimates for untracked repos:** somewhere around **$500–750** across all 18+ repos in the estate.

Sit with that for a second. That's the LLM token cost to build a landing-zone platform, a detection-as-code pipeline, information-protection-as-code, verifiable identity, a zero-trust edge, IoT security, AI-capacity governance, a cost-control function, a SOC agent framework, an energy-sector ML platform, and a pile of governance tooling. Five to seven hundred dollars. The traditional-consulting comparison is genuinely uncomfortable, and that's the point.

One note on honesty, because this series has been strict about cost transparency: these are AI *build* costs, not Azure *run* costs — two different bills, and I've kept them separate in every post. And I've deliberately **not** counted the cost of writing the cost sections themselves, because that way lies infinite recursion. Each post's production ran about **$1.00** (research, drafting, review); this capstone is the same. No deeper than that.

## What to Steal — The Whole Workflow

1. **Make intent explicit and let CI be the judge.** Describe what should exist; let Copilot scaffold; let GitHub Actions validate against your real policy engine. The loop is the product.
2. **Hold the constraints; delegate the implementation.** "No Contributor," "must pass ALZ policy," "OIDC not secrets" — those are yours. The spelunking to satisfy them is the AI's.
3. **Give every repo a persistent agent team.** The compounding from `charter.md` + `history.md` + `decisions.md` is the difference between a chatbot and a colleague who remembers.
4. **Keep humans on the judgment layer, not the volume layer.** Agents triage, route, draft, and open PRs. You review and merge. Accountability stays human; throughput multiplies.
5. **Track the cost in the open.** A COST.md per repo turns "AI built this" into a receipt — and keeps you honest about build-vs-run and about not getting recursive.

A whole series of security infrastructure, one repeating loop. The tools are GitHub Copilot CLI and Squad; the discipline is everything CI/CD and least-privilege and human-reviewed-merges already taught us. AI didn't replace that discipline — it ran inside it, took the volume, and changed the ratio. The human still ships. There are just a lot more hands now.

*Still ahead: the dogfood post. This whole series auto-promotes itself to LinkedIn from the post front-matter — and I'll hand you the entire template so you can do it too, no unlimited-Copilot subscription required.*
