#!/usr/bin/env node
/**
 * promote-scheduled.mjs
 * Scans _posts/ and posts any due LinkedIn promotions to the LinkedIn Posts API.
 *
 * "Due" means:
 *   - linkedin_promote_date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS±HH:MM) <= today in America/New_York, OR
 *   - linkedin_promote: true with no linkedin_promote_date (post as soon as cron runs)
 *
 * Uses _data/linkedin_promoted.yml as a dedup ledger — each slug is promoted exactly once.
 * The workflow (not this script) commits the updated ledger file.
 *
 * Usage:
 *   node scripts/promote-scheduled.mjs [--dry-run]
 *
 * Required env vars (set as GitHub Actions secrets — never hard-code these):
 *   LINKEDIN_REFRESH_TOKEN   — OAuth2 refresh token (~365-day lifetime; preferred)
 *   LINKEDIN_CLIENT_ID       — App client ID (required when using refresh token)
 *   LINKEDIN_CLIENT_SECRET   — App client secret (required when using refresh token)
 *
 * Optional env vars:
 *   LINKEDIN_ACCESS_TOKEN    — Static access token (~60-day lifetime; fallback)
 *   LINKEDIN_PERSON_URN      — urn:li:person:XXXX — skips the /v2/userinfo lookup
 *   SITE_URL                 — Blog base URL (default: https://www.spaid.dev)
 *
 * Node 20+ required (uses built-in fetch — no external packages).
 */

import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Guard: exit 0 gracefully if no LinkedIn credentials are configured.
// Checked before any other work so forks and unconfigured repos are safe no-ops.
// ---------------------------------------------------------------------------
const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
const staticToken = process.env.LINKEDIN_ACCESS_TOKEN;

if (!refreshToken && !staticToken) {
  console.log('ℹ️  LinkedIn promotion not configured — set LINKEDIN_REFRESH_TOKEN');
  console.log('   (plus LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET) as repository');
  console.log('   secrets to enable scheduled post promotion. Skipping.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Minimal YAML front-matter parser
// Handles scalar strings (quoted or unquoted) and space-separated lists.
// Sufficient for the subset used in Jekyll post front-matter on this blog.
// ---------------------------------------------------------------------------
function parseFrontMatter(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    // Strip surrounding single or double quotes
    if (/^["'][\s\S]*["']$/.test(val)) val = val.slice(1, -1);
    fm[key] = val;
  }

  return fm;
}

// ---------------------------------------------------------------------------
// Ledger reader: returns a Set of slugs already present in the ledger.
// The ledger is a simple YAML list appended after the document-start marker (---).
// ---------------------------------------------------------------------------
function readPromotedSlugs(ledgerPath) {
  const slugs = new Set();
  let content;
  try {
    content = readFileSync(ledgerPath, 'utf8');
  } catch {
    // Ledger may not exist yet on the very first run
    return slugs;
  }
  // Everything after the YAML document-start marker is list entries
  const parts = content.split(/^---\s*$/m);
  const body = parts.slice(1).join('---');
  for (const m of body.matchAll(/^\s*-\s*slug:\s*(.+)$/gm)) {
    slugs.add(m[1].trim());
  }
  return slugs;
}

// ---------------------------------------------------------------------------
// Ledger writer: appends a single entry and returns the written text for logging.
// ---------------------------------------------------------------------------
function appendLedgerEntry(ledgerPath, { slug, post_url, promoted_at, linkedin_post_id }) {
  const entry =
    `\n- slug: ${slug}\n` +
    `  post_url: ${post_url}\n` +
    `  promoted_at: ${promoted_at}\n` +
    `  linkedin_post_id: ${linkedin_post_id}\n`;
  appendFileSync(ledgerPath, entry, 'utf8');
  return entry.trim();
}

// ---------------------------------------------------------------------------
// Current date (YYYY-MM-DD) in America/New_York — used for "due" comparison.
// en-CA locale returns ISO date format natively.
// ---------------------------------------------------------------------------
function todayInNewYork() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Determine whether a post is due for promotion based on its front-matter.
//   - linkedin_promote_date present: due if date portion <= today (America/New_York)
//   - linkedin_promote: true, no date: always due when this script runs
//     (the cron limits runs to Tue/Wed/Thu 8–11 AM ET, so this is intentional)
// ---------------------------------------------------------------------------
function isDue(fm, today) {
  if (fm.linkedin_promote_date) {
    // Accept both YYYY-MM-DD and YYYY-MM-DDTHH:MM:SS±HH:MM; compare date part only
    const datePart = fm.linkedin_promote_date.slice(0, 10);
    return datePart <= today;
  }
  return fm.linkedin_promote === 'true';
}

// ---------------------------------------------------------------------------
// Derive the slug from the post filename (portion after the date prefix).
// ---------------------------------------------------------------------------
function deriveSlug(filename) {
  const name = basename(filename).replace(/\.(md|markdown)$/i, '');
  const m = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return m ? m[2] : name;
}

// ---------------------------------------------------------------------------
// Derive the canonical post URL from the filename.
// Assumes Jekyll's default "date" permalink: /:year/:month/:day/:title.html
// Update this function if you customise permalink in _config.yml.
// ---------------------------------------------------------------------------
function derivePostUrl(filePath, siteUrl) {
  const name = basename(filePath).replace(/\.(md|markdown)$/i, '');
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  if (!m) {
    throw new Error(`Filename "${basename(filePath)}" does not match the expected YYYY-MM-DD-slug pattern`);
  }
  const [, year, month, day, slug] = m;
  return `${siteUrl.replace(/\/$/, '')}/${year}/${month}/${day}/${slug}.html`;
}

// ---------------------------------------------------------------------------
// Liveness gate: verify the blog post is actually published (HTTP 200) before
// promoting it on LinkedIn. This enforces the hard dependency that a LinkedIn
// share must never link to a page that is not yet live (e.g., a future-dated
// post whose Pages rebuild has not run yet). On a non-200 response or any
// network error we return false so the caller SKIPS the post and retries it on
// the next scheduled run — the ledger is never written for a post we did not
// successfully promote.
// ---------------------------------------------------------------------------
async function isPostLive(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    // GET (not HEAD): some CDNs/Pages return inconsistent statuses for HEAD.
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    return res.ok; // true only for 2xx
  } catch {
    return false; // timeout, DNS, connection reset, etc. — treat as not live
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Build hashtags from front-matter categories (space-separated list).
// Max 5 tags; stripped to alphanumeric only.
// ---------------------------------------------------------------------------
function buildHashtags(categories) {
  if (!categories) return '';
  return categories
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map(c => '#' + c.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(h => h.length > 1)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Build the LinkedIn post commentary.
// Uses linkedin_blurb if provided; otherwise constructs from title + description.
// ---------------------------------------------------------------------------
function buildCommentary(fm, url) {
  if (fm.linkedin_blurb) {
    // Custom blurb: just append the canonical link
    return `${fm.linkedin_blurb}\n\n\uD83D\uDD17 ${url}`;
  }

  const title = fm.title || '';
  const description = fm.description || '';
  const hashtags = buildHashtags(fm.categories || '');
  const lines = ['New post on Spaid on Security:', '', title];
  if (description) lines.push('', description);
  lines.push('', `\uD83D\uDD17 ${url}`);
  if (hashtags) lines.push('', hashtags);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Exchange a refresh token for a short-lived access token.
// ---------------------------------------------------------------------------
async function refreshAccessToken(clientId, clientSecret, rt) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: rt,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh response missing access_token');
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Resolve the LinkedIn person URN from the OpenID Connect userinfo endpoint.
// ---------------------------------------------------------------------------
async function resolvePersonUrn(accessToken) {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202506',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to resolve person URN (HTTP ${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.sub) throw new Error('userinfo response is missing the "sub" field');
  return `urn:li:person:${data.sub}`;
}

// ---------------------------------------------------------------------------
// Post to LinkedIn using the Posts API (version 202506).
// Returns the new post URN from the X-RestLi-Id response header.
// ---------------------------------------------------------------------------
async function postToLinkedIn(accessToken, authorUrn, commentary) {
  const payload = {
    author: authorUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202506',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn Posts API error (HTTP ${res.status}): ${body}`);
  }

  return res.headers.get('x-restli-id') ?? '(id not returned — check LinkedIn activity feed)';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const siteUrl = process.env.SITE_URL || 'https://www.spaid.dev';
  const postsDir = join(REPO_ROOT, '_posts');
  const ledgerPath = join(REPO_ROOT, '_data', 'linkedin_promoted.yml');

  const today = todayInNewYork();
  const promotedSlugs = readPromotedSlugs(ledgerPath);

  console.log(`Scheduled promotion run — today (America/New_York): ${today}`);
  if (DRY_RUN) console.log('🏁 DRY RUN — no API calls will be made, ledger will not be updated');
  console.log(`Ledger: ${ledgerPath} (${promotedSlugs.size} already promoted)`);
  console.log('');

  // Scan _posts/
  let filenames;
  try {
    filenames = readdirSync(postsDir).filter(f => /\.(md|markdown)$/i.test(f));
  } catch (e) {
    console.error(`Cannot read _posts directory: ${e.message}`);
    process.exit(1);
  }

  // Select posts that are opted-in and due
  const dueItems = [];
  for (const filename of filenames) {
    const filePath = join(postsDir, filename);
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const fm = parseFrontMatter(content);

    // Must be opted in
    if (!fm.linkedin_promote || fm.linkedin_promote === 'false') continue;

    const slug = deriveSlug(filename);

    // Skip if already promoted (exactly-once guarantee)
    if (promotedSlugs.has(slug)) {
      console.log(`⏭  SKIP (already promoted): ${slug}`);
      continue;
    }

    if (!isDue(fm, today)) {
      const scheduled = fm.linkedin_promote_date?.slice(0, 10) ?? 'no date set';
      console.log(`⏳ SKIP (not yet due): ${slug}  [scheduled: ${scheduled}]`);
      continue;
    }

    dueItems.push({ filename, filePath, fm, slug });
  }

  if (dueItems.length === 0) {
    console.log('\nNothing due for promotion today.');
    return;
  }

  console.log(`\n${dueItems.length} post(s) due for promotion:`);
  for (const item of dueItems) {
    console.log(`  → ${item.slug}  (date: ${item.fm.linkedin_promote_date?.slice(0, 10) ?? 'no date'})`);
  }
  console.log('');

  if (DRY_RUN) {
    // Print intended actions and exit — no LinkedIn API calls, no ledger writes.
    // A liveness probe against the public blog is performed (read-only GET) so the
    // preview reflects whether the post would actually be promoted.
    for (const { filePath, fm, slug } of dueItems) {
      const postUrl = derivePostUrl(filePath, siteUrl);
      const commentary = buildCommentary(fm, postUrl);
      const live = await isPostLive(postUrl);
      console.log(`=== DRY RUN: ${slug} ===`);
      console.log(`  URL: ${postUrl}`);
      console.log(`  Blog post live (HTTP 200)? ${live ? 'YES — would promote' : 'NO — would SKIP and retry next run'}`);
      console.log('  Commentary that would be posted:');
      console.log(commentary.replace(/^/gm, '    '));
      console.log(`  Ledger entry that would be written:`);
      console.log(`    - slug: ${slug}`);
      console.log(`      post_url: ${postUrl}`);
      console.log(`      promoted_at: <ISO-8601 UTC at time of run>`);
      console.log(`      linkedin_post_id: <returned by LinkedIn Posts API>`);
      console.log('');
    }
    return;
  }

  // Resolve credentials once for all posts
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  let accessToken;
  if (refreshToken) {
    if (!clientId || !clientSecret) {
      console.error(
        'LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set when using LINKEDIN_REFRESH_TOKEN'
      );
      process.exit(1);
    }
    console.log('Exchanging refresh token for access token...');
    accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    console.log('Access token obtained.');
  } else {
    console.log('Using static LINKEDIN_ACCESS_TOKEN (rotate before ~60 days).');
    accessToken = staticToken;
  }

  let personUrn = process.env.LINKEDIN_PERSON_URN;
  if (personUrn) {
    // Tolerate stray whitespace or wrapping quotes in the stored secret.
    personUrn = personUrn.trim().replace(/^["']|["']$/g, '').trim();
    // LinkedIn requires a full URN (urn:li:person:XXXX). If the stored secret is
    // malformed (e.g. a bare member id or vanity slug), it would 422 the Posts API.
    // Prefer the authoritative member id from /v2/userinfo; only fall back to
    // wrapping the stored value if that lookup is unavailable.
    if (!personUrn.startsWith('urn:')) {
      console.log('LINKEDIN_PERSON_URN is not a full URN; resolving authoritative URN via /v2/userinfo...');
      try {
        personUrn = await resolvePersonUrn(accessToken);
        console.log('Resolved person URN from userinfo.');
      } catch (err) {
        personUrn = `urn:li:person:${personUrn}`;
        console.log(`userinfo lookup failed (${err.message}); wrapping stored value as ${personUrn}.`);
      }
    }
    console.log(`Using person URN: ${personUrn}`);
  } else {
    console.log('Resolving LinkedIn person URN via /v2/userinfo...');
    personUrn = await resolvePersonUrn(accessToken);
    console.log(`Resolved: ${personUrn}`);
    console.log('Tip: set LINKEDIN_PERSON_URN as a repository secret to skip this on future runs.');
  }
  console.log('');

  // Post each due item
  for (const { filePath, fm, slug } of dueItems) {
    const postUrl = derivePostUrl(filePath, siteUrl);
    const commentary = buildCommentary(fm, postUrl);

    console.log(`==> Posting: ${slug}`);
    console.log(`    URL: ${postUrl}`);

    // Liveness gate — never promote a post that is not live on the blog yet.
    const live = await isPostLive(postUrl);
    if (!live) {
      console.log(`    ⏳ SKIP: blog post is not live yet (no HTTP 200 at ${postUrl}).`);
      console.log('       Leaving it unpromoted; will retry on the next scheduled run.');
      console.log('');
      continue;
    }
    console.log('    ✓ Blog post is live (HTTP 200) — proceeding to promote.');

    console.log('    Commentary:');
    console.log(commentary.replace(/^/gm, '    '));
    console.log('    ---');

    let postId;
    try {
      postId = await postToLinkedIn(accessToken, personUrn, commentary);
    } catch (e) {
      // Log and continue — don't abort the whole run because one post failed
      console.error(`    ERROR: ${e.message}`);
      console.error(`    Skipping ledger write for ${slug}; will retry on next scheduled run.`);
      continue;
    }

    const promotedAt = new Date().toISOString();
    const written = appendLedgerEntry(ledgerPath, {
      slug,
      post_url: postUrl,
      promoted_at: promotedAt,
      linkedin_post_id: postId,
    });

    console.log(`    LinkedIn post created. ID: ${postId}`);
    console.log(`    Ledger entry written:`);
    console.log(written.replace(/^/gm, '      '));
    console.log('');
  }
}

main().catch(err => {
  console.error(`Scheduled promotion failed: ${err.message}`);
  process.exit(1);
});
