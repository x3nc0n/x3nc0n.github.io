#!/usr/bin/env node
/**
 * promote-to-linkedin.mjs
 * Promotes a single Jekyll blog post to the author's LinkedIn personal profile.
 *
 * Usage:
 *   node scripts/promote-to-linkedin.mjs [--dry-run] <path/to/_posts/YYYY-MM-DD-slug.md>
 *
 * Required env vars (set as GitHub Actions secrets — never hard-code these):
 *   LINKEDIN_REFRESH_TOKEN   — OAuth2 refresh token (~365-day lifetime; preferred)
 *   LINKEDIN_CLIENT_ID       — App client ID (required when using refresh token)
 *   LINKEDIN_CLIENT_SECRET   — App client secret (required when using refresh token)
 *
 * Optional env vars:
 *   LINKEDIN_ACCESS_TOKEN    — Static access token (~60-day lifetime; fallback if no refresh token)
 *   LINKEDIN_PERSON_URN      — urn:li:person:XXXX — skips the /v2/userinfo lookup
 *   SITE_URL                 — Blog base URL (default: https://www.spaid.dev)
 *
 * Node 20+ required (uses built-in fetch — no external packages).
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const POST_FILE = process.argv.slice(2).find(a => !a.startsWith('--'));

if (!POST_FILE) {
  console.error('Usage: node scripts/promote-to-linkedin.mjs [--dry-run] <post-file>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Minimal YAML front-matter parser
// Handles the subset used by this blog: quoted/unquoted string scalars and
// space-separated category lists on a single line.  For anything more complex,
// swap in a real YAML library.
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
// Derive the canonical post URL from the filename.
//
// Assumes Jekyll's default "date" permalink: /:year/:month/:day/:title.html
// where :title is the slug portion of the filename.
//
// NOTE: If you customise `permalink` in _config.yml — e.g., to include
// :categories in the path, or to drop the .html extension — update this
// function to match your actual URL pattern.
// ---------------------------------------------------------------------------
function derivePostUrl(filePath, siteUrl) {
  const name = basename(filePath).replace(/\.(md|markdown)$/i, '');
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  if (!m) {
    throw new Error(
      `Filename "${basename(filePath)}" does not match the expected YYYY-MM-DD-slug pattern`
    );
  }
  const [, year, month, day, slug] = m;
  return `${siteUrl.replace(/\/$/, '')}/${year}/${month}/${day}/${slug}.html`;
}

// ---------------------------------------------------------------------------
// Build hashtags from front-matter categories (space-separated list)
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
// Compose the LinkedIn post text
// ---------------------------------------------------------------------------
function buildCommentary(title, description, url, categories) {
  const hashtags = buildHashtags(categories);
  const lines = ['New post on Spaid on Security:', '', title];
  if (description) lines.push('', description);
  lines.push('', `\uD83D\uDD17 ${url}`);
  if (hashtags) lines.push('', hashtags);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Exchange a refresh token for a short-lived access token
// ---------------------------------------------------------------------------
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
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
// Resolve the person URN from the OpenID Connect userinfo endpoint
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
// Post to LinkedIn using the Posts API (version 202506)
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

  let content;
  try {
    content = readFileSync(POST_FILE, 'utf8');
  } catch (e) {
    console.error(`Cannot read post file "${POST_FILE}": ${e.message}`);
    process.exit(1);
  }

  const fm = parseFrontMatter(content);
  const title = fm.title || basename(POST_FILE);
  const description = fm.description || '';
  const categories = fm.categories || '';
  const url = derivePostUrl(POST_FILE, siteUrl);
  const commentary = buildCommentary(title, description, url, categories);

  if (DRY_RUN) {
    console.log('=== DRY RUN — no API calls will be made ===');
    console.log(`Post file  : ${POST_FILE}`);
    console.log(`Title      : ${title}`);
    console.log(`URL        : ${url}`);
    console.log(`Author URN : ${process.env.LINKEDIN_PERSON_URN || '(would resolve via /v2/userinfo)'}`);
    console.log('--- Commentary that would be posted ---');
    console.log(commentary);
    console.log('==========================================');
    return;
  }

  // Resolve access token — prefer refresh-token flow (longer-lived secret)
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
  const staticToken = process.env.LINKEDIN_ACCESS_TOKEN;
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
  } else if (staticToken) {
    console.log('Using static LINKEDIN_ACCESS_TOKEN (rotate before ~60 days).');
    accessToken = staticToken;
  } else {
    console.error(
      'No LinkedIn credentials found. Set LINKEDIN_REFRESH_TOKEN (+ CLIENT_ID/SECRET) or LINKEDIN_ACCESS_TOKEN.'
    );
    process.exit(1);
  }

  // Resolve author URN — use cached secret to avoid an extra API round-trip
  let personUrn = process.env.LINKEDIN_PERSON_URN;
  if (personUrn) {
    console.log(`Using cached person URN: ${personUrn}`);
  } else {
    console.log('Resolving LinkedIn person URN via /v2/userinfo...');
    personUrn = await resolvePersonUrn(accessToken);
    console.log(`Resolved: ${personUrn}`);
    console.log('Tip: set the LINKEDIN_PERSON_URN secret to skip this call on future runs.');
  }

  console.log(`\nPosting to LinkedIn as ${personUrn}...`);
  console.log('--- Commentary ---');
  console.log(commentary);
  console.log('------------------');

  const postId = await postToLinkedIn(accessToken, personUrn, commentary);
  console.log(`LinkedIn post created. ID: ${postId}`);
}

main().catch(err => {
  console.error(`LinkedIn promotion failed: ${err.message}`);
  process.exit(1);
});
