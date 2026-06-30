# Squad Decisions

## Active Decisions

### 2026-06-29 — User Directive: Audience Accessibility for Promotion Post
**By:** John Spaid (via Copilot)  
**Scope:** Blog→LinkedIn promotion work (post #15 + GitHub Actions workflow)  
**Decision:** Assume the audience does NOT have unlimited GitHub Copilot. Provide copy-paste templates people can use as-is. Write the series for a general practitioner audience without assuming premium/unlimited Copilot tiers.  
**Rationale:** Keep the content accessible and self-serve; the automation should work for anyone, AI-tier-independent.

---

### Tank Decision: Cluster A Research Choices (2026-06-29)

#### Decision 1: post-11 Brief Scope — DeepSeismic2, Not OSDU Platform
**Context:** The brief is titled `post-11-osdu.md`, but content centers on `deepseismic2` + `deepseismic2-infra`. OSDU platform is separate.  
**Decision:** Filed under `post-11-osdu.md` as instructed, but scoped explicitly to the DeepSeismic2 workload angle.  
**Rationale:** DeepSeismic2 is the energy-sector narrative hook (Volve dataset, seismic ML, E&P workflow). OSDU infrastructure is a distinct platform layer. Mixing them produces a muddy brief.

#### Decision 2: COST.md as Primary Editorial Angle for Post 11
**Context:** `x3nc0n/deepseismic2/COST.md` tracks per-session AI/LLM costs with sprint outcomes — rare transparency.  
**Decision:** COST.md as the lede for Post 11. Narrative hook: "We built a cloud-native seismic ML PoC for ~$40 in AI token costs."  
**Rationale:** Concrete, defensible, energy-relevant hook. Cost transparency builds author credibility.

#### Decision 3: Tenant ID Redaction Standard
**Context:** Demo tenant ID `ef4ecf0b-a160-444b-a405-ce3bf1f98752` appears in multiple repos in hardcoded form (real GUID, even if demo).  
**Decision:** Added "DO-NOT-PUBLISH: tenant ID" to all research briefs. Blog series uses `<tenant-id>` placeholders in code snippets.  
**Rationale:** Publishing a real tenant GUID invites enumeration attacks even if demo-only. Blog value is the pattern, not the GUID.

#### Decision 4: 2021 Blog Post #1 Has a Disclaimer
**Context:** `_posts/2021-11-15-CICD-for-ASIM-Functions.md` has top disclaimer: "UPDATE: ASIM is now built-in to Sentinel, so don't do this."  
**Decision:** Documented in Post 03 brief. Use as a "we've come a long way" moment in narrative.  
**Rationale:** Honest self-deprecation builds reader trust and strengthens "then vs now" structure.

---

### Tank Research Decisions — Cluster B (2026-06-29)

#### Decision 1: Post 04 — Call out IPPS Certificate-Auth Constraint
**Context:** `Connect-IPPSSession` does NOT support OIDC; certificate-based app auth only for unattended CI/CD.  
**Recommendation:** Include dedicated callout explaining this limitation and certificate generation requirement (CSP/CNG distinction).  
**Evidence:** `x3nc0n/purview-ip-labels` README; `Deploy-PurivewInformationProtectionLabels.ps1` uses `-CertificateFilePath`; workflow decodes PFX from base64 secret.

#### Decision 2: Post 04 — Show Both Label Taxonomies
**Context:** Two taxonomies exist: Spava enterprise version (12 labels) and x3nc0n personal version (8 labels).  
**Recommendation:** Lead with enterprise taxonomy; call out simpler 8-label version for individual readers.  
**Evidence:** `purview-config/labels/labels.json` (Spava) vs. `$LabelDefs` (x3nc0n).

#### Decision 3: Post 05 — Container Apps Architecture Pivot Is Key Narrative Moment
**Context:** Entra-VerifiedID started as App Service; mid-build, ESLZ subscription had zero App Service quota, forcing pivot to Container Apps. Commits `ebc6760` and `42de0b4` → `29944d3` tell this story.  
**Recommendation:** Include pivot story in Post 05 — demonstrates real AI-assisted debugging and rapid adaptation under constraint. Shows Container Apps as quota-efficient ESLZ option.  
**Evidence:** Commit messages in `x3nc0n/entra-verifiedid-example`: pivot, KV circular dependency fix, secret migrations.

#### Decision 4: Post 06 — Lead with "Why Not Internal VNet Mode" Question
**Context:** Many practitioners assume zero-trust APIM requires `virtualNetworkType: Internal`. Developer SKU stv2 doesn't support internal mode; compensating control is `X-Azure-FDID` header check in global APIM policy.  
**Recommendation:** Open Post 06 with this question as hook, explain Developer SKU constraint and FDID solution. Position John as someone who understands real constraints.  
**Evidence:** `Spava-Corp/azure-afd-apim-private-demo/docs/decisions/apim-network-access.md`; APIM Bicep comment; MITRE T1190 comment in `apim-policies.xml`.

#### Decision 5: Post 07 — Emphasize Dual-Workspace Cost Architecture
**Context:** Many AIO implementations route all logs to single workspace, causing Sentinel ingest cost overruns when operational MQTT telemetry flows in. This repo routes security logs to Sentinel, ops metrics to ITOps workspace.  
**Recommendation:** Make dual-workspace pattern a headline feature of Post 07 — both practical cost control and architectural best practice. Pair with cost estimate.  
**Evidence:** `modules/diagnostic-settings/aio-diagnostics.bicep` — `metrics: [{ enabled: false }]` in Sentinel diag settings.

#### Decision 6: Cross-Post — AI Agent Credits in Code Are Recurring Proof Point
**Context:** `azure-afd-apim-private-demo` APIM policy XML and WAF Bicep explicitly credit "Author: Kima (SecOps Engineer), Date: 2026-05-07". Every repo includes Co-authored-by trailers.  
**Recommendation:** Blog series should call out that AI agent attribution in code (headers, commit trailers) is a governance practice — creates audit trail of AI involvement.  
**Evidence:** `apim-policies.xml` header; `waf-policy.bicep` header; every commit with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

---

### Tank Decision: Cluster C Research Patterns (2026-06-29)

#### Decision 1: YellowKey Post Responsible Framing
**Decision:** Post 13 (AI-Assisted Vulnerability Research) MUST NOT republish YellowKey reproduction steps.  
**What to focus on:** Research methodology, FsTx/WinRE discrepancy as security principle, coordinated disclosure (MORSE/MSTIC/GHOST), defender takeaways.  
**Rationale:** Post-Glasswing blog series reaches defenders AND potentially adversaries. We are a security publication. Responsible disclosure applies.

#### Decision 2: Universal Redaction List (Cluster C)
**Values to redact:**
- Subscription ID `6a170127-f4d5-4706-af95-e957af9cbcff` (jospaid-helios-core-azureopenai README)
- Tenant ID `ef4ecf0b-a160-444b-a405-ce3bf1f98752` (multiple repos, noted in A/B clusters too)
- Management subscription `45da0317-...` (alz-startstopv2 architecture diagram)
- Email `john@spaid.dev` (alz-startstopv2 alert action group commit)

**Rationale:** Real Azure identifiers in Spava-Corp demo org. Demo org ≠ public disclosure of subscription topology.

#### Decision 3: Credit Attribution for Forked Repos
**Decision:** When writing posts covering `x3nc0n/ConditionalAccessDocumentation`, credit **Nicola Suter** as original author.  
**Attribution:** "using Nicola Suter's `Invoke-ConditionalAccessDocumentation` script (adapted and maintained in the Spaid estate)."  
**Rationale:** Explicit fork; PSGallery names Nicola Suter as author. Correct attribution is ethical and legally required.

#### Decision 4: Post 10 Squad Depth Strategy
**Decision:** Post 10 must explicitly acknowledge what Glasswing post already covered and build on that floor, not repeat.  
**New depth focus:** Real Wire-cast agent charters, `.secops/` YAML schema, skill taxonomy (847 skills), GitHub Actions integration (squad-triage, kql-validate, issue templates), workspace auto-discovery CLI, decisions-archive pattern, Foundry/Fable 5 add-on.  
**Rationale:** Ensure no content recycling while building genuine depth.

#### Decision 5: The Universal Commit Pattern (Finding)
**Observation:** Every meaningful commit in Spaid estate since 2026-04-28 includes `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.  
**Significance:** Verifiable cross-repo fact supporting capstone post's "AI was here for all of it" narrative. Single strongest evidentiary anchor for entire 14-post series.  
**Action:** Capstone post (14) should open with this observation and quantify it.

---

### Trinity — Design Decisions: LinkedIn Auto-Promotion (2026-06-29)

#### Decision: Personal-Profile Scope via "Share on LinkedIn" Product
**Chosen:** `w_member_social` scope via **"Share on LinkedIn"** developer product.  
**Rationale:** Personal blog needs personal profile posts. "Share on LinkedIn" product is self-serve (no Marketing Developer Platform approval queue).  
**Trade-off:** Company-page posting would require separate `rw_organization_social` scope + Organisation URN setup (out of scope).

#### Decision: Refresh-Token Strategy
**Chosen:** Store long-lived refresh token (~365 days). Script calls `POST /oauth/v2/accessToken` with `grant_type=refresh_token` on each workflow run.  
**Rationale:**
- Access token (~60 days) needs manual rotation every 2 months if stored. Refresh token's ~365-day lifetime matches "annual maintenance" cadence.
- Extra HTTPS call costs minimal; keeps secrets minimal and avoids rotating short-lived token.

**Fallback:** `LINKEDIN_ACCESS_TOKEN` supported for simpler setup (accepts manual ~60-day rotation burden).

#### Decision: Guard on Missing Secret — Hard No-Op
**Chosen:** Workflow's first step checks credentials via env-var indirection. If absent, logs friendly message and exits 0.  
**Rationale:** Safe to merge immediately before secrets configured. Fork PRs and community contributors never see errors. Unconfigured repos don't fail builds.

**Implementation:** Secrets passed via `env:` not `if:` expression (avoids GitHub Actions eval edge case).

#### Decision: URL Derivation — Jekyll Default Permalink
**Chosen:** `/{YYYY}/{MM}/{DD}/{slug}.html` derived from filename.  
**Rationale:** `_config.yml` has no custom `permalink:` setting; Jekyll uses default `date` style. Simpler form avoids dynamic path-safe string conversion.  
**Documented assumption:** Code comment notes that custom `permalink` requires updating `derivePostUrl()` function.

#### Decision: PR Dry-Run, No Post on PR
**Chosen:** When triggered by `pull_request` event (same-repo, not fork), `--dry-run` passed to script. Prints full commentary but makes zero API calls.  
**Rationale:** Lets author preview blurb before LinkedIn post goes live. Prevents duplicate posts if PR is updated and re-merged.

---

### Trinity — Design Decisions: Scheduled LinkedIn Promotion (2026-06-29)

#### Decision: Credential Guard at Module Load Time
**Implementation:** Guard runs before any other logic — even before scanning `_posts/`. Exits 0 when both `LINKEDIN_REFRESH_TOKEN` and `LINKEDIN_ACCESS_TOKEN` absent.  
**Benefit:** Completely inert on unconfigured repos/forks. No misleading log noise.

#### Decision: Shared LinkedIn Logic Inlined (Not Imported)
**Trade-off:** Two copies of ~80 lines each (promote-to-linkedin.mjs vs promote-scheduled.mjs).  
**Rationale:** Four shared functions (`refreshAccessToken`, `resolvePersonUrn`, `postToLinkedIn`, `buildHashtags`) inlined to avoid package.json `exports` complexity. Each file has note documenting relationship.

#### Decision: "Due" Check Uses Date Portion Only, America/New_York
**Implementation:** `linkedin_promote_date` compared as YYYY-MM-DD string against today in `America/New_York` using `Intl.DateTimeFormat` with `en-CA` locale.  
**Benefit:** Correctly handles cron running at 12:00–15:00 UTC vs post date in ET.

#### Decision: `linkedin_promote: true` with No Date Means "Due Immediately"
**Behavior:** Post with `linkedin_promote: true` and no `linkedin_promote_date` promoted on next cron run (Tue/Wed/Thu 8–11 AM ET).  
**Rationale:** Aligns with spec's default without requiring script to compute future dates.

#### Decision: Cron Window `0 12-15 * * 2-4`
**Coverage:** 12:00, 13:00, 14:00, 15:00 UTC on Tue/Wed/Thu = 8–11 AM ET. Four runs/day in that window.  
**Benefit:** Ensures post lands within one hour of scheduled date. Concurrency group prevents overlapping runs.

#### Decision: `cancel-in-progress: false` on Concurrency Group
**Why:** Cancelling mid-ledger-write could result in LinkedIn post with no ledger entry (double-post on next run).  
**Chosen:** Let current run finish safely; new runs queue behind.

#### Decision: Commit Step Uses github-actions[bot] Identity
**Email:** `41898282+github-actions[bot]@users.noreply.github.com` (canonical bot account).  
**Benefit:** Ledger commits clearly attributed to automation. `[skip ci]` suffix prevents on-push workflow from re-triggering.

#### Decision: `workflow_dispatch` `dry_run` Is Type Boolean
**UI:** Boolean inputs render as checkbox — friendlier than typing "true"/"false".  
**In conditions:** Compared as `inputs.dry_run != true` (no quotes). In shell: `"${{ inputs.dry_run }}"` compared to string `"true"`.

#### Decision: Ledger Appended, Not Rewritten
**Implementation:** `appendFileSync` instead of read+rewrite.  
**Benefit:** Avoids race conditions between script write and git read. Appending one entry is atomic at filesystem level for single-job concurrency model.

#### Decision: Docs Section Short and Copy-Paste Friendly
**Scope:** Covers only what reader needs — three front-matter fields, cron/ledger mechanism, dry-run, secret setup reference, GitHub Pages date-ordering note.  
**Rationale:** Blog automation must be clean drop-in template for readers without premium Copilot.

---

### Trinity — Design Decisions: Monday Theme Port (2026-06-29)

#### Decision 1: jekyll-assets Removed; Native Jekyll Sass Used
**Action:** Remove all `jekyll-assets` Liquid tags (`{% asset %}`, `{% asset_path %}`, etc.) and replace with standard HTML + `relative_url` filter. Move SCSS to `_sass/`, add YAML front matter to entry-point `.scss` files.  
**Rationale:** `jekyll-assets` (Sprockets) not supported by GitHub Pages. Jekyll's `jekyll-sass-converter` is whitelisted. No behavioral change.

#### Decision 2: Permalink Preserved (NOT Changed)
**Chosen:** Keep site's default `/:categories/:year/:month/:day/:title:output_ext` (NOT Monday's `:title/`).  
**Rationale:** Existing posts have live URLs under default format. Changing permalink would 404 all existing post URLs with no redirect. Monday templates don't require specific format — they use `post.url`.

#### Decision 3: Theme Vendored (No Gem)
**Action:** Remove `theme: minima` from `_config.yml` and `gem "minima"` from `Gemfile`. Vendor all theme files directly into repo.  
**Rationale:** GitHub Pages "theme gem" loading only needed when theme isn't vendored. Vendoring gives full control.

#### Decision 4: `layout: page` Added for about.markdown
**Action:** Create `_layouts/page.html` wrapping content in Monday `.post-container` styling under `default` layout.  
**Rationale:** `about.markdown` uses `layout: page` (Jekyll convention). Avoids changing existing front matter.

#### Decision 5: Analytics and Disqus Off by Default
**Implementation:** `analytics.html` wrapped in `{% if site.analytics %}` guard. `discus.html` already guarded. Both config keys blank in `_config.yml`.  
**Rationale:** Security blog. No third-party tracking or comment scripts without explicit opt-in.

#### Decision 6: Font Awesome Served Locally
**Action:** Vendor Font Awesome fonts and CSS in `assets/fonts/font-awesome/` (no CDN).  
**Rationale:** Monday theme already shipped locally. Keeps it local, avoids CDN dependency, improves privacy posture.

#### Decision 7: Social Handles Unified to Existing Config Keys
**Action:** Templates use `site.github_username` and `site.twitter_username` (already in `_config.yml`).  
**Benefit:** Avoids duplicating handles in config.

#### Decision 8: Attribution Preserved
**Action:** Vendor original GPLv3 LICENSE as `assets/THEME-LICENSE`.  
**Rationale:** Monday is GPLv3. Attribution to Artem Sheludko required.

---

### Trinity Review — Posts 1 & 2 (2026-06-29)

**Reviewer:** Trinity | **Status:** APPROVED-WITH-EDITS

#### Verdict
Both posts approved for publication. One minor voice edit to Post 2. No redaction actions required.

#### Redaction Issues Found
**None.** Both posts clean:
- No subscription IDs in either post. Research brief `parameters.json` (containing real sub IDs) correctly NOT included.
- Tenant ID `ef4ecf0b-a160-444b-a405-ce3bf1f98752` not present.
- No `AZURE_CREDENTIALS` JSON blobs.
- No real customer names or private hostnames.
- `owner: 'jospaid'` is author's own alias on own demo project — cleared for publication.

#### Accuracy Verified
- ALZ Accelerator v7.1.1 ✓
- 21-module path-filter gating ✓
- `dorny/paths-filter@v3` + YAML anchor pattern ✓
- `alz-mgmt-templates` structure (4 composite actions, 2 reusable workflows) ✓
- OIDC `azure/login@v2` with `id-token: write` ✓
- Digest pinning `sed` pattern ✓
- AI-acceleration claims framed as personal anecdote, not hard metrics ✓

#### Voice / Quality Edits
- **Post 1:** No edits required. Strong hook, clean series map, audience framing correct.
- **Post 2:** One edit — replaced `"I'm going to be honest about this rather than vague."` with `"Here's the concrete version."` (tightens entry into specifics, matches Glasswing voice).

#### Front Matter Check
| Post | `linkedin_promote` | `linkedin_promote_date` | Day | Valid |
|---|---|---|---|---|
| Post 1 | `true` | `2026-06-30` | Tue | ✓ |
| Post 2 | `true` | `2026-07-01` | Wed | ✓ |

#### Audience Check
- Post 1 explicitly calls out "accessible on any Copilot tier" ✓
- Post 2 uses `github.com/bradygaster/squad` as open-source reference ✓
- No premium-tier assumptions ✓

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
