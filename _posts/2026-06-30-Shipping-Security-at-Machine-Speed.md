---
layout: post
title:  "Shipping Security at Machine Speed: My AI-Accelerated DevSecOps Journey"
description: "Kicking off a series on rebuilding a security + cloud practice around AI agents — and shipping real DevSecOps at a pace that wasn't possible before."
categories: security devsecops AI azure automation
linkedin_promote: true
linkedin_promote_date: 2026-06-30
---

# Shipping Security at Machine Speed: My AI-Accelerated DevSecOps Journey

A few months ago I wrote about [Project Glasswing](https://www.spaid.dev/security/ai/microsoft/anthropic/vulnerability-management/2026/05/02/Project-Glasswing-and-Mythos.html) — Anthropic's frontier AI model hunting and finding zero-days that sat undetected for decades. My thesis there was that autonomous AI had collapsed the asymmetry between attacker and defender, and that organizations needed agent-team architectures to have any hope of keeping up. That post was about the threat landscape and what it *implies*. This series is about what I actually *did* about it.

Because here's what shifted for me: it's not just that AI can find vulnerabilities faster than humans. It's that AI can *build* security infrastructure faster, *write* detection logic faster, *govern* identity and data policy faster — and if you set it up right, with human oversight at the decision layer, the output is better than what most teams ship manually. I know because I spent the last several months rebuilding my security and cloud engineering practice around exactly this model, and I have the commits to prove it.

## The Thesis

Over the past several months, I rebuilt my cloud security practice around two tools: **GitHub Copilot CLI** (accessible on any Copilot tier — this doesn't require an enterprise seat or premium model access) and the open-source **[Squad framework](https://github.com/bradygaster/squad)** for orchestrating teams of specialized AI agents. Together, they became my engineering team for a full DevSecOps practice built in the open on Azure.

What I shipped: a complete Azure Landing Zone in Bicep with 21-module CI/CD gating, a detection-as-code pipeline for Microsoft Sentinel, information protection policy deployed as code via Purview, a decentralized identity verification service using Entra Verified ID, a zero-trust edge architecture from Azure Front Door through APIM to a private AKS cluster, IoT/OT security for Azure IoT Operations, AI capacity governance, cost-as-a-control patterns, and a seismic ML pipeline with supply-chain-secure container deployment. All of it version-controlled, all of it CI/CD-gated, all of it passing through human review before it touched production.

That's not a consulting backlog of work I squeezed in over a year. That's several months of evenings and weekends, most of it drafted by AI agents and validated by me.

## What Actually Changed

The honest answer is that the *tedious scaffolding work* shifted to AI, and I got to spend my time on the decisions that actually require security judgment.

A concrete example: the ALZ CI pipeline I built uses `dorny/paths-filter@v3` with 21 separate module gates. A change to a single Bicep template triggers a what-if run for only that module; a change to the shared policy library fans out to everything. Writing that path-filter YAML by hand would have been an hour of documentation-reading and trial-and-error. GitHub Copilot drafted it correctly in one pass while I described the design constraint. What remained for me was reviewing the logic, understanding the failure modes, and making the call on when to allow `skip_what_if` as a manual override.

OIDC-everywhere is another example. Every deploy pipeline I built — ALZ, Sentinel, Purview, Verified ID, all of it — uses `azure/login@v2` with `id-token: write` and federated identity. No stored `AZURE_CREDENTIALS` JSON anywhere. That's not a new idea; it's been best practice since Azure federated identity went GA. But the old pattern was that you'd set it up properly on the one project you had time for, and everything else got a service principal JSON in a GitHub secret because it was faster. When AI is generating the workflow boilerplate, the secure pattern is no harder than the insecure one. The baseline shifts.

The same pattern held for detection-as-code. I have Sentinel analytics rules and hunting queries that were authored by an AI agent squad in a single session — complete with MITRE ATT&CK tagging, entity mappings, and 14-day dynamic baselines for new-country detection on privileged accounts. The CI pipeline includes a custom .NET KQL syntax validator built ephemerally at CI time using the Kusto Language SDK. Before 2021, I was writing KQL in a browser and hitting save. No review, no validation, no audit trail. The contrast is not subtle.

## What's Coming in This Series

Here's a map of what I'm going to walk through, post by post:

1. **Azure Landing Zones as Code** — how to govern an enterprise Azure environment with Bicep, 21-module CI/CD, and OIDC auth; why we left Terraform behind.
2. **Sentinel Detection-as-Code: Then & Now** — comparing my 2021 approach (artisanal KQL in a browser) to the 2026 fully-automated detection pipeline, including the custom KQL validator.
3. **Information Protection as Code** — deploying a 12-label Purview sensitivity taxonomy, DLP policies, and SQL classification via CI/CD (with an honest note on where OIDC still isn't supported).
4. **Entra Verified ID in Production** — decentralized identity verification, passwordless onboarding, and the real infrastructure story including a Container Apps pivot mid-build due to quota constraints.
5. **Zero-Trust Edge: AFD → APIM → AKS** — the architecture, the Bicep, the Helm, and why Developer SKU stv2 APIM can't use internal VNet mode (and what you do instead).
6. **Securing Azure IoT Operations** — OT/IoT edge-to-cloud security with dual-workspace log routing, TLS enforcement policies, and why the preview API versions are worth the bleeding-edge risk.
7. **AI Capacity Governance** — managing Azure OpenAI quota across a real org, and how AI agents can help you govern AI itself.
8. **Cost as a Security Control** — FinOps isn't just optimization; it's anomaly detection for cloud environments.
9. **Squad: The Open-Source Framework Behind All of This** — a deep dive on how the agent orchestration actually works, the persistent-memory model, and how you can use it without any premium tooling.
10. **Energy & OSDU Infrastructure** — the seismic ML pipeline, supply-chain-secure container deployment, and what building for a regulated industry looks like.
11. **Identity Governance at Scale** — Conditional Access, RBAC governance, and keeping identity drift from becoming a security incident.
12. **AI-Assisted Vulnerability Research** — what the workflow looks like when AI is helping you find and triage your own attack surface.
13. **The Capstone: Full-Stack DevSecOps Workflow** — putting all the pieces together into a single operating model.

That's a lot of ground. I'm going to cover it at a practitioner level — real code, real constraints, real failure modes.

## What AI Is Good and Bad At

I want to be honest about this, because the hype tends to be binary.

AI is genuinely excellent at: generating well-structured boilerplate from a clear design constraint, finding and applying documented patterns (OIDC, path-filtering, MITRE tagging), writing first drafts of KQL and Bicep that are syntactically correct and structurally reasonable, and holding architectural context across a session so you're not re-explaining the same requirements every ten minutes.

AI is not good at: making security judgment calls that require organizational context, knowing when a compensating control is actually compensating for anything, or understanding the difference between "this works" and "this is appropriate for production given our risk posture." Those decisions stayed with me throughout. Every detection rule, every policy assignment, every RBAC grant — I reviewed it. The agents generated options; I made calls.

That's the right division of labor. The goal isn't to remove humans from security decisions. It's to remove humans from the mechanical work so they have more capacity for the decisions that actually matter.

## Why Human Governance Still Matters

If you've read my work for a while, you know I came up through the security side before moving into cloud architecture. The Glasswing post made the point about defensive AI agent teams from a threat-landscape perspective. I want to make a different point here: **the governance architecture matters as much as the technical architecture**.

Every commit in the repos I'll be discussing went through a PR. Every what-if run had to pass before a deploy. Every detection rule was code-reviewed. The AI agents I used are logged — every decision, every artifact, every session. That's not overhead. That's what makes AI-generated security artifacts defensible when something goes wrong, which it will.

Machine-speed shipping without machine-speed governance is how you end up with a very efficient path to a very bad place.

## What This Cost — and Why I'll Tell You Every Time

One commitment for this series: every post will carry a real AI cost figure. Not a vibe, not "it was cheap" — an actual dollar estimate, drawn from each source repo's `COST.md` where one exists and clearly labeled as an estimate where it doesn't. I think cost transparency is part of the honesty the AI conversation is missing, so I'm going to dogfood it.

Here's the headline for the whole estate you're about to read about: the tracked figures across the repos that keep a `COST.md` come to roughly **$414** in AI build cost. Including reasonable estimates for the repos that don't track it, the whole body of work — landing zones, detection-as-code, information protection, verified identity, zero-trust edge, IoT, AI-capacity governance, cost controls, a SOC agent framework, an energy-sector ML platform, and a pile of governance tooling — lands somewhere around **$500–750** in LLM tokens. That's the build cost of a security practice's worth of infrastructure.

Two ground rules I'll hold throughout. First, **build cost is not run cost** — the tokens to *build* a thing and the Azure bill to *run* it are different numbers, and I keep them separate in every post. Second, **no recursion**: I don't count the cost of writing the cost sections themselves. Each post's own production (research, drafting, review) runs a flat ~$1.00, and I'll note it without spiraling into counting the cost of counting the cost.

## Follow Along

Each post in this series is going to be grounded in real repositories, real commits, and real design tradeoffs. I'll include actual code from the repos, honest assessments of what the AI got right and what I had to fix, and practical guidance you can apply regardless of whether you're on a team of one or a team of fifty.

If you're a security practitioner who's been watching the AI tooling space and wondering how much of it is real and applicable to actual security work — this series is for you. Subscribe via [RSS](https://www.spaid.dev/feed.xml) or follow on LinkedIn for updates as posts drop.

The AI-driven era of security engineering is not coming. It's here. Let's build it right.
