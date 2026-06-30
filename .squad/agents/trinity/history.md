# Trinity — History

## Project Context
- **Project:** x3nc0n.github.io — "Spaid on Security" blog by John Spaid (Microsoft CX Leader, Oil/Gas/Energy).
- **Campaign:** 12+ post series on AI-accelerated DevSecOps from real GitHub work.

## Domain Map (what each repo demonstrates)
- **Azure Landing Zones as code:** alz-mgmt, homeschool-hero-azure, deepseismic2-infra (Bicep, CI/CD: infra-ci/plan/deploy workflows, OIDC).
- **SecOps as code:** alz-sentinel (analytics rules, hunting, workbooks, playbooks), secops-squad (AI agent SecOps).
- **Data protection as code:** purview-information-protection-as-code (labels, DLP, auto-labeling, SQL classification).
- **Identity:** entra-verifiedid-example/deploy (Verified ID, PRMFA/passkeys), ConditionalAccessDocumentation.
- **Zero-trust network:** azure-afd-apim-private-demo (AFD+WAF → APIM Private Link → AKS).
- **Edge security:** aio-security (Azure IoT Operations, diagnostic settings, policy, compliance).
- **AI governance/capacity:** alz-security-copilot (SCU capacity), jospaid-helios-core-azureopenai.
- **Cost/ops governance:** alz-startstopv2.
- **Agent framework:** squad (TypeScript AI agent teams).

## Learnings
- Spava-Corp ALZ repos follow a strong convention: Bicep under `bicep/`, env configs under `environments/`, root `COST.md` + `README.md`, `scripts/`+`docs/`, workflows `infra-ci.yml`/`infra-plan.yml`/`infra-deploy.yml`, OIDC values as GitHub Secrets.
- Audience is senior security/cloud practitioners — avoid hand-waving, cite real mechanisms.

### 2026-06-29 — LinkedIn auto-promotion workflow

**Built:** `promote-to-linkedin` GitHub Actions workflow + Node.js helper script.

**Deliverables created:**
- `.github/workflows/promote-to-linkedin.yml` — triggers on push to `main`/`master` when `_posts/**` changes; guard step exits 0 if secrets not configured; PR runs are dry-run only.
- `scripts/promote-to-linkedin.mjs` — Node 20, zero external deps, `--dry-run` mode. Handles refresh-token exchange, person URN resolution, Posts API call.
- `docs/linkedin-promotion.md` — full setup guide: app registration, OAuth dance, secret names, token lifetime notes.

**Key design decisions:**
- **Guard-first safety:** the workflow checks `LINKEDIN_REFRESH_TOKEN` and `LINKEDIN_ACCESS_TOKEN` via env-var indirection (never inline `${{ secrets.X }}` in an `if:`). If both are empty, log friendly message and `exit 0`. Build never fails on missing config.
- **Refresh-token strategy:** store the ~365-day refresh token; the script exchanges it fresh on each run. Static access token is a fallback for manual/legacy setup. The refresh token never touches logs (passed via env, GitHub masks it).
- **Person URN caching:** optional `LINKEDIN_PERSON_URN` secret skips a `/v2/userinfo` round-trip on every run.
- **URL derivation:** `/{YYYY}/{MM}/{DD}/{slug}.html` from filename — Jekyll default `date` permalink. Code comment documents where to change if permalink is customised.
- **Hashtags:** derived from front-matter `categories`, max 5, stripped to alphanumeric. Blurb is human-readable, not spammy.
- **Fork/PR safety:** `if:` condition on the job skips fork PRs explicitly; PR runs from same-repo branches get dry-run mode.
- **No README at repo root** — skip the README section per task spec.
- **LinkedIn API version pinned to `202506`** (current at time of build).

### 2026-06-29 — Scheduled LinkedIn promotion workflow

**Built:** `promote-scheduled.mjs` script + `promote-to-linkedin-scheduled.yml` workflow + docs update.

**Deliverables created:**
- `scripts/promote-scheduled.mjs` — Node 20, zero external deps. Scans `_posts/`, checks `linkedin_promote_date` against today in `America/New_York`, reads the dedup ledger, posts due items to the LinkedIn Posts API, appends ledger entries. Supports `--dry-run`. Guard exits 0 if both `LINKEDIN_REFRESH_TOKEN` and `LINKEDIN_ACCESS_TOKEN` are absent.
- `.github/workflows/promote-to-linkedin-scheduled.yml` — cron `0 12-15 * * 2-4` (8–11 AM ET Tue–Thu); `workflow_dispatch` with boolean `dry_run` input; `permissions: contents: write`; `concurrency: linkedin-scheduled, cancel-in-progress: false`; commits ledger with `[skip ci]` after any successful posts.
- `docs/linkedin-promotion.md` — added "Scheduled / front-matter-driven promotion" section covering the three front-matter fields, exactly-once cron+ledger mechanism, dry-run via workflow_dispatch, one-time secret setup reference, and GitHub Pages future-dated rollout note.

**Key design decisions:** See `.squad/decisions/inbox/trinity-li-schedule.md`.

**Reviewed:** `2026-06-30-Shipping-Security-at-Machine-Speed.md` (Post 1) and `2026-07-01-Azure-Landing-Zones-as-Code.md` (Post 2).

**Verdict:** APPROVED-WITH-EDITS.

**Redaction pattern learned:** The `post-02-alz.md` research brief contains a `parameters.json` block with real subscription GUIDs and a tenant ID (`ef4ecf0b-...`). The scribe correctly excluded these from the published post — only the management group ASCII tree and sanitized YAML snippets were included. The DO-NOT-PUBLISH list in the brief is the canonical gate; cross-check every research brief for one before approving any ALZ-series post.

**Security baseline confirmed:** All ALZ workflows use OIDC (`azure/login@v2` + `id-token: write`). No `AZURE_CREDENTIALS` JSON appears in any published snippet. This is the standing security pattern for this blog series — if a post ever references Azure auth and shows anything other than OIDC, that's a red flag.

**AI claims framing:** Acceleration claims (e.g., "45 minutes → 10-15 minutes") are personal anecdote, not hard metrics. Acceptable under the audience conventions. The research brief's quotable "10 minutes / verify with John" is a scribe note, not a publication blocker.

**Forward-looking claim to track:** Post 1 references a "14-day dynamic baseline" and ".NET KQL validator" for the Sentinel post. Verify these against the Sentinel research brief when that post is drafted.
