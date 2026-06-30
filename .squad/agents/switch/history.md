# Switch — History

## Project Context
- **Project:** x3nc0n.github.io — "Spaid on Security" Jekyll blog by John Spaid.
- **Campaign:** 12+ post series on AI-accelerated DevSecOps from real GitHub work; cadence 2-3/week for a month+.

## Voice Reference
- Gold-standard style sample: `_posts/2026-05-02-Project-Glasswing-and-Mythos.md` — study its hook, H2 structure, embedded code blocks, numbered takeaways, and confident closing.
- Site: title "Spaid on Security", url https://www.spaid.dev, theme minima, jekyll-feed.

## Learnings
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
