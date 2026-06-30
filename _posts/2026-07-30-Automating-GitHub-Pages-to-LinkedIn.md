---
layout: post
title:  "Automating GitHub Pages → LinkedIn: A Copy-Paste Template"
description: "Every post in this series promoted itself to LinkedIn — on schedule, on US peak hours, with zero manual posting — straight from the post's own front-matter. This is the dogfood post: the whole template, free, no unlimited-Copilot subscription required. A Node script, a scheduled Action, a dedup ledger, and one front-matter line."
categories: devsecops automation github-actions linkedin jekyll
linkedin_promote: true
linkedin_promote_date: 2026-07-30
---

# Automating GitHub Pages → LinkedIn: A Copy-Paste Template

Here's a secret about the post you're reading: it promoted itself to LinkedIn. So did the other fourteen in this series. I didn't open LinkedIn, write a blurb, paste a link, and hit Share — not once across a month of publishing. Each post carried its own promotion schedule in its front-matter, and a GitHub Action did the rest, on US-business-hours peak timing, exactly once per post.

This is the dogfood post. Everything else in this series was about securing infrastructure with AI; this one hands you the entire promotion machine so you can bolt it onto your own GitHub Pages blog. And because I said I would: **there's no Copilot dependency here.** No unlimited subscription, no agents, no AI in the runtime path at all. It's a Node script and a YAML workflow. Copy it, set three secrets, done.

## The Whole Idea in One Front-Matter Line

The mechanism is dead simple. You opt a post in for promotion, and optionally tell it when:

```yaml
---
layout: post
title:  "My Great Post"
categories: security automation
linkedin_promote: true
linkedin_promote_date: 2026-07-30
---
```

`linkedin_promote: true` means "share this on LinkedIn." `linkedin_promote_date` means "but not before this date." A scheduled Action wakes up during US peak professional hours, scans `_posts/`, finds anything due, and posts it. A dedup ledger guarantees each post goes out **exactly once**, ever — even though the schedule runs many times.

That's the entire user interface. One boolean, one optional date. The rest is plumbing you set up once.

## Piece 1: The Promotion Script

The script (`scripts/promote-scheduled.mjs`) is plain Node 20 — it uses the built-in `fetch`, so **zero npm dependencies**. It parses front-matter, decides what's due, exchanges a refresh token for an access token, resolves your LinkedIn person URN, and posts via the LinkedIn Posts API. Here's the core logic, trimmed to the load-bearing parts:

```javascript
// "Due" = promote date has arrived (America/New_York), or opted-in with no date.
function isDue(fm, today) {
  if (fm.linkedin_promote_date) {
    const datePart = fm.linkedin_promote_date.slice(0, 10);
    return datePart <= today;          // compare YYYY-MM-DD lexically — safe for ISO dates
  }
  return fm.linkedin_promote === 'true';
}

// The dedup ledger (_data/linkedin_promoted.yml) is the exactly-once guarantee.
const promotedSlugs = readPromotedSlugs(ledgerPath);
// ...later, per post:
if (promotedSlugs.has(slug)) continue;      // already shared — never again
if (!isDue(fm, today)) continue;            // not yet its day
```

Posting itself is one `fetch` to the Posts API with a structured payload:

```javascript
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

  if (!res.ok) throw new Error(`LinkedIn Posts API error (HTTP ${res.status}): ${await res.text()}`);
  return res.headers.get('x-restli-id');   // the new post's URN, recorded in the ledger
}
```

The commentary it posts is built from your existing front-matter — title, description, and up to five hashtags derived from `categories` — or from a custom `linkedin_blurb` field if you want to hand-write the hook. Either way you never touch LinkedIn's UI.

Two design choices worth stealing:

- **Per-post error isolation.** If one post fails to publish (token hiccup, API blip), the script logs it, *skips the ledger write for that slug*, and continues. The failed one retries on the next scheduled run; the successful ones don't double-post. One bad post never poisons the batch.
- **A real `--dry-run` mode.** Run it locally, see exactly what would be posted and what ledger entry would be written, with zero API calls. You debug your blurbs before anything goes live.

## Piece 2: The Scheduled Action

The workflow (`.github/workflows/promote-to-linkedin-scheduled.yml`) is where the *timing* lives. This is the part I want to dwell on, because the schedule is doing engagement research for you:

```yaml
on:
  # Hourly across the US peak window: 12:00–15:00 UTC = 8–11 AM ET, Tue–Thu.
  schedule:
    - cron: '0 12-15 * * 2-4'
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false
```

That cron is not arbitrary. The consensus across social-engagement studies for a **US professional B2B audience** is consistent: weekday mornings, mid-week, beat everything else. Tuesday/Wednesday/Thursday, 8–11 AM in the reader's local business timezone, is the sweet spot — people are at their desks, coffee in hand, scrolling the feed before the day's meetings bury them. Monday is catch-up chaos; Friday afternoon is checked-out; weekends are dead for B2B. So the schedule runs **Tue–Thu only** (`* * 2-4`), **hourly from 12:00–15:00 UTC** (`12-15`), which is 8–11 AM Eastern. The `linkedin_promote_date` you set picks the *day*; the cron picks the *hour*. You never think about peak timing again — it's baked into the runner.

The workflow has three more properties that make it safe to merge into any repo today:

```yaml
permissions:
  contents: write          # only to commit the dedup ledger
concurrency:
  group: linkedin-scheduled
  cancel-in-progress: false # never interrupt an in-flight ledger write
```

And a **credential guard** as the first step — if you haven't set the secrets yet, it logs a friendly message and exits 0:

```yaml
- name: Guard — check LinkedIn credentials
  id: guard
  run: |
    if [ -z "$LI_REFRESH" ] && [ -z "$LI_TOKEN" ]; then
      echo "configured=false" >> "$GITHUB_OUTPUT"
      echo "ℹ️  LinkedIn promotion not configured — skipping."
    else
      echo "configured=true" >> "$GITHUB_OUTPUT"
    fi
  env:
    LI_REFRESH: ${{ secrets.LINKEDIN_REFRESH_TOKEN }}
    LI_TOKEN: ${{ secrets.LINKEDIN_ACCESS_TOKEN }}
```

This is the bit that makes the template **safe to copy into a public repo or a fork**: it's a complete no-op until *you* arm it. Nobody's fork accidentally posts to a LinkedIn account that doesn't exist.

## Piece 3: The Dedup Ledger

`_data/linkedin_promoted.yml` is the exactly-once memory. After each successful post the script appends an entry:

```yaml
- slug: My-Great-Post
  post_url: https://www.spaid.dev/2026/07/30/My-Great-Post.html
  promoted_at: 2026-07-30T13:04:11.482Z
  linkedin_post_id: urn:li:share:7355...
```

The workflow commits this file back to the repo with `[skip ci]` so it doesn't trigger itself. It lives in `_data/`, so Jekyll even makes it available to your templates if you ever want a "shared on LinkedIn" badge on a post. The ledger is the single source of truth for "what's already gone out" — delete a line and that post becomes eligible again, which is occasionally handy for a re-share.

## Setup: The Only Manual Step

The entire human setup is a one-time OAuth dance, then three secrets:

1. **Register a LinkedIn app** (developer.linkedin.com), request the *Share on LinkedIn* and *Sign In with OpenID Connect* products. This gives you `w_member_social` (post) and `openid`/`profile` (resolve your URN).
2. **Do the OAuth2 authorization-code flow once** to get a refresh token (~365-day lifetime). The `docs/linkedin-promotion.md` in the template walks the exact curl commands.
3. **Set three repository secrets:** `LINKEDIN_REFRESH_TOKEN`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`. Optionally `LINKEDIN_PERSON_URN` to skip a lookup call.

That's it. From then on, authoring a post and setting `linkedin_promote: true` is the whole workflow. The token refreshes itself on every run; you re-do the OAuth dance roughly once a year.

**Grab the template as a Gist:** I've published the script, the workflow, and the setup doc as a [public Gist](https://gist.github.com/x3nc0n/5f04392fec2367bb9e9867c7615bbea5) so you can drop them straight into your repo without cloning mine. Three files, copy-paste, done.

## What This Cost to Build (and Write)

This one's almost entirely human-directed design plus a modest amount of AI scaffolding for the Node script and the YAML. There's no source-repo `COST.md` for the blog automation itself — it lives in this very blog repo — so I'll be honest and call it an **estimate: roughly $3–6** in LLM tokens for the script, the workflow, the docs, and the iteration to get the OAuth refresh flow and the ledger semantics right.

Writing and producing this post ran the usual flat **~$1.00** (research into peak-engagement timing, drafting, review). As with every post in this series, that's AI *build/write* cost, not the GitHub Actions runtime — which for a cron that runs a few hours a week on a 20-line Node script is **effectively free** on a public repo, well inside the Actions free tier. And, per the rule I've held all series: I'm not counting the cost of writing this cost section. No recursion.

## What to Steal

1. **Put the schedule in the data, not your calendar.** One front-matter line per post (`linkedin_promote: true`) plus an optional date is a far better interface than a reminder to "go post this."
2. **Bake peak-timing into the cron.** Tue–Thu, 8–11 AM ET. Let the runner enforce the engagement research so you never second-guess when to hit Share.
3. **A ledger gives you exactly-once for free.** A scheduled job runs many times; a committed dedup file turns "ran 200 times" into "posted once."
4. **Guard on credentials and exit 0.** That single guard step is what makes automation safe to commit to a public repo or hand to others as a template.
5. **Keep AI out of the runtime path.** The build used AI; the *running* system is plain Node and YAML with no dependencies and no subscription. Anyone can run it. That's the point.

This is where the series lands: fifteen posts about using AI to ship security infrastructure faster — and the last one is a reminder that the best automation often has no AI in it at all. AI helped me *build* the machine. The machine itself is just good old boring plumbing, doing the same thing reliably, on schedule, forever. That's the kind of automation worth dogfooding.

*Thanks for reading the series. The repos are real, the costs are receipts, and the whole promotion template is a Gist away. Go automate something boring.*
