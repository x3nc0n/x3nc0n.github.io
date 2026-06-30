---
permalink: /2026/07/09/Zero-Trust-Edge-AFD-APIM-AKS.html
layout: post
title:  "Zero-Trust Edge: Azure Front Door to APIM to Private AKS"
description: "Most zero-trust demos have gaps. Here's an edge architecture that closes them — AFD Premium with WAF in Prevention mode, APIM locked to the Front Door instance by header, and AKS with no public IP at all."
categories: security devsecops azure zero-trust apim aks front-door waf
linkedin_promote: true
linkedin_promote_date: 2026-07-09
---

# Zero-Trust Edge: Azure Front Door to APIM to Private AKS

"Zero trust" is the most over-claimed phrase in cloud security. Most demos that wear the label have at least one gap that quietly undoes the whole posture: APIM sits in internal VNet mode but the WAF is misconfigured, or Front Door is in detection mode (logging attacks instead of blocking them), or the backend cluster still has a public IP "just for testing" that never got removed. The architecture looks zero-trust on the diagram. The actual traffic paths tell a different story.

I wanted to build one that closes every gap explicitly, and document *why* each control is there. The result lives in two repos — `azure-afd-apim-private-demo` (the public reference implementation) and a Spava-Corp evolution that adds API definitions and a documented architectural decision. The path is **Azure Front Door Premium + WAF → API Management → AKS over Private Link**, all modular Bicep with Helm charts for the Kubernetes backends, and there is no public IP on the cluster anywhere.

One honest caveat before we walk it: this architecture is built and it deploys, but I'm still validating it **end-to-end** — treat it as a hardened reference to study and adapt, not a turnkey drop-in I've run in anger under real traffic. The controls below are the parts I'm most confident in, and I'll keep iterating as I test the full path.

## The Path a Request Takes

```
Internet (HTTPS only)
    │
    ▼
Azure Front Door Premium (global POP)
    ├── WAF: DRS 2.1 (OWASP) + Bot Manager 1.1 — Prevention mode
    ├── Custom rule: RateLimitPerSourceIP (1000 req/min)
    ├── Custom rule: BlockMissingAzureFDID
    └── Private Link origin → APIM private endpoint
            │
            ▼ (TLS 1.2+)
    API Management (Developer stv2)
    ├── Inbound: X-Azure-FDID header check → 403 if missing/wrong
    ├── Rate limit: 100 calls/60s per key
    └── Backend: AKS Internal Load Balancer (Private Link Service)
            │
            ▼ (Private Link — no public IP on AKS)
    AKS Cluster (Azure CNI)
    ├── Petstore v3 (Helm)
    └── Podinfo health check (Helm)
```

Every hop is a control. Front Door filters and rate-limits at the global edge. APIM refuses anything that didn't come through *our* Front Door. AKS is unreachable except via Private Link Service. Let me walk the two controls that most demos get wrong.

## Control One: WAF in Prevention Mode

Detection mode is the comfortable default — the WAF logs what it *would* have blocked, and nobody's API breaks. It's also security theater if you never flip it. This deployment runs DRS 2.1 (the OWASP-aligned Default Rule Set) plus Bot Manager 1.1 in **Prevention** mode, which actually blocks:

```bicep
properties: {
  policySettings: {
    enabledState: 'Enabled'
    mode: policyMode                      // 'Prevention' in prod
    customBlockResponseStatusCode: 403
    requestBodyCheck: 'Enabled'
  }
  managedRules: {
    managedRuleSets: [
      { ruleSetType: 'Microsoft_DefaultRuleSet'; ruleSetVersion: '2.1'
        ruleSetAction: 'Block' }
      { ruleSetType: 'Microsoft_BotManagerRuleSet'; ruleSetVersion: '1.1'
        ruleSetAction: 'Block' }
    ]
  }
}
```

DRS 2.1 covers SQL injection, XSS, local/remote file inclusion, command injection, scanner detection, session fixation, and Java attacks. Bot Manager blocks known-bad bots, challenges unknown ones, and lets legitimate crawlers through. The point is that these threats are stopped at the global edge, before a request ever reaches your API gateway, let alone your cluster.

This single-app demo is also where a bigger pattern begins. Putting one WAF policy in front of one API is the easy case; the harder, more valuable work is **tuning** that WAF for real production traffic — managing false positives, per-route exclusions, and custom rules — and consolidating *many* backends behind **one centralized Front Door** using AFD **origins** as a shared application-delivery layer. That's exactly the direction the ALZ infrastructure work and the DeepSeismic infra/app build pushed on, and I go deeper on WAF tuning and the centralized AFD-origin delivery model in the landing-zone and DeepSeismic infrastructure posts in this series. Here I'm just establishing the single-path baseline they build on.

## Control Two: APIM Locked to Front Door by Header

This is the clever bit, and it comes from a real constraint. APIM's **Developer SKU (stv2) does not support internal VNet mode.** So you can't just put APIM on a private network and call it locked down — the platform won't let you. The Spava-Corp version documents this explicitly in `docs/decisions/apim-network-access.md`: the choice is `publicNetworkAccess: Enabled` combined with strict `X-Azure-FDID` header validation, rather than `Disabled`.

How does that stay secure? Front Door automatically injects an `X-Azure-FDID` header carrying *your specific* Front Door profile ID. APIM's global inbound policy rejects any request whose header doesn't match — with a 403, before any backend is touched:

```xml
<inbound>
  <base />
  <!-- AFD injects X-Azure-FDID automatically; only our AFD instance passes -->
  <check-header name="X-Azure-FDID"
                failed-check-httpcode="403"
                failed-check-error-message="Direct origin access is not permitted."
                ignore-case="true">
    <value>{{afd-profile-id}}</value>
  </check-header>
  <rate-limit-by-key calls="100" renewal-period="60"
    counter-key="@(context.Subscription?.Key ?? context.Request.IpAddress)" />
</inbound>
<outbound>
  <base />
  <!-- Strip architecture-revealing headers (T1592 recon mitigation) -->
  <set-header name="X-Powered-By" exists-action="delete" />
  <set-header name="X-AspNet-Version" exists-action="delete" />
  <set-header name="Server" exists-action="override"><value>API Gateway</value></set-header>
</outbound>
```

This is belt-and-suspenders. The same `X-Azure-FDID` check is *also* enforced as a WAF custom rule at the Front Door layer (`BlockMissingAzureFDID`), so the validation happens twice. If an attacker discovers your APIM hostname — which they might, hostnames leak — and tries to hit it directly, they get a 403 without reaching a single backend. They'd need to forge your exact Front Door profile ID, which they don't have.

Notice the outbound policy strips `Server`, `X-Powered-By`, and `X-AspNet-Version`. Those headers are free reconnaissance for an attacker (MITRE T1592, gathering victim host information). The `on-error` policy returns a generic error body so internal exceptions and stack traces never leak to clients. Small things, but they're the difference between an architecture that *is* hardened and one that just *looks* hardened.

## Control Three: AKS With No Public IP

The backend AKS cluster has zero public ingress. The only way in is Front Door → APIM → Private Link Service → Internal Load Balancer. The Helm charts deploy the workloads (a Swagger Petstore and a Podinfo health check) behind an internal LB service annotated for Azure:

```
infra/k8s/
├── petstore/   templates/{deployment,service,hpa,tls-secret}.yaml
├── podinfo/    templates/...
└── internal-lb/ templates/service.yaml   # azure-load-balancer-internal: "true"
```

NSGs microsegment each of the four subnets (APIM, AKS, private endpoints, Bastion) with a deny-all default and explicit allows, so even a compromised pod can't move laterally. Management access is via Azure Bastion — no public SSH or RDP jump box. Every resource emits diagnostics to Log Analytics, so the whole thing is Sentinel-ready out of the box.

## A Nice DevOps Touch: Auto-Compiled ARM

One small workflow I keep reusing: the "Deploy to Azure" button only accepts ARM JSON, but the source of truth is Bicep. So a `build-arm.yml` workflow auto-compiles Bicep to ARM on every push to `main` and commits the result back:

```yaml
on:
  push:
    branches: [main]
    paths: ['infra/**']
jobs:
  build-arm:
    steps:
      - uses: azure/login@v2
        with: { client-id: ${{ secrets.AZURE_CLIENT_ID }}, tenant-id: ${{ secrets.AZURE_TENANT_ID }}, subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }} }
      - run: az bicep build --file infra/main.bicep --outfile infra/main.json
      - run: |
          git add infra/main.json
          git commit -m "chore: auto-compile Bicep → ARM template" || echo "No changes"
          git push
```

The deploy button always reflects the current Bicep. You author in the good language and the generated artifact stays in sync automatically.

## The AI Angle

The whole Bicep module set — including the genuinely fiddly WAF policy `concat()` expression that conditionally adds the AFD-header custom rule only when a profile ID is supplied — was generated in a single session. So were all the Helm templates (deployment, service, HPA, TLS secret) for both backend workloads. The MITRE ATT&CK references sprinkled through the APIM policy XML (T1190 for the FDID check, T1592 for the header stripping) were AI-suggested during authoring and then reviewed by me for accuracy.

The most valuable AI contribution wasn't code generation, though — it was the *research-and-document* on the APIM network-access decision. Figuring out that Developer-SKU stv2 doesn't support internal VNet mode, then reasoning through `Enabled` + header-validation as the correct compensating pattern and writing it up as an architectural decision record — that's the kind of "read three docs, synthesize the constraint, document the tradeoff" work that AI does well and that humans usually skip because it's tedious. The result is a repo where the *why* is captured, not just the *what*.

## What This Cost to Build (and Write)

- **Source build cost (both repos):** Neither tracks a `COST.md`, so labeled **estimate**: roughly **$20–45** combined. The public reference implementation (~$15–30) is the bulk — full Bicep for AFD/WAF, APIM, AKS with Private Link, NSGs, Key Vault, Bastion, plus two Helm charts, authored in a focused session. The Spava-Corp evolution (~$5–15) adds the FDID-policy Bicep module, the APIM API definitions, and the decision doc as incremental work.
- **Running cost, for honesty:** the repo README estimates roughly **$530–650/month** to actually run this (APIM Developer SKU, AFD Premium, AKS, Log Analytics). Build cost and run cost are different bills — this series tracks both because conflating them is how people get surprised.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). Redaction here meant keeping the `{{afd-profile-id}}` as a placeholder and never printing a real Front Door profile ID.

## What to Steal

1. **Run your WAF in Prevention mode.** Detection mode is a logging exercise. If you're not blocking, you're documenting your own breach in real time.
2. **Lock APIM to your Front Door by header — twice.** The `X-Azure-FDID` check belongs in *both* the APIM inbound policy and a WAF custom rule. Belt and suspenders, because hostnames leak.
3. **Give your backend no public IP, full stop.** Private Link Service → Internal LB is the only path. If there's a public ingress "for testing," it's a production hole.
4. **Strip recon headers and genericize errors.** `Server`, `X-Powered-By`, `X-AspNet-Version` gone; stack traces never returned. Free reconnaissance denied.
5. **Document the constraint, not just the config.** The "Developer SKU can't do internal VNet, so here's the compensating control" decision record is worth more than the Bicep it explains.
6. **Auto-compile Bicep → ARM if you ship a deploy button.** One workflow keeps the generated artifact honest.

Zero trust isn't a product you buy or a checkbox you tick. It's a discipline of closing every gap and being able to explain why each control exists. The Azure primitives to do it properly are all here — Front Door, WAF, APIM policies, Private Link, NSGs, Bastion. AI made assembling them, and documenting the tradeoffs, fast enough that "do it properly" stopped being the expensive option.

*Next: taking the same posture to the edge of the physical world — securing Azure IoT Operations from device to cloud.*
