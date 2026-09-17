# Switch — History

## Project Context
- **Project:** x3nc0n.github.io — "Spaid on Security" Jekyll blog by John Spaid.
- **Campaign:** 12+ post series on AI-accelerated DevSecOps from real GitHub work; cadence 2-3/week for a month+.

## Voice Reference
- Gold-standard style sample: `_posts/2026-05-02-Project-Glasswing-and-Mythos.md` — study its hook, H2 structure, embedded code blocks, numbered takeaways, and confident closing.
- Site: title "Spaid on Security", url https://www.spaid.dev, theme minima, jekyll-feed.

## Learnings

### 2026-08-03 — Device Code Phishing post (Midnight Blizzard / Storm-2372)

**File written:** `_posts/2026-08-04-Stopping-Midnight-Blizzard-Device-Code-Phishing.md`
**Word count:** ~2,500 words
**Source:** Full existing draft from session-state paste file + John's verbal IR anecdote briefing.

**What I did:**
- Opened with an anonymized restaurant IR anecdote as the hook—emphasizing the contrast between Attack Disruption's fast interactive-session eviction (under 18 minutes) and the investigative gap caused by dwell time exceeding 30-day log retention.
- Wove SecOps Squad (https://github.com/x3nc0n/secops-squad-starter-kit) and the Squad SOC post naturally into intro and takeaways as the enabling tooling for same-day small-business IR.
- Used the dwell-time-vs-retention theme as the explicit narrative spine connecting the anecdote to the "Designing for long-dwell-time intrusions" section.
- Converted dry draft prose into John's first-person, opinionated, practitioner-to-practitioner voice throughout.
- Preserved ALL KQL queries, tables, numbered detection approaches, persistence hunting checklists, and the 12-step response list verbatim.
- Added AI cost section (blog production only, ~$1.00, no source-repo to cite).
- Added "What to Steal" numbered takeaway close (7 items) explicitly calling out the restaurant lessons.
- Frontmatter: `linkedin_promote: true`, `linkedin_promote_date: 2026-08-04` (Tuesday, per engagement schedule).

**Key structural decisions:**
- Kept "Why device code phishing works" as first technical H2 (after intro)—the anecdote hooks the reader, then the mechanism explains the how.
- Did NOT insert the anecdote mid-article or at the close; full hook value comes from opening cold with the restaurant story.
- "Designing for long-dwell-time intrusions" section explicitly calls back to the opening anecdote—this was the requested narrative spine, so I made the callback direct and explicit rather than implied.
- "What to Steal" takeaways supplement rather than duplicate the "Final recommendations" section—the former is actionable and voice-y, the latter is the clean reference list.


- Posts use `categories:` (space-separated) in frontmatter, plus a `description:`.
- Code blocks are central to the format — never write a technical post without real, repo-sourced snippets.
- Post #2 (2026-07-01, ALZ as Code): The brief's DO-NOT-PUBLISH list is critical — all GUIDs from `parameters.json` and tenant IDs must be replaced with `<sub-id>` / `<tenant-id>` placeholders before publishing. The research brief marks synthesized quotes with a "verify with John before publishing" note — flag these in the draft or omit them; do not publish unverified quotes as fact.
- The Glasswing post uses a flat numbered-H2 structure; technical deep-dives (like ALZ) benefit from H2 topic sections with a strong closing "what to steal" takeaway list. Both patterns work in John's voice — match the structure to the content type.
- AI-acceleration framing: be concrete (name the commits, name the artifacts) but honest ("10 minutes vs 45 minutes" is illustrative, not a hard metric). The audience trusts specificity over marketing language.
- **Post #01 written 2026-06-30:** `_posts/2026-06-30-Shipping-Security-at-Machine-Speed.md` — series kickoff/manifesto, ~1,150 words.
  - Voice choices: opened by referencing the Glasswing post (existing content, doesn't repeat it), then pivoted immediately to first-person practitioner narrative. Used two concrete artifacts from the research briefs (ALZ 21-module path-filter gating, OIDC-no-stored-secrets) as proof of real work without going deep — depth is reserved for Posts 02+.
  - Series preview written as an enticing numbered narrative map, not a dry TOC — each entry has a hook detail to make readers want the full post.
  - Honest AI limitations section: drew a clear line between "AI handles scaffolding" and "human makes security calls." This is the trust-building move for a practitioner audience.
  - Closed with RSS + LinkedIn follow CTA per the promotion conventions in copilot-instructions.md.
  - Redaction: all subscription and tenant IDs omitted; Spava-Corp referenced only as "demo org."
  - Squad framework referenced as open-source + accessible on any Copilot tier — per audience rules (no premium gating assumption).

### 2026-09-14 — LingoPop iOS Privacy Policy (Issue #15)

**File updated:** `privacy-policy.html`

**What I did:**
- Converted single-app privacy policy to multi-app policy with separate sections for LingoPop and Sight Word Phrases.
- Added LingoPop section that covers:
  - Offline iOS puzzle game, no accounts/analytics/ads/tracking/third-party services.
  - Local data: game progress, preferences, statistics, outcomes stored in app sandbox only.
  - System sharing: optional, user-controlled, app doesn't retain shared content.
  - No sensitive permissions requested (no microphone, camera, location, contacts, etc.).
  - Data deleted when app is uninstalled; future versions may add in-app reset.
  - LingoPop contact link → x3nc0n/lingopop-ios GitHub issues.
- Kept Sight Word Phrases section intact with Android-specific details (microphone/speech recognition, Vosk, Jetpack/Room).
- Preserved SWP contact link to x3nc0n/sight-word-phrases-app.
- Updated title to "Privacy Policies — spaid.dev Apps" and added in-page navigation (jump links).
- Applied consistent heading hierarchy: h2 for app sections, h3 for topics, h4 for permission sub-topics.
- Last-updated dates: LingoPop 2026-09-14, SWP 2026-04-30 (preserved).

**Key structural decisions:**
- Two-app policy on single page was clearer than separate files; navigation div helps readers find their app.
- Explicitly stated what LingoPop does NOT do (no microphone, tracking, accounts) to align with App Store privacy labeling.
- System sharing section was critical—addressed issue concern that "optional" features need clear explanation that app doesn't retain shared data.
- Contact links point to GitHub issues, not email, consistent with repo maintenance model.
- Legal language: cautious and specific ("You can remove...by uninstalling the app") rather than generic consent.

**Validation:**
- HTML structure verified (doctype, head/body closure, attribute syntax).
- No secrets or invented URLs; all links point to maintained repos.
- Tone matches existing Sight Word Phrases policy; no invented legal claims.
