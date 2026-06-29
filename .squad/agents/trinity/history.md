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
