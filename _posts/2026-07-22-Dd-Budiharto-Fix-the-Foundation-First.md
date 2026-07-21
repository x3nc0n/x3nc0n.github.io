---
permalink: /2026/07/22/Dd-Budiharto-Fix-the-Foundation-First.html
layout: post
title:  "Dd Budiharto's OT Security Rule: Fix the Foundation First"
description: "My colleague Dd Budiharto has a line every energy-security team should tattoo onto its modernization backlog: before you pile on AI, cloud, or shiny OT tooling, fix the identity, patching, and IT/OT operating model underneath it."
categories: security energy ot identity critical-infrastructure modernization
linkedin_promote: true
linkedin_promote_date: 2026-07-22
linkedin_blurb: "Tomorrow on Spaid on Security: a shout-out to my colleague Dd Budiharto and the most important OT-security advice in the room — fix the foundation first. If you're modernizing energy infrastructure, start with identity hygiene, controlled change, and an IT/OT operating model both sides can live with."
---

# Dd Budiharto's OT Security Rule: Fix the Foundation First

I'm going to take a one-post detour from my AI-agent series to point you at my colleague **Dd Budiharto** and a message I wish more cloud people would hear before they go anywhere near an operations network.

Dd is Microsoft's Customer Security Officer for Oil, Gas, and Energy and a former industry CISO, which is why her framing lands so cleanly for me: it comes from somebody who has owned the blast radius, not just diagrammed it.

In her recent *Hack the Plant* appearance — [**"Bridging the IT/OT Divide in Oil & Gas"**](https://securityandtechnology.org/podcast/episode-49/) — Dd lands on a line that is more or less the whole problem statement for modern energy security:

> *If you want to upgrade your home, to modernize it, the foundation still needs to be fixed first.*

That's it. That's the post.

Okay, not really. But it **is** the right frame. A lot of modernization work in critical infrastructure gets sold as if the hard part is choosing the right AI feature, cloud pattern, or shiny dashboard. Usually it isn't. Usually the hard part is that the environment underneath still has identity drift, exception-riddled patching, unclear ownership between IT and OT, and basic account hygiene problems nobody has truly solved. Dd's point is that you do not get to skip that layer just because the modernization deck is prettier now.

## The Part Cloud People Underestimate

In IT, we say things like "just patch it," "just rotate the account," or "just enforce MFA" because the blast radius is mostly confined to business systems. In OT, "just" is how you accidentally create a plant outage.

Dd's background is exactly why I pay attention here: she has seen this from the inside at actual energy companies, not from a whiteboard. When she talks about the IT/OT divide, she isn't describing an abstract architecture pattern. She's describing two groups that optimize for different failure modes:

- **IT** worries about confidentiality, speed, standardization, and broad control coverage.
- **OT** worries about safety, uptime, process integrity, and never making an unplanned change to a live industrial system.

If you bring an IT-only mindset into that environment, you'll produce security controls nobody in operations trusts. If you ignore security altogether, you'll keep the lights on right up until somebody else turns them off for you. The winning move is not "pick a side." It's to build an operating model that respects both.

## Three Things Dd Gets Exactly Right

### 1. "Basic hygiene" is only basic if you can do it every time

One of the sharpest points in the episode is that even very large organizations still struggle with simple identity hygiene — including disabling terminated accounts reliably. That's not a beginner mistake. That's a signal that the foundation is cracked.

If an environment cannot prove:

- who still has access,
- which accounts are shared,
- how vendor access is approved,
- how fast offboarding actually happens, and
- whether privileged access is bounded in time,

then the right next step is probably **not** "add more AI to SOC triage." The right next step is to fix identity lifecycle discipline first.

### 2. OT patching is change control, not Patch Tuesday

Cloud and enterprise teams love velocity. OT teams love not breaking compressors, pumps, turbines, safety systems, and everything else the rest of society quietly depends on.

That means patching in OT is not a moral referendum on whether the operators "care about security." It's a scheduling, testing, and safety problem. Dd's career lesson about a patch-driven reboot matters because it encodes the real rule: in industrial systems, an unsafe or badly timed change can be worse than a delayed change.

So the mature question isn't "why haven't you patched faster?" It's:

- What compensating controls exist until the patch lands?
- What maintenance window is realistic?
- What has been validated in a representative test environment?
- Who owns rollback if the change destabilizes the process?

That's what "foundation first" looks like in practice.

### 3. The IT/OT divide is as much social as technical

This is the piece most slide decks flatten. You do not bridge IT and OT with a Visio diagram. You bridge it with trust, shared change processes, and security language both sides can live with.

If the IT team sounds like it wants to spray policy on everything from a distance, OT will route around it. If OT treats every security request as unrealistic theater, risk accumulates until it becomes everybody's problem. Dd's value is that she talks in a way that makes each side legible to the other. That translation layer is real work.

## A Copy-Paste Modernization Gate

Because I promised this blog would stay useful to general practitioners, here's the short version I'd steal before funding another "secure modernization" initiative in energy:

```text
Before we modernize this OT environment, can we prove:

1. Identity hygiene:
   - terminated users lose access quickly
   - vendor access is approved, time-bounded, and reviewed
   - privileged access is not shared or permanent by default

2. Change safety:
   - patches have a defined maintenance path
   - rollback owners are named
   - compensating controls exist for deferred fixes

3. IT/OT operating model:
   - one forum exists where both teams approve risky changes
   - incident ownership is explicit at the IT/OT boundary
   - exceptions are documented, dated, and revisited
```

That's not glamorous. That's why it works.

## Why I'm Promoting This One

I spend a lot of time on this blog talking about AI-accelerated DevSecOps, GitHub-native workflows, and secure cloud delivery. I believe in all of that. But if you're in oil, gas, power, or another critical-infrastructure sector, Dd's reminder is the necessary counterweight: **acceleration without foundations is just faster drift.**

If you're building roadmaps for cyber modernization in energy, listen to the episode first:

- [Hack the Plant — Bridging the IT/OT Divide in Oil & Gas](https://securityandtechnology.org/podcast/episode-49/)

Then go look at your identity lifecycle, your patch exception book, and the room where IT and OT actually argue about change. That's the substrate every "AI for security" story still depends on.

## What This Cost to Build (and Write)

- **Source material build cost:** **$0 / not applicable.** This post is promoting a public podcast appearance, not a software repo, so there is no source `COST.md` to validate and no upstream build artifact to cost.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). I kept this bounded and non-recursive; I'm not counting the cost of calculating the cost.

## What to Steal

1. **Treat identity hygiene as industrial safety, not admin cleanup.**
2. **Ask OT patch questions in the language of change control and rollback, not shame.**
3. **Build one real decision forum at the IT/OT boundary.** Not two parallel ones.
4. **Make modernization pass a foundations gate first.** AI and cloud can wait a week; brittle fundamentals cannot.
5. **Listen to practitioners who have owned the blast radius.** Dd has.

That's why I'm happy to promote her work here. The tools change. The hype changes. The foundation still decides whether the rest of it stands up.

*Next: back to my playthings — two separate AI Squads, one owning the app repo and one owning the infra repo, collaborating entirely through GitHub Issues to ship a cloud-native seismic ML demo.*
