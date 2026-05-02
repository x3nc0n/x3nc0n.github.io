---
layout: post
title:  "Project Glasswing & Mythos: What Microsoft's Guidance Means for the Rest of Us"
description: "Breaking down Microsoft's 5-domain guidance for organizations in the wake of Project Glasswing and Anthropic's Claude Mythos"
categories: security AI Microsoft Anthropic vulnerability-management
---

# Project Glasswing & Mythos: What Microsoft's Guidance Means for the Rest of Us

If you haven't been paying attention to [Project Glasswing](https://www.anthropic.com/glasswing), you need to start. Anthropic, Microsoft, AWS, Google, Apple, CrowdStrike, Cisco, and others have formed a coalition to use frontier AI—specifically Anthropic's Claude Mythos model—to autonomously discover and remediate vulnerabilities in critical software at a scale and speed that wasn't possible before. We're talking about a 10-trillion parameter model that has already found zero-days that sat undetected for decades: a 27-year-old bug in OpenBSD, a 16-year-old flaw in FFmpeg. This isn't theoretical anymore.

The problem? Discovery now massively outpaces our historic ability to patch. Microsoft's [MSRC blog post](https://msrc.microsoft.com/blog/2026/04/strengthening-secure-software-global-scale-how-msrc-is-evolving-with-ai/) lays out guidance organized around five domains that every security team should be thinking about right now. Here's my take on each.

## 1. Vulnerability Discovery

The old model was periodic scans, pen tests, maybe a bug bounty. Mythos changes this fundamentally. It operates continuously, autonomously, and with a depth of code understanding that exceeds what most human reviewers can achieve. Microsoft's guidance is clear: embed AI-augmented scanning throughout your SDL, not just at release gates. If you're still relying on quarterly pen tests and a SAST tool from 2019, you're already behind.

The practical implication for most organizations: you won't have access to Mythos directly (it's gated to Glasswing partners), but the vulnerabilities it finds will flow downstream as CVEs and patches. Your intake and triage processes need to handle a much higher volume, much faster.

## 2. Patching & Remediation

This is where it gets uncomfortable. [The Hacker News put it well](https://thehackernews.com/2026/04/project-glasswing-proved-ai-can-find.html): "Project Glasswing proved AI can find the bugs. Who's going to fix them?" The rate of discovery now exceeds what the ecosystem can remediate. Microsoft is pushing organizations to compress patch timelines from "calendar speed" to "machine speed."

What does that mean practically? Automate your validation and deployment pipelines. Have rollback mechanisms that actually work. Treat patching as a continuous operation, not a monthly event. If your patch Tuesday workflow involves a CAB meeting and a two-week testing window, that model is dead.

## 3. Supply Chain Security

Open-source components underpin nearly everything, and they're the least protected. Glasswing is explicitly targeting widely-used open-source dependencies because that's where the blast radius is largest. Microsoft's guidance: maintain a real SBOM (Software Bill of Materials), monitor your dependencies continuously, and be prepared to replace or patch supply chain components on very short notice—sometimes before public disclosure.

If you don't know what's in your software, you can't respond when Mythos finds a bug in a library four layers deep in your dependency tree. This isn't new advice, but the urgency is now existential rather than aspirational.

## 4. Incident Response

The window between vulnerability discovery and potential exploitation just collapsed. When AI can find and validate a zero-day in hours, adversaries with similar capabilities (or access to leaked findings) can weaponize it just as fast. Microsoft and the Glasswing partners are urging organizations to treat vulnerability management as a continuous, near-real-time activity.

Your IR playbooks need to account for scenarios where you're handling dozens of critical findings simultaneously. Tabletop exercises once a year won't cut it. Build muscle memory through continuous simulation. If your SOC can't pivot from "we got a CVE notification" to "patch deployed and validated" in under 24 hours for critical findings, that's a gap you need to close.

## 5. Governance & Responsible Disclosure

This might be the most important domain long-term. Mythos isn't publicly available precisely because of its offensive potential. The governance structures around who gets access, how findings are disclosed, and how the ecosystem coordinates remediation at scale are what prevent this capability from becoming a weapon.

Microsoft and Anthropic are calling for tighter collaboration, shared standards, and responsible disclosure mechanisms that can handle the volume. For your organization, this means updating your own disclosure and coordination policies. If someone reports a Glasswing-derived finding to you, can you respond at the speed required? Do you have relationships with your upstream maintainers to coordinate patches?

## Defenders Need AI Agent Teams, Not Just AI Tools

Here's the uncomfortable truth: threat actors are already using AI to find and exploit vulnerabilities. If Project Glasswing proves anything, it's that autonomous AI can discover zero-days faster than any human team. The asymmetry is clear—attackers only need one exploitable finding, defenders need to address *all* of them. You can't match machine-speed offense with human-speed defense.

This is where the tooling conversation gets interesting. Take a look at [Squad](https://github.com/bradygaster/squad) by Brady Gaster. It's an open-source framework for orchestrating teams of AI agents that work in parallel, persist knowledge across sessions, and operate under human governance. It was built for software development, but the architecture maps directly onto what defenders need to survive in a post-Glasswing world.

### The Agent Team Model for Security Operations

Squad's core concept: you define specialized agents (each with their own charter, expertise, and context), a coordinator routes work, and agents execute in parallel while logging every decision for human review. Here's the directory structure:

```
.squad/
├── team.md              # Roster — who's on the team
├── routing.md           # Routing — who handles what
├── decisions.md         # Shared brain — team decisions
├── agents/
│   ├── {name}/
│   │   ├── charter.md   # Identity, expertise, voice
│   │   └── history.md   # What they know about YOUR project
│   └── scribe/
│       └── charter.md   # Silent memory manager
├── skills/              # Compressed learnings from work
└── log/                 # Session history (searchable archive)
```

Now imagine this applied to a defensive security team:

```
.squad/
├── agents/
│   ├── vuln-triager/
│   │   ├── charter.md   # Specializes in CVE triage, CVSS scoring, asset mapping
│   │   └── history.md   # Knows your environment, past false positives, compensating controls
│   ├── patch-engineer/
│   │   ├── charter.md   # Builds, validates, and deploys patches
│   │   └── history.md   # Knows your CI/CD pipeline, rollback procedures, change windows
│   ├── supply-chain-analyst/
│   │   ├── charter.md   # Monitors SBOM, tracks dependency vulns, evaluates alternatives
│   │   └── history.md   # Knows your dependency tree, risk appetite, approved packages
│   ├── ir-responder/
│   │   ├── charter.md   # Incident detection, containment, forensics
│   │   └── history.md   # Knows your runbooks, escalation paths, past incidents
│   └── governance-lead/
│       ├── charter.md   # Disclosure coordination, compliance, reporting
│       └── history.md   # Knows your regulatory requirements, vendor contacts
```

### Watch Mode: Continuous, Autonomous Triage

Squad has a "Watch Mode" (they call the orchestrator Ralph) that continuously polls for new work, triages it, and dispatches agents:

```bash
squad watch --execute --interval 5
```

Ralph uses an agent-delegated selection pattern:
1. Polls for new issues (in our case, incoming CVEs, alerts, or Glasswing disclosures)
2. Builds a context snapshot: current vulnerability queue, squad state, recent decisions
3. Dispatches the appropriate agent to handle it
4. Monitors execution, logs results, escalates to humans when judgment is needed

The 4-tier error escalation is what makes this viable for security: circuit breaker reset → auth reprobe → state refresh → pause for human intervention. It won't spin endlessly on a failed remediation.

### Why This Architecture Matches the Threat

Think about what threat actors are doing right now. They're running AI agents that:
- Scan for newly disclosed vulnerabilities
- Automatically generate exploits
- Chain multiple findings into attack paths
- Operate 24/7 without fatigue

A single human analyst, or even a team of them, cannot match this cadence. But a *squad* of specialized AI agents can. The key differentiator from just "using an AI chatbot" is:

1. **Parallel execution.** When 50 CVEs drop from a Glasswing disclosure, your vuln-triager, patch-engineer, and supply-chain-analyst all spin up simultaneously. You're not working through a queue; you're addressing the blast in parallel.

2. **Persistent knowledge.** Each agent's `history.md` compounds over time. Your patch-engineer doesn't need to rediscover that Service A requires a blue-green deployment while Service B can do rolling updates. It *remembers*. After a few months, your defensive agents know your environment as well as any senior engineer.

3. **Decision auditability.** Every action goes into `decisions.md` and the orchestration log. When your CISO asks "why did we prioritize patching X over Y?" you have a complete decision trail. This maps directly to the governance domain—you need this for compliance, for disclosure coordination, and for post-incident review.

4. **Human-in-the-loop at the right layer.** You're not approving every `apt-get update`. You're setting policy, reviewing escalations, and making judgment calls on edge cases. The agents handle the volume; you handle the decisions that require organizational context and risk appetite.

### Practical Integration: From CVE to Patch in Hours

Here's what a post-Glasswing defensive workflow looks like with this model:

```
1. Glasswing disclosure drops 37 new CVEs affecting your stack
2. Ralph (watch mode) ingests the advisory
3. vuln-triager agent: maps CVEs to your assets, scores by exposure, identifies 8 critical
4. patch-engineer agent (×8, parallel): pulls patches, runs validation suites, stages deployments
5. supply-chain-analyst agent: flags 3 CVEs in transitive dependencies, identifies upgrade paths
6. ir-responder agent: checks detection coverage, confirms no active exploitation in your logs
7. governance-lead agent: drafts disclosure response, notifies affected customers per SLA
8. Human review: you approve the 8 critical deployments, adjust priority on 2, escalate 1
9. Patches deploy. Total elapsed: 4 hours.
```

Compare that to the old model: a single analyst reads the advisory Monday morning, spends the day triaging, files tickets, waits for the patch team's sprint capacity, CAB approves on Thursday, deploys next Tuesday. By then, the exploit has been in the wild for a week.

### The SDK Angle: Building Custom Security Agents

Squad provides a TypeScript SDK for programmatic control:

```typescript
import { defineSquad, defineTeam, defineAgent } from '@bradygaster/squad-sdk';

export default defineSquad({
  team: defineTeam({ name: 'SecOps Squad', members: ['@triager', '@patcher', '@responder'] }),
  agents: [
    defineAgent({ name: 'triager', role: 'Vulnerability Triage', model: 'claude-sonnet-4' }),
    defineAgent({ name: 'patcher', role: 'Patch Engineering', model: 'claude-sonnet-4' }),
    defineAgent({ name: 'responder', role: 'Incident Response', model: 'claude-sonnet-4' }),
  ],
});
```

You can wire in custom tools (your SIEM API, your deployment pipeline, your asset inventory), hook pipelines for guardrails, and file-write guards so agents can't push changes without validation. The extensibility model means you can integrate with whatever tooling you already have—Sentinel, Defender, CrowdStrike, your homegrown CMDB—without ripping and replacing.

## So What Do You Do?

If you're a security leader, here's the short version:

1. **Automate intake and triage.** The volume of findings is about to increase dramatically. An AI agent team polling continuously and triaging autonomously isn't optional anymore—it's the only way to keep up.
2. **Compress your patch cycle.** Hours, not weeks. Parallel agent execution against multiple CVEs simultaneously is how you get there.
3. **Know your dependencies.** Real SBOM, real monitoring, real response capability. A supply-chain-analyst agent that *persists knowledge* about your dependency tree is worth more than a dashboard nobody checks.
4. **Upgrade your IR cadence.** Continuous, not periodic. Watch mode with automated escalation replaces the "check the queue every morning" model.
5. **Engage with the ecosystem.** You can't do this alone. Frameworks like Squad are open-source. The defensive tooling community needs to move as fast as the attackers' tooling community.

The asymmetry between offense and defense has always favored attackers. AI agent teams are the first credible path to parity. When a threat actor can spin up an AI that chains zero-days autonomously, your defense can't be a human reading email alerts. It has to be a coordinated, parallel, persistent, auditable team of AI agents—operating at the same speed, with human governance at the decision layer.

The AI-driven era of security isn't coming; it's here. The organizations that adapt to this pace will survive. The ones that respond with "there's a firewall; it's fine" will not.
