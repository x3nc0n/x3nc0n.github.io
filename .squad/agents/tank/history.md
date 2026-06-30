# Tank — History

## Project Context
- **Project:** x3nc0n.github.io — "Spaid on Security" Jekyll blog by **John Spaid** (Customer Experience Leader for Oil, Gas & Energy at Microsoft).
- **User:** John Spaid (GitHub: x3nc0n)
- **Campaign:** A series of 12+ blog posts on **AI-accelerated DevSecOps**, mined from the user's real GitHub work across x3nc0n and the Spava-Corp demo org. Goal: publish 2-3 posts/week for over a month.

## Known Repos (source material)
**Spava-Corp (demo org):** deepseismic2-infra, alz-mgmt, alz-mgmt-templates, homeschool-hero-azure, entra-verifiedid-deploy, purview-information-protection-as-code, alz-sentinel, alz-startstopv2, azure-afd-apim-private-demo, jospaid-helios-core-azureopenai, alz-purview-payg, alz-security-copilot, alz-workload-sfgameserver.
**x3nc0n (personal):** deepseismic2, homeschool-hero, secops-squad-starter-kit, secops-squad, entra-verifiedid-example, altered-carbon, azure-afd-apim-private-demo, aio-security, eps-parent-manager, osdu-infrastructure, squad, YellowKey, ConditionalAccessDocumentation, AddAzPrivateDnsConditionalForwarders-pwsh.

## Learnings
- Blog voice is first-person, opinionated, technical, code-block-heavy. See `_posts/2026-05-02-Project-Glasswing-and-Mythos.md` as the gold-standard style reference.
- The 2021 posts (CICD-for-ASIM-Functions, Writing-Sentinel-Abnormality-Detections) are predecessors to the modern `alz-sentinel` repo — strong "then vs now" narrative.

## Cluster B Research (2026-06-29)

**Repos researched:** Spava-Corp/purview-information-protection-as-code, x3nc0n/purview-ip-labels, Spava-Corp/alz-purview-payg, x3nc0n/entra-verifiedid-example, Spava-Corp/entra-verifiedid-deploy, x3nc0n/azure-afd-apim-private-demo, Spava-Corp/azure-afd-apim-private-demo, x3nc0n/aio-security

**Briefs written:**
- `.squad/files/research/post-04-purview.md` — Information Protection as Code (Purview labels, DLP, SQL classification, CI/CD)
- `.squad/files/research/post-05-verifiedid.md` — Verifiable Identity & Passwordless Onboarding
- `.squad/files/research/post-06-zerotrust.md` — Zero-Trust Edge: AFD→APIM→AKS (Bicep + Helm)
- `.squad/files/research/post-07-aio.md` — Securing Azure IoT Operations (edge-to-cloud security)

**Key findings:**
- Purview IaC uses `Connect-IPPSSession` with certificate-based auth — OIDC not supported by the IPPS module; this is a notable constraint worth explaining in the post.
- Spava purview repo has 12-label taxonomy (Public → General → Confidential/{PII,Financial,SecOps,Legal} → HC/{ThreatIntel,IncidentData,Credentials,ExecutiveComms}); x3nc0n/purview-ip-labels has a simpler 8-label version. Both are valid starting points for readers.
- entra-verifiedid repos switched from App Service to Container Apps mid-build (commit `ebc6760`) due to ESLZ quota — a real constraint, good narrative hook.
- KV circular dependency fix in verifiedid (commits `42de0b4` → `29944d3`) is a concrete AI debugging story.
- azure-afd-apim: x3nc0n (public) is the reference; Spava (private) evolves it with FDID-specific policy Bicep and APIM API definitions. Key design decision: Developer SKU stv2 cannot use internal VNet mode — FDID header policy is the compensating control.
- aio-security: initial commit (`f462754` 2026-05-08) delivered the complete solution. Preview API versions for AIO resources (`2023-10-04-preview`) — note in post as bleeding-edge.
- aio-security dual-workspace routing (security → Sentinel, ops → ITOps) is the central architecture insight — prevents Sentinel cost explosion while ensuring SOC visibility.
- AIO custom policies cover TLS enforcement and MQTT authentication — direct mitigations for TRITON/Industroyer-class OT attacks.
- Tenant ID `ef4ecf0b-a160-444b-a405-ce3bf1f98752` appears in alz-purview-payg README — same redaction pattern as Cluster A.
- AI agent credits appear explicitly in afd/apim code comments: "Author: Kima (SecOps Engineer), Date: 2026-05-07".

## Cluster A Research (2026-06-29)

**Repos researched:** Spava-Corp/alz-mgmt, Spava-Corp/alz-mgmt-templates, Spava-Corp/homeschool-hero-azure, Spava-Corp/deepseismic2-infra, x3nc0n/deepseismic2, Spava-Corp/alz-sentinel

**Briefs written:**
- `.squad/files/research/post-02-alz.md` — ALZ as Code (alz-mgmt + alz-mgmt-templates + deepseismic2-infra)
- `.squad/files/research/post-03-sentinel.md` — Detection-as-Code then vs now (alz-sentinel vs 2021 posts)
- `.squad/files/research/post-11-osdu.md` — Energy-sector infra (deepseismic2 + deepseismic2-infra)

**Key findings:**
- alz-mgmt uses ALZ Accelerator v7.1.1, Bicep (explicitly NOT Terraform), OIDC, 21-module path-filtered CI/CD
- alz-mgmt-templates is a shared reusable workflow library (4 composite actions + 2 reusable workflows)
- alz-sentinel has a custom .NET 8 KQL syntax validator built ephemerally at CI time — novel, no off-the-shelf equivalent
- entra-id.bicep deploys a full Phase 1 detection suite (2 analytics rules + 2 hunting queries + 2 playbooks + 1 workbook) in a single Bicep file — AI squad authored (Dillon, Dutch, Hawkins, Mac)
- 2021 ASIM post has "UPDATE: ASIM is now built-in, don't do this" disclaimer — strong "then vs now" editorial hook
- deepseismic2 COST.md tracks per-session AI build costs; ~$35-40 total to build seismic ML PoC end-to-end
- deepseismic2-infra pins container image SHA digests to git at deploy time — supply chain security
- MOCK_MODE removal (Sprint 3) is a concrete de-scaffolding narrative: AI agents removed their own scaffolding
- x3nc0n/deepseismic2 is a PUBLIC repo; Spava-Corp repos are private (demo org)

**DO-NOT-PUBLISH pattern:** Tenant ID `ef4ecf0b-a160-444b-a405-ce3bf1f98752` appears in multiple repos; redact in all blog snippets.

## Cluster C Research (2026-06-29)

**Repos researched:** x3nc0n/squad, x3nc0n/secops-squad (private), x3nc0n/secops-squad-starter-kit, Spava-Corp/alz-security-copilot, Spava-Corp/jospaid-helios-core-azureopenai, Spava-Corp/alz-startstopv2, x3nc0n/YellowKey, x3nc0n/altered-carbon, x3nc0n/ConditionalAccessDocumentation, x3nc0n/AddAzPrivateDnsConditionalForwarders-pwsh

**Briefs written:**
- `.squad/files/research/post-08-aigov.md` — Governing AI Capacity as Code (Security Copilot SCUs + Azure OpenAI via Bicep)
- `.squad/files/research/post-09-cost.md` — Cost Governance as a Security Control (alz-startstopv2 ALZ policy gauntlet)
- `.squad/files/research/post-10-squad.md` — Squad deep dive for DevSecOps (SDK, starter kit structure, real agent charters, .secops/ schema)
- `.squad/files/research/post-12-identity.md` — Identity Governance as Documentation (CA docs + Private DNS forwarders)
- `.squad/files/research/post-13-vulnresearch.md` — AI-Assisted Vulnerability Research (YellowKey BitLocker bypass + altered-carbon toolkit)
- `.squad/files/research/post-14-capstone.md` — Capstone: How I Actually Ship with Copilot CLI + Squad

**Key findings:**
- `alz-security-copilot`: `Microsoft.SecurityCopilot/capacities@2024-11-01-preview` — ARM requires ≥1 SCU at deploy; post-deploy `Set-ScuToZero.ps1` reduces to 0 (PAYG). `crossGeoCompute: NotAllowed` is the data residency governance knob. Squad team: Alien universe.
- `jospaid-helios-core-azureopenai`: GPT-4.1 (30K TPM, S0) deployed via Bicep + OIDC. Wires to squad watcher `.env`. `disableLocalAuth: false` is a documented trade-off (Node.js SDK requires API key). Subscription ID and Tenant ID in README — redact.
- `alz-startstopv2`: 25-commit ALZ policy gauntlet (StorageAccountDisableLocalAuth, Flex Consumption migration, custom RBAC role 6 actions vs Contributor). Alert email `john@spaid.dev` in commit — redact. All commits Copilot co-authored.
- `secops-squad` (private): Wire cast (McNulty/Lead, Kima/SecOps, Freamon/KQL, Herc/SOAR, Sydnor/Platform, Carver/QA). Has `JitAccess.yml` issue template — JIT as a GitHub Issue is notable. `kql-validate.yml` on push/PR.
- `secops-squad-starter-kit`: 847 skills (92 core + 755 community imported May 2026). 7 personas including `full-soc` (Wire cast: Bunny Colvin/SOC Mgr, Bodie/L1, Poot/L2, Carver/L3, Herc/Det Eng, Cutty/Automation, McNulty/Hunt Lead, Lester/TI). `.secops/` YAML schema v1.0. Foundry/Fable 5 add-on (June 2026, PR #1) — marked `deprecated-when: claude-fable-5 in GHCP catalog`.
- `YellowKey`: FsTx BitLocker bypass, Windows 11/Server 2022/2025 only. Disclosed via MORSE/MSTIC/GHOST. **Do not republish reproduction steps.** The "same binary different capabilities between WinRE and normal Windows" observation is the defensively interesting angle.
- `altered-carbon`: Dev environment bootstrapper. Security note: moves PS modules/profile out of OneDrive to prevent Purview DLP alerts on example secrets. Installs Copilot CLI, LM Studio, VS Code + Microsoft Sentinel extension, AzSentinel PS module. The repo itself has a Squad team (Altered Carbon cast).
- `ConditionalAccessDocumentation`: Fork of nicolonsky/ConditionalAccessDocumentation. Single-script PSGallery publication. Resolves GUIDs → display names via Graph cache. Credit Nicola Suter (original author).
- `AddAzPrivateDnsConditionalForwarders-pwsh`: 50+ Private DNS zones → `168.63.129.16`. Region-aware token substitution ({regionName}, {regionCode}). Forest/Domain replication scope.
- **Universal pattern across ALL repos:** `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` on every commit. Squad team on every non-trivial repo. GitHub Actions governance gates on every IaC repo. OIDC (no long-lived creds) on every deployment.
- **Redaction list:** Subscription ID `6a170127-f4d5-4706-af95-e957af9cbcff` (helios-core README), Tenant ID `ef4ecf0b-...` (global), Management subscription `45da0317-...` (alz-startstopv2), `john@spaid.dev` email (alz-startstopv2 alert group).
## Cost Research (2026-06-29)

**Task:** Fetched COST.md from every source repo (posts 02–14) via `gh api`. Output: `.squad/files/research/costs.md`.

**Repos WITH COST.md (6 of 18+ checked):**
- `Spava-Corp/homeschool-hero-azure` — $270 tracked; Claude Opus 4.6 dominant ($192.50). Totals table verified ✓.
- `Spava-Corp/deepseismic2-infra` — ~$19.50 summed from session log (no stated total in file).
- `x3nc0n/entra-verifiedid-example` — ~$8–10 tracked; Claude Opus + Sonnet, single session. Totals verified ✓.
- `Spava-Corp/entra-verifiedid-deploy` — ~$1.50–2.00 tracked (this repo's share of the joint session).
- `x3nc0n/secops-squad-starter-kit` — ~$12–15 tracked; Sonnet + Haiku. Totals verified ✓.
- `x3nc0n/deepseismic2` — ~$41.55 tracked (18 sessions). **DISCREPANCY:** cumulative table shows $33.55 (12 sessions, stale); update history is authoritative at $41.55. Scribes should cite $41.55.

**Repos WITHOUT COST.md (12 repos):** alz-mgmt, alz-mgmt-templates, alz-sentinel, purview-information-protection-as-code, alz-purview-payg, purview-ip-labels, azure-afd-apim-private-demo (both), aio-security, alz-security-copilot, jospaid-helios-core-azureopenai, alz-startstopv2, squad, secops-squad (private — accessible, no COST.md), ConditionalAccessDocumentation, AddAzPrivateDnsConditionalForwarders-pwsh, YellowKey, altered-carbon.

**Pattern:** Untracked repos are generally pre-May 2026 (pre-AI-intensive era) or smaller/focused repos. The COST.md convention was established around the deepseismic2 project (June 2026) and propagated forward.

**Estate tracked total:** ~$362 across 6 repos. Full estate estimate with untracked repos: ~$500–750.
