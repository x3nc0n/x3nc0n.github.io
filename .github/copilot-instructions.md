# Copilot / Agent Instructions — spaid.dev blog

Standing instructions for anyone (human or AI agent) working in this repository.

## Publishing & Promotion Workflow (standing instruction)

When a blog post is authored (or has been authored), follow this workflow **every time**:

1. **Publish to the blog first.** Add the post under `_posts/YYYY-MM-DD-Title.md` with proper Jekyll front-matter (`layout: post`, `title`, `description`, `categories`). The blog is the source of truth; LinkedIn points back to it.
2. **Then promote on LinkedIn**, automatically, via the GitHub Actions in this repo (`.github/workflows/promote-to-linkedin.yml` + the scheduled companion). Promotion is driven by post front-matter — no manual posting.
3. **Schedule for maximum engagement on a US-based audience.** This is the default; don't over-engineer it.

### Engagement-optimized schedule (research-backed default)

Based on 2026 LinkedIn engagement data for US audiences:

- **Best days:** Tuesday, Wednesday, Thursday (Tuesday strongest).
- **Best time:** 8:00–10:00 AM in the audience's local time. **Default: 9:00 AM America/New_York (ET).**
- **Avoid:** afternoons, Fridays, weekends, evenings.

**Default behavior for the promotion Action:**
- If a post sets `linkedin_promote_date:` (date only), promote at **09:00 ET** on that date.
- If a post sets `linkedin_promote: true` with no date, promote at the **next upcoming Tue/Wed/Thu 09:00 ET**.
- A committed ledger ensures each post is promoted **exactly once** (no double-posts).

### Post front-matter fields for promotion

```yaml
---
layout: post
title:  "Your Title"
description: "One-line description"
categories: security devsecops azure
linkedin_promote: true            # opt in to auto-promotion
linkedin_promote_date: 2026-07-07 # optional; defaults to 09:00 ET on this date
linkedin_blurb: "Optional custom LinkedIn text; otherwise auto-generated."
---
```

## Audience & content conventions

- Write for a **general practitioner audience**. Do **not** assume readers have unlimited/premium GitHub Copilot. Provide copy-paste templates that work regardless of AI tier.
- Voice: first-person, opinionated, technical, code-block-heavy ("Spaid on Security"). See `_posts/2026-05-02-Project-Glasswing-and-Mythos.md` as the style reference.
- Never publish secrets, tokens, or real customer identities. Spava-Corp is a demo org — safe to describe, but still redact anything sensitive.

## Secrets (never commit)

LinkedIn promotion needs repo secrets: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REFRESH_TOKEN`, optional `LINKEDIN_PERSON_URN`. See `docs/linkedin-promotion.md`. Until these are set, the Action is a safe no-op.
