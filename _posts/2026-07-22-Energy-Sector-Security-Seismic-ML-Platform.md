---
layout: post
title:  "Two AI Squads, One Plaything: An App Team and an Infra Team Shipping Through GitHub Issues"
description: "The interesting part of my energy-ML demo isn't the seismic — it's that two separate AI agent Squads, one owning the app repo and one owning the infra repo, collaborate entirely through GitHub Issues. Cross-repo deploy requests, a Front Door WAF false positive nobody could fix from the app side, digest-pinned supply chain, and an SP-to-UAMI cutover run as a single owned issue."
categories: security devsecops azure squad waf supply-chain bicep
linkedin_promote: true
linkedin_promote_date: 2026-07-22
---

# Two AI Squads, One Plaything: An App Team and an Infra Team Shipping Through GitHub Issues

Let me be honest up front about what this post is *not* about. I am not a geophysicist. I know approximately nothing about subsurface interpretation, and the demo app at the center of this story — `deepseismic2`, an energy-themed "seismic ML" web app — is a **plaything**. It is not a real product, it does not work reliably, and on a bad day it doesn't work at all. It crash-loops on an unpinned Gradio bump, OOMs on a full-volume inference, wedges its chat pane after a slow tool turn, and cheerfully over-predicts faults all over real data. It's a toy.

So why write about it? Because the toy is fronted by something genuinely worth your attention: **two separate AI agent Squads that collaborate, across two repositories, entirely through GitHub Issues.** One Squad owns the application. A different Squad owns the infrastructure. They have different members, different repos, different responsibilities — and they hand work back and forth through a structured, auditable, fully GitHub-native protocol. Watching an *app team* and an *infra team* negotiate a deployment, argue about whose bug it is, and tune a WAF together — when both teams are AI agents — is the part I actually want security and platform people to see.

## Two Squads, One Product, Two Repos

The product is split exactly the way a mature engineering org splits it:

- **The app Squad** lives in the **public** `x3nc0n/deepseismic2` repo. Cast from *Alien*: Ripley (Lead), Dallas (Data/ML), Parker (Backend/Infra), Lambert (AI Integration), Ash (the domain SME), and a Scribe. They own the Python — ingest, the model, the FastAPI backend, the Gradio UI, the Foundry agent.
- **The infra Squad** lives in the **private** `Spava-Corp/deepseismic2-infra` repo. Cast from *Firefly*: Mal (Lead), Kaylee (Infra Dev), Wash (Tester). They own the Bicep, the Container Apps, the Front Door + WAF, the storage, the CI/CD, and the deploy.

(`Spava-Corp` repos are private *by design* — they're built to deploy real infrastructure, not to be browsed. The app repo is public, so you can read its issues yourself; the infra side I'm describing from the inside.)

The boundary between them is the same boundary you'd draw between any app team and any platform team — and that boundary is enforced by *who can change what*. The app Squad cannot edit the WAF policy. The infra Squad does not write the model code. So when a problem lands on the wrong side of that line, it doesn't get hacked around — it gets **handed across the line as an issue.**

## The Handoff Protocol: `fix → release → notify-infra`

Here's the collaboration in its simplest form. When the app Squad finishes a batch of fixes, it cuts a release and then files a **deployment request issue into the infra repo.** Verbatim from the bottom of one such issue:

> _Filed by deepseismic2 (app repo) Squad per the fix → release → notify-infra workflow._

A real one — infra issue #21, "Deploy deepseismic2 app v0.6.5" — reads like a clean ticket from one team to another:

```
**App release ready to deploy:** deepseismic2 v0.6.5

Please redeploy the app container image to the hosted demo. This is an
application image update only — no infrastructure/resource changes required.

## Action requested
- [ ] Redeploy app container to v0.6.5 (rebuild/pull image from the app repo release)
- [ ] Verify chat no longer wedges after a long/multi-tool turn (relates to #20)
- [ ] Confirm run-id short-prefix lookups resolve in the hosted viewer
```

Notice what's in there: the app Squad tells the infra Squad *exactly* what changed, that no Bicep changes are needed, what to verify, and which cross-referenced issues it closes. The infra Squad picks it up, deploys, and validates against that checklist. Two AI teams, one structured contract, every step in git.

It runs the other direction too. When the model needed a real training run, the infra Squad and app Squad negotiated **data location and GPU compute** across repos — infra issue #19 references app issue #24, lays out exactly what F3 dataset path and format the app's ingest CLI expects, and sequences who does what:

```
Infra (this issue): confirm F3 location+format; provision GPU compute with ADLS
  mounted; (later) place the resulting checkpoint at features/checkpoints/unet3d_best.pt
App team (deepseismic2#24): ingest scaffolding already landed + tested; remaining work
  is the F3 label adapter + domain-normalization in the training loader
```

That's two AI Squads doing capacity planning and interface negotiation by issue. No human relayed messages between them — the protocol *is* the coordination.

## The Marquee: A Front Door WAF False Positive Nobody Could Fix From the App Side

This is the best single example of the two-Squad boundary doing real work, and it's a WAF-tuning war story I promised back in the [zero-trust edge post](/2026/07/09/Zero-Trust-Edge-AFD-APIM-AKS.html).

The hosted demo sits behind a **centralized Azure Front Door endpoint with a WAF**, with the app's Container App registered as an **origin** behind it — the shared application-delivery model the infra Squad runs for everything. Good posture. Except the chat pane started failing on the *second* message, every time.

The app Squad chased it first, because "chat breaks" looks like an app bug. They shipped two app-side fixes (a slider-bounds fix, and the Gradio `type='messages'` format fix). The second message still failed. So Parker captured a **HAR trace** and proved it was not an app bug at all:

```
| #  | /gradio_api/queue/join payload | Result            |
|----|--------------------------------|-------------------|
| 1  | 94 B                           | 200               |
| 2  | 101 B                          | 200               |
| 3  | 79 B                           | 200               |
| 4  | 1407 B                         | 403 (WAF block)   |
```

The 4th request — the 2nd chat turn — echoes the full prior assistant turn back to the server (correct Gradio behavior). That payload contained a tool-call echo like:

```
🔧 get_well_data(survey_id='volve-st10010')
```

The `name(arg='value')` substring trips an **OWASP CRS managed rule** — an RCE/SQLi-style signature — and Front Door's WAF blocks the request with a 403 *before it ever reaches the Container App origin.* The response carried the unmistakable `x-azure-ref` / `x-cache: CONFIG_NOCACHE` Front Door block signature. **No app change could fix this**, because the app code never runs. The block is in IaC the app Squad doesn't own.

So the app Squad handed it across the line — infra issue #18 — with a proper diagnosis and three tuning options for the infra Squad to choose from:

1. **Path-scoped exclusion** for `/gradio_api/queue/join` (chat bodies are large free-text and will keep tripping CRS body rules).
2. **Loosen the specific firing managed rule** — with a request to pull the exact `ruleId` from the Front Door WAF logs for the blocked request id.
3. **Switch the affected ruleset to Detection** for those paths if a full exclusion is too broad.

That issue is the whole point of the series' WAF thread made concrete. WAF in Prevention mode *will* false-positive on legitimate traffic — here, an AI chat echoing its own tool calls looks exactly like an injection attack. Tuning it is real work: you scope an exclusion to a path and a rule, you don't disable the WAF, and — crucially — **the team that owns the WAF IaC owns the fix.** The app Squad's job was to prove it wasn't an app bug and hand over a clean, reproducible diagnosis. The infra Squad's job was to tune the policy. Two AI teams, one false positive, exactly the right division of labor.

## Day-One Supply-Chain Security: Digest Pinning in Git

The infra Squad's deploy isn't just `az containerapp update`. Container image *tags* are mutable — someone can push a new image over `v0.6.1` and your "pinned" deployment changes underneath you. The infra repo closes that hole: its deploy workflow pulls the app Squad's image from GHCR, imports it into the infra ACR, **resolves the immutable SHA digest**, and commits that digest back into the Bicep parameter file:

```yaml
- name: Import app images (GHCR -> ACR)
  uses: azure/cli@v2
  with:
    inlineScript: |
      az acr import -n "$ACR_NAME" \
        --source "ghcr.io/x3nc0n/deepseismic2-api:${ACR_TAG}" \
        --image "deepseismic2-api:${ACR_TAG}" --force
      API_DIGEST=$(az acr repository show -n "$ACR_NAME" \
        --image "deepseismic2-api:${ACR_TAG}" --query digest -o tsv)
      echo "api_ref=${ACR_LOGIN_SERVER}/deepseismic2-api@${API_DIGEST}" >> "$GITHUB_OUTPUT"

- name: Pin digests in dev.bicepparam
  run: |
    sed -i -E "s#(param backendImage = ').*(')#\1${API_REF}\2#" bicep/parameters/dev.bicepparam
    git commit -m "chore(deploy): pin ${ACR_TAG} image digests [skip ci]" && git push
```

After this runs, the parameter file references `...deepseismic2-api@sha256:abc123...`, not a tag. The git repo becomes an **immutable bill of materials**: a reviewer can read a commit and know *exactly* which image hash is deployed. Push a malicious image over the tag and the deployment doesn't pick it up — because it deployed a digest. The handoff from app Squad to infra Squad isn't just "ship it"; it's "ship it, pinned, recorded."

## The Identity Cutover That Took Hours, Not Weeks

This repo is also one of the cleanest examples of the OIDC+SP → UAMI migration I've been foreshadowing all series — and it shows how an AI Squad runs a security change with real rigor.

All three infra workflows (`deploy-infra.yml`, `destroy-infra.yml`, `validate-bicep.yml`) originally authenticated with a long-lived **Service Principal client secret** in `AZURE_CREDENTIALS`. The infra Squad migrated them to **OIDC federated to a User-Assigned Managed Identity** — and ran the whole thing as a *single, owned issue* (#10) with a structure most human change tickets never reach:

- **Identity:** a UAMI `id-github-deploy-deepseismic2` with two federated credentials — one scoped to `ref:refs/heads/main`, one to `pull_request`.
- **RBAC:** RG-scoped Contributor + RBAC Administrator — a deliberate **least-privilege improvement** over the old *subscription*-scoped Contributor.
- **Ownership:** Mal owned the architecture gate, Kaylee the implementation, Wash the validation.
- **Test strategy:** prove it on a throwaway branch with a temporary federated credential *before* touching `main`.
- **Cutover + rollback:** remove `AZURE_CREDENTIALS` only after OIDC is verified green; the old SP stays until explicitly deleted, so rollback is "revert the workflow commit, re-add the secret."

No app registration, no stored secret, tighter RBAC, and a documented rollback — done in an afternoon, not a quarter. That's the entire thesis of the dedicated UAMI post still to come in this series: this conversion is fast *and* safer, and an AI Squad can drive it through with a checklist a human auditor would sign off on.

## When AI Agents Pay Down Their Own Technical Debt

One more pattern worth keeping, because it's a correctness *and* a security discipline. Early on, the app had a `MOCK_MODE` toggle — the inference path returned synthetic responses so the rest of the stack could be built before the model was ready. Standard scaffolding. The trap is leaving it in: **a demo that silently returns fake results is more dangerous than one that fails loudly**, because someone eventually trusts the fake.

In a later sprint the app Squad *removed its own scaffolding* — de-mocking the API and the agent, replacing the silent-fake path with an honest HTTP 503 / `RuntimeError` when real inference can't run. AI agents built the mock to move fast, then tore it down on purpose, with the decision recorded in git. "Fail loud, never fake" as a first-class engineering act, not a someday-maybe.

## What This Cost to Build (and Write)

- **Source build cost:** Both repos track a `COST.md`. The app (`deepseismic2`) is **~$41.55** with full per-session detail; the infra (`deepseismic2-infra`) adds **~$19.50** of infra-specific sessions (data copy, the OIDC→UAMI migration, Container App deploy iterations, App Insights wiring). Combined, **~$61** — both tracked, both auditable, no estimate needed. I validated the line items against the stated totals; they reconcile.
- **A note on running cost:** the PoC runs on cheapest-viable defaults and is torn down between demos via an explicit `destroy-infra.yml` — so the run bill is near zero when it isn't actively in use. (Infrastructure that doesn't exist between demos can't be attacked, either.)
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). The actual Front Door FQDN, request id, tenant id, and suffix-bearing ACR name from the repos are generalized here; Volve is a public dataset, safe to name.

## What to Steal

1. **Split app and infra into separate Squads with a hard boundary.** When the team that can't change the WAF hits a WAF bug, the boundary forces a clean handoff instead of a hack.
2. **Make the handoff a structured issue, not a hallway conversation.** `fix → release → notify-infra` with a verify checklist turns "deploy my thing" into an auditable contract between teams.
3. **Diagnose across the boundary before you escalate.** The app Squad captured a HAR and *proved* the WAF was the culprit before filing — so the infra Squad got a fix-ready ticket, not a guess.
4. **Tune WAF false positives by path and rule; never disable the WAF.** An AI chat echoing its own tool calls looks like injection. Scope the exclusion; keep Prevention mode on.
5. **Pin image digests in git at the deploy boundary.** The infra Squad commits the SHA so the app Squad's release becomes an immutable bill of materials.
6. **Run identity migrations as owned issues.** The SP→UAMI cutover had an owner per phase, a throwaway-branch test, and a rollback. That's how you change auth without an outage.

The seismic app barely works — and that's fine, because it was never the point. The point is that two AI agent Squads can own different layers of a system and collaborate through GitHub the way two good human teams would: with clean boundaries, structured handoffs, honest diagnoses, and an audit trail for every decision. The energy ML is the plaything. The *collaboration model* is the product.

*Next: I point my SecOps Squad at this very app — wiring SAST/DAST into the pipeline, then handing the team a Kali Linux VM to actively pen-test the live demo, and publishing the SARIF findings plus a report-summary PDF. One Squad attacks another Squad's plaything.*
