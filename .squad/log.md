# Squad Batch Log

## 2026-09-14 — Batch Completion Record

**Batch Owner:** Scribe (documentation specialist)  
**Requestor:** John Spaid  
**Session:** x3nc0n-sturdy-pancake  
**Branch:** x3nc0n-ios-app-publishing  

### Completed Work Items

#### 1. Issue #15 Triage — LingoPop Privacy Policy (Trinity)
**Status:** CLOSED  
**Agent:** Trinity  
**Decision:** Issue #15 prioritized as P0 blocker for iOS app publishing.  
**Rationale:** Privacy URL mismatch (LingoPop vs. Sight Word Phrases) creates App Store compliance risk; other open issues (#3, #7, #8, #9) are blog/LinkedIn work and do not block publishing.  
**Outcome:** Triaged and routed to Switch for implementation.

#### 2. LingoPop Privacy Policy Implementation (Switch)
**Status:** COMPLETE  
**Agent:** Switch  
**Artifact:** `privacy-policy.html` (commit 4311dd1)  
**Date Completed:** 2026-09-14T20:57:00-05:00  

**What was implemented:**
- Consolidated Sight Word Phrases (Android) and LingoPop (iOS) policies into single HTML file with navigation.
- LingoPop section: offline, no tracking, no accounts, no analytics; local storage only (game progress, preferences, stats).
- System sharing explanation: app does not retain shared content.
- Permissions clarity: LingoPop requests NO sensitive permissions (mic, camera, location, contacts).
- Contact links: GitHub issues for each app.
- Last-updated dates: LingoPop 2026-09-14, SWP 2026-04-30 (preserved).

**Key decisions recorded:**
- Single-file multi-app policy avoids URL fragmentation.
- Negative framing ("does NOT collect") safer than overpromises.
- Separate date-updated per app allows independent future updates.
- h2/h3 heading hierarchy for screen reader navigation.

**Validation:**
- HTML structure verified (DOCTYPE, closing tags, attributes).
- No secrets or invented URLs.
- All links point to maintained repos (x3nc0n/lingopop-ios, x3nc0n/sight-word-phrases-app).
- Tone: cautious, specific, consistent with existing policy voice.

**Next gate:** Release decision awaits Trinity approval before App Store submission.

### Archived Inbox Decisions

The following inbox decisions have been merged into the main `decisions.md` and removed from the inbox:

1. **`decisions/inbox/trinity-ios-triage.md`** — Merged as Section: "Issue #15 Triage — LingoPop Privacy Policy (Trinity, 2026-09-14)"
2. **`decisions/inbox/switch-lingopop-privacy.md`** — Merged as Section: "LingoPop Privacy Policy Integration Decision Log (Switch, 2026-09-14)"

Both maintain full detail and decision rationale in the main decisions record.

### Summary

This batch records the successful completion of issue #15 (LingoPop privacy policy) by Switch, with Trinity triage directing the work. The privacy policy is now app-specific, compliance-aligned, and ready for iOS publishing gate review.
