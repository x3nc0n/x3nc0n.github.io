# Copilot Instructions – Spaid on Security

## Blog Identity

This is **Spaid on Security** (`spaid.dev`), a personal cybersecurity blog by **John Spaid** — Principal Technical Specialist at Microsoft (Security, Compliance, and Identity) and Customer Experience Leader for Oil, Gas, and Energy at Microsoft.

John's background includes:
- Microsoft Sentinel, Defender XDR, Entra ID, Microsoft Purview, Defender for Cloud
- Oil & Gas / Energy sector operational technology (OT) security
- Former Police Sergeant (OCPD) and EMT — brings a practitioner's mindset to security
- Community involvement: InfraGard Oklahoma, Oklahoma security community
- Based in Edmond, OK

---

## Site Technical Details

- Jekyll 4.3.x static site, `minima` theme, hosted on GitHub Pages
- Posts live in `_posts/` with filename format `YYYY-MM-DD-title-with-hyphens.md`
- Required front matter fields: `layout: post`, `title`, `description`, `date`, `tags`
- Code blocks use fenced syntax with language identifiers (`kusto`, `bash`, `powershell`, `yaml`, etc.)
- The `_site/` directory is generated output — never edit it directly
- Images go in `assets/img/`; reference in front matter as `img: filename.ext`

---

## Writing Style and Voice

- **Tone:** Direct, technically precise, opinionated but evidence-based
- **Audience:** Security practitioners and IT professionals familiar with Azure and Microsoft 365 tooling
- **Do:** Use complete, runnable KQL/code examples with inline comments for non-obvious logic
- **Do:** Link to official Microsoft docs (`learn.microsoft.com`; use `aka.ms` short links when available)
- **Do:** Include a practical "try it yourself" or takeaway section where relevant
- **Do:** Cite CVE numbers, MITRE ATT&CK techniques, or CISA advisories when discussing specific threats
- **Do not:** Use marketing language or jargon without explanation
- **Do not:** Fabricate KQL output, log samples, or threat data — note when examples are illustrative
- **Responsible disclosure:** When discussing vulnerabilities, always document the disclosure timeline and vendor response

---

## Content Focus Areas

Posts on this blog have covered and should continue to focus on:

1. **Microsoft Sentinel / Defender XDR** — KQL analytics rules, ASIM normalization, detection engineering, CI/CD for sentinel content, hunting queries
2. **Entra ID (Azure AD) security** — Service principal hardening, Conditional Access, identity detections
3. **Microsoft security product updates** — Curated Ignite/Build/Secure announcements relevant to practitioners
4. **Azure / cloud security** — Defender for Cloud, Azure Policy, Zero Trust architecture
5. **OT/ICS and Energy sector security** — Relevant to John's current Microsoft role
6. **Authentication and access** — MFA, FIDO2/passkeys, SSH hardening, certificate-based auth
7. **Home and community network security** — Approachable how-tos for the broader community
8. **Responsible disclosure** — Documenting findings and disclosure processes involving local/regional organizations
9. **AI and security** — Security implications of AI tools, Copilot for Security, LLM threat vectors

---

## Post Front Matter Template

When generating a new post, use this template:

```yaml
---
layout: post
title: "Title of Post"
description: "One-sentence description for feed readers and SEO"
date: YYYY-MM-DD HH:MM:SS -0600
tags: tag1 tag2 tag3
---
```

---

## KQL Style Conventions

Based on existing posts in this repo:

- Use `let` statements to define sub-tables with descriptive names (`ipNew`, `ipHistory`, `threshold`)
- Add a comment line above each `let` block explaining what it computes
- Use `imAuthentication`, `imFileEvent`, and other ASIM normalized parsers rather than raw table names where possible
- Default lookback: `30d` history, `1d` detection window (adjust per use case)
- Prefer `leftanti` join for "new/never-seen-before" detection patterns
- Include tuning notes (e.g., watchlist references) in comments when a rule could be noisy

---

## What to Avoid

- Do not suggest adding analytics or tracking scripts beyond what minima provides
- Do not modify `Gemfile.lock` manually — use `bundle update`
- Do not commit the `_site/` directory — it is excluded via `.gitignore`
- Do not create posts that are purely promotional for Microsoft products without a practical security takeaway
- Do not include personal contact information beyond what is already in `_config.yml`
