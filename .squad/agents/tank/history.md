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
