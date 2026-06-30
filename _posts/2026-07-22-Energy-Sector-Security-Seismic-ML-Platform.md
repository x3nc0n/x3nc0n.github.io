---
layout: post
title:  "Energy-Sector Security: Building a Seismic ML Platform for Under $40"
description: "A cloud-native seismic interpretation platform — ingest, 3D fault detection, FastAPI, an AI agent grounded in Azure AI Search — built end-to-end by a team of AI agents for under $40 in tokens. With supply-chain security baked in on day one: OIDC, private endpoints, and immutable image digests committed to git."
categories: security devsecops azure energy ml supply-chain bicep
linkedin_promote: true
linkedin_promote_date: 2026-07-22
---

# Energy-Sector Security: Building a Seismic ML Platform for Under $40

My day job is customer-experience leadership for oil, gas, and energy at Microsoft, so I spend a lot of time around subsurface workflows. Seismic interpretation — the work of turning raw survey data into a picture of what's underground — has historically been locked inside expensive desktop software, manual file transfers between workstations, and data that never leaves the corporate network. ML experimentation at scale is nearly impossible, and a non-geophysicist can't get near the results. It's exactly the kind of domain where "we should modernize this on the cloud" has been true for a decade and slow to happen.

So I built a proof of concept to show what's now possible: `deepseismic2`, a cloud-native seismic ML platform — SEG-Y ingest, a 3D UNet for fault detection, a FastAPI backend, a Gradio UI, and an Azure Foundry agent grounded in Azure AI Search. It runs on the public Equinor **Volve** dataset (a decommissioned North Sea field, a clean public proxy for real E&P data). A whole team of AI agents built it end to end. The headline number, from the public `COST.md`: the LLM token cost to build the entire thing came to **under $40**. But the part I most want security people to notice isn't the price — it's that the supply-chain security posture was established on day one of the infrastructure repo, not bolted on after a pen test.

## The Number, and What It Bought

The `COST.md` in the repo is a live ledger of what it cost to *build* the product in AI tokens, session by session:

| Session | Est. Cost | Outcomes |
|---------|-----------|----------|
| Architecture kickoff (2026-06-09) | ~$0.85 | Architecture, agent design, team setup |
| Sprint 1 build (2026-06-09) | ~$4.50 | Full ingest pipeline, UNet, 3 UIs, storage client, **79 tests**, CI |
| Azure deploy & live app (2026-06-10) | ~$6.50 | 8 infra fixes, ACR builds, 2 Container Apps live, OpenAI wired |
| Sprint 2 (real loop, 2026-06-24) | ~$6.50 | Real-label training, real metrics, 53 new tests |
| Sprint 3 (de-mock, 2026-06-25) | ~$5.50 | De-mocked API + agent, real-data ingest, 69 new tests |

Across all sessions (through the latest update history) the tracked figure is roughly **$41.55**. For that, a team of agents — Dallas, Parker, Lambert, Hudson, Ash, Ripley, and a Scribe — produced a working cloud-native seismic ML stack with 300+ tests, deployed live to Azure with real Volve data ingested, in about three weeks of elapsed development. Ask any geophysics software shop what that scope costs in engineer-months and the comparison gets uncomfortable fast. The COST.md is, frankly, editorial gold: a public, auditable receipt that AI agents can build a domain-specific energy ML platform for the price of a nice dinner.

## Day-One Supply-Chain Security: Digest Pinning in Git

Here's the security pattern I want every infra team to copy. Container image tags are **mutable** — someone can push a new image over `v0.6.1` and your "pinned" deployment silently changes underneath you. That's a supply-chain attack vector hiding in plain sight in most Container Apps and Kubernetes deployments.

The `deepseismic2-infra` repo closes it. Its deploy workflow pulls the app team's image from GitHub Container Registry, imports it into the infra team's ACR, **resolves the immutable SHA digest**, and commits that digest back into the Bicep parameter file:

```yaml
- name: Import app images (GHCR -> ACR)
  uses: azure/cli@v2
  with:
    inlineScript: |
      az acr import -n "$ACR_NAME" \
        --source "ghcr.io/x3nc0n/deepseismic2-api:${ACR_TAG}" \
        --image "deepseismic2-api:${ACR_TAG}" \
        --username "$GHCR_USER" --password "${{ secrets.GHCR_PAT }}" --force

      # Resolve the mutable tag to an immutable digest
      API_DIGEST=$(az acr repository show -n "$ACR_NAME" \
        --image "deepseismic2-api:${ACR_TAG}" --query digest -o tsv)
      echo "api_ref=${ACR_LOGIN_SERVER}/deepseismic2-api@${API_DIGEST}" >> "$GITHUB_OUTPUT"

- name: Pin digests in dev.bicepparam
  run: |
    PARAM=bicep/parameters/dev.bicepparam
    for p in backendImage preprocessJobImage inferenceJobImage bakeJobImage; do
      sed -i -E "s#(param ${p} = ').*(')#\1${API_REF}\2#" "$PARAM"
    done
    git commit -m "chore(deploy): pin ${ACR_TAG} image digests [skip ci]"
    git push
```

After this runs, the Bicep parameter file references `...deepseismic2-api@sha256:abc123...` — an immutable digest, not a tag. The git repo becomes an **immutable bill of materials**: a reviewer can look at a commit and know *exactly* which image hash is deployed. If someone pushes a malicious image over the tag, your deployment doesn't pick it up, because you deployed a digest. This is the kind of control that's invisible when it's working and catastrophic when it's missing.

## The Rest of the Posture

Digest pinning is the standout, but it sits inside a complete PoC-grade security baseline that the AI authored as a deliberate design, not as scattered fixes:

- **OIDC via user-assigned managed identity** — no `AZURE_CREDENTIALS` JSON secret anywhere in the pipeline. Same pattern I use across the whole estate.
- **Private endpoints for every PaaS service** — storage (ADLS Gen2), Key Vault, Azure OpenAI, AI Search, and ACR are all reachable only over the VNet, isolated from the public internet.
- **VNet isolation** — a dedicated Container Apps infra subnet and a separate private-endpoints subnet.
- **Key Vault for all secrets** — connection strings and credentials live in KV, not in app config.
- **Consistent resource tagging** — `project`, `environment`, `owner` on everything, which makes both policy enforcement and cost attribution possible.

And one cost-and-attack-surface control I love for PoCs: an explicit `destroy-infra.yml` teardown workflow. From the README: *"This is deliberate cost control. For a PoC, deleting the whole resource group is cheaper than babysitting idle resources."* It's also a security win — infrastructure that doesn't exist between demos can't be attacked. The same idea as deallocating idle VMs from the [cost-governance post](/2026/07/16/Cost-Governance-Is-a-Security-Control.html): the cheapest, safest resource is the one that isn't running.

## When AI Agents Pay Down Their Own Technical Debt

The most quietly impressive moment in this build is the "de-mock" sprint. Early on, the platform had a `MOCK_MODE` toggle — the ML inference path returned synthetic responses so the rest of the stack could be built and tested before the model was ready. Standard scaffolding. The trap is leaving it in: **a PoC that silently returns fake results is far more dangerous than one that fails loudly**, because someone will eventually make a decision on fabricated data.

In Sprint 3, the agents *removed their own scaffolding*. They de-mocked the API and the agent, replacing the silent-fake path with fail-loud behavior — an honest HTTP 503 / `RuntimeError` when the real inference can't run. AI agents built the mock to move fast, then tore it down and wired the real thing, on purpose, with the decision recorded in git. That's AI-assisted technical-debt remediation as a first-class engineering act, not a someday-maybe. For a workload that could inform real subsurface decisions, "fail loud, never fake" is a correctness *and* a security discipline.

This application layer is also where a platform like **OSDU** — the open energy data standard — fits in the bigger picture: DeepSeismic2 is the kind of interpretation workload that plugs *on top of* an OSDU data platform. The security patterns here (digest-pinned supply chain, private-endpoint isolation, OIDC, fail-loud integrity) are exactly what you'd want governing any analytics workload sitting over sensitive subsurface data.

## What This Cost to Build (and Write)

- **Source build cost:** Both repos track a `COST.md`. The application (`deepseismic2`) is **~$41.55** with full per-session detail; the infrastructure (`deepseismic2-infra`) adds **~$19.50** of infra-specific sessions (Volve data copy, OIDC migration, Container App deploy iterations, App Insights wiring). Combined, **~$61** — both tracked, both auditable, no estimate needed.
- **A note on running cost:** the PoC runs on cheapest-viable-defaults (Standard_LRS storage, scale-to-zero ML compute, Basic AI Search) and is designed to be torn down between demos via the destroy workflow — so the run bill is near zero when it's not actively in use.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). Tenant ID and the suffix-bearing ACR name from the repo are redacted/generalized here; Volve is a public dataset, safe to name.

## What to Steal

1. **Pin image digests in git, not tags.** Tags are mutable; digests are not. Commit the SHA and your repo becomes an immutable bill of materials no one can swap out from under you.
2. **Private-endpoint every PaaS service.** Storage, Key Vault, OpenAI, AI Search, ACR — none of them need a public face in a VNet-isolated workload.
3. **Make integrity failures loud.** Rip out `MOCK_MODE` before anyone trusts the output. A 503 is honest; a fake result is a future bad decision.
4. **Ship a teardown workflow for PoCs.** One-click resource-group deletion is cost control *and* attack-surface reduction. The safest resource is the one that isn't running.
5. **Track build cost publicly.** A COST.md turns "AI built this" from a claim into a receipt — and it's the most persuasive artifact you'll have when someone asks whether agent-built infrastructure is real.

A cloud-native seismic ML platform, domain-specific to energy, with supply-chain security baked in from commit one — built by a team of AI agents for under $40 in tokens and torn down with one click when the demo's over. The security wasn't the expensive part. It was the default.

*Next: identity governance as documentation — turning Conditional Access policy and private DNS configuration into living, version-controlled records.*
