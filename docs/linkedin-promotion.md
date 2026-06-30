# Setting Up LinkedIn Post Promotion

This guide walks you through arming the `promote-to-linkedin` GitHub Actions workflow so that every new post you push to `_posts/` is automatically shared on your LinkedIn personal profile.

> **Security first:** Everything in this guide that looks like a credential is a **GitHub repository secret**. Never commit tokens, client secrets, or refresh tokens to source control.

---

## How it works

1. You push a new `_posts/YYYY-MM-DD-slug.md` file to `main`/`master`.
2. The workflow detects the added file using `git diff --diff-filter=A`.
3. `scripts/promote-to-linkedin.mjs` exchanges your refresh token for a short-lived access token, resolves your person URN, and `POST`s to the LinkedIn Posts API.
4. The post appears on your LinkedIn feed as a personal share (not a company page post).

On **pull requests** the script runs in `--dry-run` mode: it prints exactly what would be posted but makes zero API calls. You can verify the output before merging.

---

## Scheduled / front-matter-driven promotion

In addition to the on-push workflow, a second workflow (`promote-to-linkedin-scheduled.yml`) runs on a cron and posts any blog posts whose scheduled date has arrived — with no human in the loop.

### Front-matter fields

Add these to any `_posts/YYYY-MM-DD-slug.md` you want auto-promoted:

```yaml
linkedin_promote: true              # required — opt in; absence means "do not auto-promote"
linkedin_promote_date: 2026-07-07   # optional — YYYY-MM-DD; promote on or after this date
linkedin_blurb: "Custom text here." # optional — overrides the auto-generated commentary
```

| Field | Behaviour when absent |
|---|---|
| `linkedin_promote` | Post is ignored by the scheduler |
| `linkedin_promote_date` | Post is promoted on the next scheduled cron run (Tue/Wed/Thu, 8–11 AM ET) |
| `linkedin_blurb` | Commentary is auto-built from `title`, `description`, `categories` hashtags, and the canonical URL |

### How the cron and ledger give exactly-once posting

1. The cron fires hourly between **12:00–15:00 UTC (8–11 AM ET) on Tue/Wed/Thu** — the research-backed US peak window.
2. Each run scans `_posts/` and compares `linkedin_promote_date` against today in `America/New_York`.
3. Before posting, the script checks `_data/linkedin_promoted.yml` (the ledger). Any slug already in the ledger is skipped.
4. After a successful LinkedIn post, the script appends `{slug, post_url, promoted_at, linkedin_post_id}` to the ledger and the workflow commits + pushes just that file with a `[skip ci]` message.
5. Result: a post authored today with `linkedin_promote_date: 2026-07-08` will post automatically at the first cron run on or after July 8 — and never again.

### Dry-run via `workflow_dispatch`

Go to **Actions → Promote to LinkedIn (Scheduled) → Run workflow** and set **Dry run** to `true`. The script will parse all posts, print exactly what would be posted to LinkedIn (including the full commentary), and exit without making any API calls or writing the ledger. Use this to verify blurb, URL, and hashtag output before a scheduled date arrives.

### One-time secret setup

Same secrets as the on-push workflow — see [Step 3 — Set repository secrets](#step-3--set-repository-secrets) below. No additional secrets are required. The scheduled workflow is a safe no-op until the secrets are configured.

### GitHub Pages and future-dated posts

Jekyll only renders a post after a build runs on or after its `date:` front-matter value. There are two clean patterns to avoid a post going live on LinkedIn before it appears on the blog:

- **Recommended:** Set the post `date:` to "now" (when you finish writing) and set `linkedin_promote_date` to the desired future promotion date. The post is live on the blog immediately; LinkedIn gets it on the scheduled date.
- **Alternative:** Enable a daily GitHub Pages rebuild (e.g., via a scheduled `pages-build-deployment` dispatch) so future-dated posts appear automatically on their date. Then you can let `date:` and `linkedin_promote_date` be the same day.

Keep the two concepts separate: `date:` controls when Jekyll publishes the HTML; `linkedin_promote_date` controls when the scheduler posts the link.

---

## Step 1 — Create a LinkedIn Developer App

1. Go to [https://www.linkedin.com/developers/apps/new](https://www.linkedin.com/developers/apps/new).
2. Create a new app. Associate it with your **personal** LinkedIn account (not a company page) as the App Owner.
3. Under **Products**, find and request **"Share on LinkedIn"** — this unlocks the `w_member_social` OAuth scope needed for personal profile posts. It is self-serve and does not require Marketing Developer Platform approval.
4. Also enable **"Sign In with LinkedIn using OpenID Connect"** — this provides `openid profile` scopes so we can resolve your member ID from `/v2/userinfo`.
5. Under **Auth**, note your **Client ID** and **Client Secret**.
6. Add an **Authorized Redirect URL**: `https://www.linkedin.com/developers/tools/oauth/redirect` (used once for the one-time token dance below).

---

## Step 2 — Perform the one-time OAuth dance to get a refresh token

LinkedIn's OAuth 2.0 flow requires a browser step the first time to authorise your app and capture a refresh token. Do this locally — **not** in CI.

### 2a. Request an authorization code

Open this URL in your browser (replace `YOUR_CLIENT_ID`):

```
https://www.linkedin.com/oauth/v2/authorization
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://www.linkedin.com/developers/tools/oauth/redirect
  &scope=w_member_social%20openid%20profile
  &state=somerandomstring
```

Log in with **your personal LinkedIn account** and approve. You will be redirected to:

```
https://www.linkedin.com/developers/tools/oauth/redirect?code=AUTHORIZATION_CODE&state=...
```

Copy the `code` query parameter.

### 2b. Exchange the code for tokens

```bash
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=https://www.linkedin.com/developers/tools/oauth/redirect" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

The response contains:
- `access_token` — valid ~60 days
- `refresh_token` — valid ~365 days ← **this is what you store as a secret**

### 2c. (Optional) Resolve and cache your person URN

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "LinkedIn-Version: 202506" \
     https://api.linkedin.com/v2/userinfo
```

The `sub` field in the response is your member ID. Your person URN is `urn:li:person:<sub>`. Store this as `LINKEDIN_PERSON_URN` to skip this API call on every run.

---

## Step 3 — Set repository secrets

Go to **Settings → Secrets and variables → Actions** in your GitHub repo and add:

| Secret name | Value | Required? |
|---|---|---|
| `LINKEDIN_CLIENT_ID` | Your app's client ID | Yes (for refresh token flow) |
| `LINKEDIN_CLIENT_SECRET` | Your app's client secret | Yes (for refresh token flow) |
| `LINKEDIN_REFRESH_TOKEN` | The refresh token from Step 2b | **Yes** (primary credential) |
| `LINKEDIN_PERSON_URN` | `urn:li:person:YOUR_SUB` from Step 2c | Recommended (saves an API call) |
| `LINKEDIN_ACCESS_TOKEN` | Static access token | Only if not using refresh token |

> **Never commit any of these values.** They live only in GitHub's encrypted secrets store.

---

## Token lifetimes and refresh strategy

| Token | Lifetime |
|---|---|
| Access token | ~60 days |
| Refresh token | ~365 days |

The workflow automatically exchanges the refresh token for a fresh access token on each run — you never need to rotate the access token manually.

**Refresh token rotation:** When you exchange a refresh token, LinkedIn may issue a new refresh token. Currently the workflow does not write the new refresh token back to the secrets store (that requires a GitHub App or PAT with `secrets` write scope, which is a larger privilege than warranted).

Recommended approach: **add a scheduled workflow** that fires every ~6 months as a reminder to re-run the OAuth dance and update `LINKEDIN_REFRESH_TOKEN`. About 30 days before expiry, LinkedIn will start returning `refresh_token_expired` errors — the workflow will log a clear error message at that point.

```yaml
# Add to promote-to-linkedin.yml `on:` block as a reminder (does a dry-run to validate creds)
  schedule:
    - cron: '0 9 1 */6 *'  # every 6 months on the 1st
```

---

## URL derivation note

The script constructs canonical post URLs using Jekyll's default **date** permalink:

```
/{year}/{month}/{day}/{slug}.html
```

where `{slug}` is the filename portion after the date prefix. If you customise `permalink` in `_config.yml` (for example to include `:categories` in the path or to use pretty URLs without `.html`), update `derivePostUrl()` in `scripts/promote-to-linkedin.mjs` to match.

---

## Testing locally

```bash
# Dry run — prints what would be posted, no API calls
node scripts/promote-to-linkedin.mjs --dry-run _posts/2026-05-02-Project-Glasswing-and-Mythos.md

# Full run (requires env vars)
LINKEDIN_REFRESH_TOKEN=... \
LINKEDIN_CLIENT_ID=... \
LINKEDIN_CLIENT_SECRET=... \
LINKEDIN_PERSON_URN=... \
node scripts/promote-to-linkedin.mjs _posts/2026-05-02-Project-Glasswing-and-Mythos.md
```

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Token refresh failed (HTTP 401)` | Client ID/secret wrong or expired | Re-check secrets; ensure app is still active |
| `Token refresh failed (HTTP 400): refresh_token_expired` | Refresh token has passed ~365 days | Re-run the OAuth dance (Step 2) and update the secret |
| `LinkedIn Posts API error (HTTP 403)` | App missing `w_member_social` scope | Ensure "Share on LinkedIn" product is enabled on your app |
| `Failed to resolve person URN (HTTP 401)` | Access token invalid | Usually caused by a refresh failure upstream |
| Workflow skips with "not configured" | `LINKEDIN_REFRESH_TOKEN` secret is empty | Set the secrets per Step 3 above |
