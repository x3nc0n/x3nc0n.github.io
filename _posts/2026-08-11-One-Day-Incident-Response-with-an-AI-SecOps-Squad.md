---
permalink: /2026/08/11/One-Day-Incident-Response-with-an-AI-SecOps-Squad.html
layout: post
title:  "How I Ran a Full Incident Response for a Restaurant in Less Than a Day"
description: "A real-world, privacy-scrubbed account of using an AI SecOps Squad to investigate a privileged cloud identity compromise, correct the initial theory, and deliver a reviewed incident report in less than one day."
categories: security incident-response ai-agents secops entra defender threat-hunting
linkedin_promote: true
linkedin_promote_date: 2026-08-11
linkedin_blurb: "A friend who runs a restaurant needed a real incident response, not a chatbot summary. I used my open-source SecOps Squad to collect and reconcile cloud evidence in parallel, challenge its own first theory, and deliver a reviewed IR report in less than a day. The case is a practical example of why defenders need AI-accelerated workflows to meet AI-era threats."
---

# How I Ran a Full Incident Response for a Restaurant in Less Than a Day

A friend who runs a restaurant called me after a privileged Microsoft cloud account was compromised.

This was not a tabletop. It was not a synthetic dataset. It was a small business with customers, employees, payment operations, email, cloud services, and no full-time incident response team. The owner needed to know what happened, whether the attacker was still present, what had been touched, and what to fix first.

Once I had working read access, I used my open-source [SecOps Squad Starter Kit](https://github.com/x3nc0n/secops-squad-starter-kit) to run the investigation. In less than one day, the team:

- collected identity, application, Conditional Access, directory, Defender, RBAC, and Azure Activity Log evidence;
- processed more than 100,000 non-interactive sign-in records, including a raw export hundreds of megabytes in size;
- reconstructed the token and device-registration sequence;
- identified approximately 1,100 successful attacker token refreshes over at least 24 days;
- reconciled conflicting analyst conclusions;
- retracted an incorrect early theory;
- independently reviewed the final findings; and
- produced an executive report, technical chronology, containment assessment, root-cause analysis, and prioritized remediation roadmap.

I am publishing this with the owner's permission. I have removed or generalized the restaurant's name, tenant and subscription IDs, domains, user names, device IDs, session IDs, IP addresses, partner names, application IDs, and other details that could identify the organization. Counts are rounded where precision is not necessary to explain the lesson.

The important part is not the customer's identity. It is the defensive operating model.

## The Finding in One Paragraph

The strongest evidence showed that an attacker tracked in the tenant's Microsoft telemetry as **STORM-3052** used device-code phishing to obtain a refresh token for a standing Global Administrator account. That token already carried an MFA claim, so later access was recorded as MFA having been "previously satisfied" even though the attacker performed no fresh MFA. The actor silently refreshed tokens for at least 24 days, then escalated to interactive access and registered a device. Microsoft Defender automatically disrupted the interactive activity in about 18 minutes. The investigation confirmed containment in the identity and Azure resource planes, but it did **not** claim that unexamined Microsoft 365 data planes or endpoints were clean.

That last sentence matters. A fast IR that overstates certainty is just a fast way to be wrong.

## A Brief Profile of STORM-3052

Microsoft's public [threat-actor naming taxonomy](https://learn.microsoft.com/en-us/unified-secops/microsoft-threat-actor-naming) uses `Storm-####` for an unknown, emerging, or developing activity cluster. It is a temporary tracking label, not proof by itself of a country, sponsor, or mature public attribution.

In this case, Microsoft Identity Protection telemetry explicitly populated the actor field with `STORM-3052` and classified the activity as nation-state. I found no public Microsoft profile that would support naming a sponsor, so I will not invent one.

The case evidence supports this limited behavioral profile:

| Observed behavior | What it tells me |
|---|---|
| Device-code phishing | The actor targeted OAuth authentication rather than relying on password spray |
| Long-lived token refreshes | The objective included quiet, durable identity access |
| Scripted cloud-hosted sign-ins | The actor automated token use and rotated infrastructure |
| Reuse of an inherited MFA claim | The actor understood Entra token semantics and Conditional Access behavior |
| Rapid device registration | The actor attempted to upgrade access into a more durable device/PRT foothold |
| Focus on one privileged identity | The operation was selective, not broad commodity credential stuffing |

Was AI used by the attacker? I cannot prove that from sign-in logs. The disciplined automation, infrastructure rotation, token handling, and speed are consistent with capabilities that AI can accelerate, but "consistent with" is not attribution. I believe AI enablement is plausible; I do not present it as a forensic fact.

That distinction is part of good incident response: label facts, judgments, and unknowns separately.

## Why This Investigation Needed a Team

Cloud IR is not one query. A privileged identity compromise crosses several planes:

```text
Identity       Entra sign-ins, risk detections, authentication methods
Protocol       OAuth grants, token claims, device-code flow, PRT issuance
Policy         Conditional Access, authentication strength, exclusions
Directory      Users, groups, devices, roles, audit events
Applications   Service principals, app registrations, consent and ownership
Azure          RBAC, Activity Logs, resources, management-group scope
Detection      Defender XDR alerts and automated disruption
Data planes    Exchange, SharePoint, OneDrive, Teams
Endpoints      Device process, network, and persistence telemetry
```

A human can work these serially. That is how a multi-day engagement becomes a multi-week engagement.

My SecOps Squad split the work across specialists:

| Specialist lane | Responsibility |
|---|---|
| Identity forensics | Interactive/non-interactive sign-ins, risk detections, XDR correlation |
| Protocol and policy | Token path, OAuth, Conditional Access, MFA claim interpretation |
| Directory forensics | Users, groups, devices, authentication methods, role changes |
| Azure forensics | RBAC and Activity Logs across subscriptions and root scope |
| Synthesis | Timeline, competing hypotheses, conflict resolution, executive narrative |
| Independent review | Evidence challenge, wording precision, confidence and scope checks |

The agents worked in parallel, but they did not get independent authority to declare the incident closed. I directed the investigation, handled access, evaluated conclusions, and retained accountability for the report.

That is what I mean by **AI-accelerated**, not AI-autonomous.

## The Workflow I Used

The practical workflow was four waves.

```text
Wave 1: Collect in parallel
  ├─ identity and risk evidence
  ├─ OAuth, apps, and Conditional Access
  ├─ directory objects and privileged roles
  └─ Azure RBAC and control-plane activity

Wave 2: Synthesize
  ├─ normalize timestamps and principals
  ├─ build a shared chronology
  ├─ rank competing initial-access hypotheses
  └─ identify evidence gaps

Wave 3: Challenge
  ├─ independently verify high-impact counts
  ├─ test the leading hypothesis against alternatives
  ├─ reject unsupported attribution
  └─ narrow the containment statement to observed planes

Wave 4: Report
  ├─ executive summary
  ├─ detailed chronology
  ├─ root cause and contributing controls
  ├─ containment and eviction assessment
  └─ 24-hour / 7-day / 30-day / 90-day roadmap
```

Every lane wrote evidence and decisions to files. That made the work diffable and reviewable instead of trapping the reasoning inside a chat transcript.

## The AI Did Not Just Make It Faster. It Caught Our Mistake.

The most valuable moment was not a clever query. It was a retraction.

An early report treated a consent event near the interactive compromise as malicious consent phishing. The timing looked suspicious. The source infrastructure looked unusual. The story fit.

It was also wrong.

The review pass checked the application owner and permission delta. The target was a legitimate Microsoft first-party application, and the permission change was:

```text
[] => []
```

No permissions were granted. The related IP was removed from the IOC list, and the consent-phishing conclusion was formally retracted.

The squad then pre-registered competing hypotheses before rescoring the evidence:

```text
H1  Password spray followed by success
H2  MFA fatigue / push bombing
H3  Malicious OAuth consent
H4  Adversary-in-the-middle session theft
H5  Device-code phishing and token replay
H6  Pre-positioned authentication method
H7  Federation or legacy-authentication path
...
```

For each hypothesis, the team defined what would confirm it, refute it, or remain ambiguous. That prevented the analysts from fitting every new fact into the first plausible narrative.

The corrected conclusion was device-code phishing leading to refresh-token theft and replay, assessed at 80% confidence. MFA fatigue was refuted. Password spray was unsupported. The malicious-consent theory was retracted.

This is the standard I want from defensive AI: not confident prose, but **recoverable reasoning with the ability to say, "The earlier conclusion was wrong."**

## The Smoking Gun Was in the Quiet Logs

The default sign-in view made the incident look like a familiar story: many failures followed by a successful privileged sign-in.

The non-interactive sign-in stream reversed that story.

The squad streamed a large JSON export instead of loading it into memory, partitioned the events by source and session, and found roughly 1,100 consecutive successful token refreshes from attacker infrastructure over at least 24 days, with zero failures. The activity repeated about every 30 minutes.

The July interactive event was not initial access. It was escalation.

The key fields were:

```text
originalTransferMethod = deviceCodeFlow
authenticationMethod = Previously satisfied
authenticationStepResultDetail = MFA requirement satisfied by claim in the token
signInTokenProtectionStatus = unbound
```

`Previously satisfied` does not mean the attacker completed MFA. It means the token arrived carrying a claim that Conditional Access accepted as satisfying MFA.

That distinction is easy to miss in a dashboard and obvious once the protocol specialist compares the fields across the token family.

Here is a generalized KQL pattern defenders can adapt:

```kusto
AADNonInteractiveUserSignInLogs
| where TimeGenerated > ago(30d)
| where ResultType == 0
| extend TransferMethod = tostring(OriginalTransferMethod)
| where TransferMethod =~ "deviceCodeFlow"
| summarize
    SuccessfulRefreshes = count(),
    FirstSeen = min(TimeGenerated),
    LastSeen = max(TimeGenerated),
    Apps = make_set(AppDisplayName, 20)
  by UserPrincipalName, IPAddress
| where SuccessfulRefreshes > 20
| order by SuccessfulRefreshes desc
```

Schema names vary by connector and export path. The reusable idea is more important than the exact table: hunt the non-interactive channel, group by identity and source, and look for durable zero-failure refresh behavior.

## Detection Worked. Response Did Not.

The investigation found four high-severity Defender XDR alerts tied to device-code phishing infrastructure before the interactive escalation. They went unactioned for weeks.

That is the most important operational failure in the case.

The security product detected the campaign. The organization did not have a response function that converted the alert into investigation and containment. Eventually, automated disruption stopped the interactive activity about 18 minutes after escalation, but the earlier dwell time was preventable.

Detection without an enforced response path is decoration.

For a small business, the fix is not necessarily a 24x7 internal SOC. It can be:

```text
High-severity identity alert
  → notify a named owner and backup
  → create an incident automatically
  → run a fixed evidence-collection checklist
  → disable/revoke when predefined conditions are met
  → escalate to an external responder if not acknowledged in 15 minutes
```

The process must exist before the alert arrives.

## What We Could Safely Conclude

The squad confirmed:

- a privileged cloud identity was compromised;
- the attacker maintained a token path for at least 24 days;
- device-code phishing/token replay was the leading root cause;
- the attacker registered a device after interactive escalation;
- identity controls automatically disrupted the escalation in about 18 minutes;
- responder actions revoked credentials and removed the attacker device; and
- no Azure Resource Manager activity occurred during the compromise day across the reviewed scopes.

The last finding was a **confirmed negative**, not a missing-data assumption. The Azure collector first proved it had working access, queried the complete scope and retention window, verified activity on adjacent days, and only then treated zero events on the incident day as evidence of no Azure control-plane action.

The squad did **not** conclude:

- that the entire tenant was clean;
- that Exchange, SharePoint, OneDrive, or Teams data was untouched;
- that endpoint activity was absent;
- that every risky application grant was attacker-created; or
- that STORM-3052's national sponsor was known.

The final wording was deliberately scoped: **contained at the identity and Azure resource planes with high confidence; whole-tenant clean not established.**

## What I Told the Owner to Do

The report prioritized remediation by time, not by product.

### In the first 24 hours

1. Verify complete session and refresh-token revocation.
2. Verify removal of every attacker-registered device.
3. Block or tightly restrict device-code flow for privileged accounts.
4. Require phishing-resistant authentication for administrators.
5. Remove unjustified administrator exclusions from Conditional Access.
6. Preserve evidence before identity and deleted-object retention expires.

### Within 7 days

1. Complete the Microsoft 365 Unified Audit Log investigation.
2. Review high-impact OAuth grants and vendor integrations.
3. Remove unnecessary standing privilege and excessive partner access.
4. Document and test emergency-access account controls.

### Within 30 to 90 days

1. Centralize identity, Azure, M365, and endpoint telemetry in a SIEM.
2. Retain privileged identity telemetry for at least 180 days.
3. Use PIM/JIT instead of standing Global Administrator.
4. Require compliant, managed devices for administrative access.
5. Alert on unusual non-interactive refresh cadence and scripted clients.
6. Create an SLA-backed high-severity identity response playbook.

These are not "AI recommendations." They are ordinary security fundamentals prioritized against observed evidence. AI made the collection, correlation, challenge, and documentation faster.

## How This Changes the Defender-vs.-Attacker Equation

AI lowers the cost of offensive scale. An operator can generate lures, vary infrastructure, automate token handling, summarize stolen data, and coordinate campaigns faster than before. Defenders cannot answer that with one person clicking through six portals and copying timestamps into a spreadsheet.

The answer is not to hand an AI agent production credentials and walk away.

The answer is to give defenders a governed team that can:

- collect independent evidence streams in parallel;
- apply reusable skills for Graph, KQL, OAuth, and Azure;
- maintain a shared decision trail;
- stream and summarize datasets too large for manual inspection;
- test competing hypotheses instead of polishing the first one;
- route contradictions to a synthesizer;
- require a separate reviewer for consequential claims; and
- keep a human accountable for containment, disclosure, and closure.

This engagement compressed the mechanical work enough that I could spend my time on the parts that actually required judgment: access, scope, confidence, owner communication, and deciding what the evidence justified.

That is how defenders address AI-enabled threat actors: not by removing humans, but by removing the serial bottlenecks around them.

## A Copy-Paste Template for Your Own AI-Assisted IR

This prompt is intentionally tool-agnostic. It works as a checklist even if your AI tier cannot run multiple agents in parallel:

```text
You are assisting a human incident responder.

Scope:
- Read-only investigation of a suspected privileged cloud identity compromise.
- Do not remediate without explicit human approval.
- Do not persist secrets, tokens, customer identifiers, or raw evidence in source control.

Required work:
1. Inventory available evidence and explicitly list unavailable sources.
2. Build separate collections for identity, token/protocol, applications,
   directory objects, cloud control plane, M365 data plane, and endpoints.
3. Label every conclusion FACT, JUDGMENT with confidence, or UNKNOWN.
4. Pre-register competing initial-access hypotheses and discriminating evidence.
5. Treat collection failure as lack of visibility, never as absence of activity.
6. Independently verify all material counts and containment claims.
7. Record retractions when evidence disproves an earlier conclusion.
8. Scope the eviction verdict to the planes actually examined.
9. Produce an executive summary, technical timeline, root cause,
   containment assessment, evidence gaps, and prioritized recommendations.
10. Redact tenant IDs, domains, user names, IPs, device IDs, app IDs,
    session IDs, customer names, and partner identities from publishable output.

Human approval gates:
- account disablement or token revocation
- device deletion
- Conditional Access changes
- external notification
- final containment/closure statement
```

If your tool supports parallel agents, split the evidence planes. If it does not, run the lanes sequentially and keep the same reviewer gate. The quality model matters more than the orchestration feature.

## What This Cost

- **SecOps Squad source build:** The starter kit's `COST.md` estimates **$12–15 API-equivalent** to build 96 core skills, six personas, CLI tooling, and documentation. Its current public distribution has expanded to 847 skills. The ledger arithmetic is consistent: approximately $10.74 of Sonnet-tier work plus $1.75 of Haiku-tier work yields about $12.49, within the stated range.
- **This IR session:** The toolkit estimates a heavy incident-response session at **$5–10 API-equivalent**, covered by the GitHub Copilot subscription in this case. That is a planning estimate, not exact metering.
- **This post's production:** approximately **$1.00** — research (~$0.40), drafting (~$0.30), and review/redaction (~$0.30).

The economic comparison is not "AI versus a consultant." I was still the responder, and the owner still needed a responsible human. The comparison is a human responder with a serial toolchain versus a human responder directing a persistent, parallel, reviewable AI team.

## The Bottom Line

The restaurant did not need a futuristic autonomous SOC. It needed a trustworthy answer before another business day passed.

AI acceleration made that possible, but speed was not the best result. The best result was that the team challenged its own narrative, removed a false IOC, retracted an unsupported initial-access theory, and refused to call unexamined systems clean.

That is the bar for AI in incident response: **faster evidence, stronger challenge, explicit uncertainty, and a human still accountable for the call.**
