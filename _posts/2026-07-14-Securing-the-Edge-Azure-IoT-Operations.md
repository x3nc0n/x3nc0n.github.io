---
layout: post
title:  "Securing the Edge: Azure IoT Operations from Device to Cloud"
description: "OT environments used to be air-gapped and invisible to the SOC. Azure IoT Operations bridges edge to cloud — but deploy it without security controls and your MQTT auth events, OPC UA sessions, and Kubernetes audit logs disappear into the void. Here's how to make visibility a deployment artifact."
categories: security devsecops azure iot-operations ot sentinel policy
linkedin_promote: true
linkedin_promote_date: 2026-07-14
---

# Securing the Edge: Azure IoT Operations from Device to Cloud

For most of the history of operational technology, security meant a physical air gap and a prayer. The PLCs and SCADA systems on a factory floor, an offshore platform, or a pipeline compressor station ran on their own networks with their own tooling, and that tooling never talked to the enterprise SIEM. When the air gap inevitably leaked — a contractor's laptop, a misconfigured firewall rule, a VPN for "temporary" remote support — the SOC had no visibility into the OT side at all. The adversaries who specialize in this space (think TRITON/TRISIS, Industroyer) know it. They target the protocol layer precisely because nobody is watching it.

Azure IoT Operations (AIO) is Microsoft's bridge across that edge-to-cloud gap: Arc-enabled Kubernetes running at the industrial site, an MQTT broker for IIoT messaging, an OPC UA connector for real-time field-device data. It's genuinely useful. It's also a brand-new attack surface, and if you deploy it the easy way, the MQTT authentication failures, the OPC UA session events, and the Kubernetes audit log all stay at the edge — invisible to anyone who'd want to detect an intrusion.

`x3nc0n/aio-security` is a Bicep solution whose entire premise is: **you should not be able to deploy AIO without also deploying its security visibility.** Three pillars — diagnostics, policy, and monitoring — make security a first-class deployment artifact rather than a follow-up ticket nobody files.

## The Key Insight: Split Security Logs From Ops Telemetry

The single best design decision in this repo is the dual-workspace routing pattern, and it solves a problem every SOC eventually hits: Sentinel ingest costs explode when you pipe *everything* into the security workspace. AIO is chatty — message throughput metrics, pipeline latency, connection counts. The SOC doesn't need any of that. The SOC needs auth failures and connection events. ITOps needs the throughput metrics.

So this solution routes them separately. Security logs go to Sentinel. Operational metrics go to a separate ITOps Log Analytics workspace. Watch how it's done per resource:

```bicep
// MQTT Broker: security logs (auth failures, connections) → Sentinel
resource mqttBrokerSecurityDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(mqttBrokerName)) {
  name: 'mqtt-broker-security-to-sentinel'
  scope: mqttBroker
  properties: {
    workspaceId: sentinelWorkspaceId
    logs:    [{ categoryGroup: 'allLogs'; enabled: true  }]
    metrics: [{ category: 'AllMetrics';   enabled: false }]   // metrics go to ITOps only
  }
}

// MQTT Broker: operational metrics → ITOps (throughput, latency)
resource mqttBrokerOpsDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(mqttBrokerName)) {
  name: 'mqtt-broker-ops-to-itops'
  scope: mqttBroker
  properties: {
    workspaceId: opsWorkspaceId
    logs:    [{ categoryGroup: 'allLogs'; enabled: false }]   // logs already in Sentinel
    metrics: [{ category: 'AllMetrics';   enabled: true  }]
  }
}
```

The same dual-routing pattern repeats for the Data Processor and the OPC UA Connector. The result: your SOC workspace stays lean and signal-rich, your SOC bill stays predictable, and you've still got the operational telemetry where the operators want it. This is the kind of architectural choice that doesn't show up in a feature checklist but saves a six-figure ingest surprise a year later.

## Make Diagnostics Mandatory, Not Optional

Diagnostic settings that depend on someone remembering to configure them are diagnostic settings that won't exist on half your resources. So this solution ships a custom Azure Policy with a `DeployIfNotExists` effect that *forces* diagnostic settings onto any AIO resource that doesn't have them:

```bicep
resource diagPolicyDefinition 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'aio-require-diagnostic-settings'
  properties: {
    policyRule: {
      if: {
        field: 'type'
        in: [
          'Microsoft.IoTOperationsMQ/mq'
          'Microsoft.IoTOperationsDataProcessor/instances'
          'Microsoft.IoTOperationsOrchestratorConnector/instances'
        ]
      }
      then: {
        effect: '[parameters(\'effect\')]'    // DeployIfNotExists
        details: {
          type: 'Microsoft.Insights/diagnosticSettings'
          roleDefinitionIds: [
            '/providers/Microsoft.Authorization/roleDefinitions/749f88d5-cbae-40b8-bcfc-e573ddc772fa'  // Monitoring Contributor
            '/providers/Microsoft.Authorization/roleDefinitions/92aaf0da-9dab-42b6-94a3-d43ce8d16293'  // Log Analytics Contributor
          ]
          // deployment block creates diagnostic settings inline
        }
      }
    }
  }
}
```

Deploy a new MQTT broker six months from now with no diagnostic settings? The policy's remediation task patches it automatically. Nobody files a ticket. The visibility is self-healing.

Two more custom policies cover the protocol-layer threats that OT adversaries actually use. An **Audit** policy fires if an MQTT broker listener has no TLS configuration (`Microsoft.IoTOperationsMQ/mq/broker/listener/tls` doesn't exist) — catching unencrypted broker traffic. Another fires if a broker's authentication has no `authenticationMethods` — catching anonymous MQTT connections, the IIoT equivalent of leaving the front door open. On top of those, the repo assigns the built-in **CIS Microsoft Azure Foundations Benchmark v2.0** (120+ controls) and **CIS Kubernetes** baselines, giving you a board-reportable compliance view that maps cleanly to NERC CIP and TSA Pipeline Security Directive obligations.

## Bringing Edge Telemetry Into the SIEM

Visibility isn't just about the AIO resources — it's about the hosts and the runtime underneath them. The solution wires up:

- A **syslog Data Collection Rule** that captures `auth` and `authpriv` facilities from Ubuntu edge nodes via the Azure Monitor Agent — login events, sudo, PAM — and routes them to Sentinel. (Deliberately *not* capturing other facilities or application content that might carry PII.)
- **Container Insights** DCRs for the Arc-enabled Kubernetes audit trail (`KubeAuditAdmin`, `KubeEvents`, `ContainerLogV2`).
- The **Microsoft 365 Defender connector**, pulling `DeviceProcessEvents`, `DeviceNetworkEvents`, and `DeviceFileEvents` from MDE-onboarded edge nodes. This is the one that matters most for OT intrusions — Living-Off-The-Land techniques (legitimate tools used maliciously) are the dominant TTP, and you only catch them with process-level telemetry.
- The **Azure Activity connector** for control-plane events (`AzureActivity`, `SecurityAlert`, `SecurityRecommendation`).

Post-deployment, a SOC analyst can query `KubeAuditAdmin` for suspicious privileged actions at the edge runtime, or `DeviceNetworkEvents` for a compromised OT host beaconing out. That's a capability that simply did not exist in the air-gapped world.

A note on honesty: this repo uses AIO's preview API version (`2023-10-04-preview`). That's bleeding-edge by design — AIO is a young platform — and the API shapes may shift. And to be clear about scope, **Defender for IoT is explicitly out of scope here.** It addresses passive OT network monitoring — a different product, a different deployment model. This solution is about the AIO control plane and its host telemetry, not network-tap-based ICS monitoring. Conflating the two is a common mistake; this repo's docs call it out.

## The AI Angle

The entire three-pillar solution — diagnostic settings, three custom policy definitions, the DCRs, the Sentinel connectors, and the supporting documentation — landed in the **initial commit** on 2026-05-08. That's the part worth dwelling on. Writing a `DeployIfNotExists` policy by hand is genuinely annoying: you need the correct `existenceCondition` logic, the right remediation-task RBAC role definition IDs (Monitoring Contributor and Log Analytics Contributor, by their GUIDs), and a working inline deployment block. AI got all of that right on the first pass, including the dual-workspace routing architecture as a *design choice* rather than something I had to specify line by line.

The `log-table-reference.md` doc — mapping each AIO source to its Sentinel table name — was also AI-authored. That's the kind of reference material that's enormously useful to the next analyst and that humans almost never write because it's tedious. AI writing it as a byproduct of building the solution is a quiet, real productivity win.

## What This Cost to Build (and Write)

- **Source build cost:** The repo doesn't track a `COST.md`, so labeled **estimate: $8–20.** A complete medium-scope Bicep solution — five modules, three custom policies with DINE detail blocks, the dual-workspace routing — delivered in what the commit history implies was a single session. That's a half-day of senior platform-engineering work compressed into one AI-assisted sitting.
- **This post's production:** ~**$1.00** — research (~$0.40), drafting (~$0.30), review (~$0.30). No real workspace IDs, site names, or locations appear here; only parameter names from the code.

## What to Steal

1. **Split security logs from ops telemetry at the diagnostic-settings layer.** Security → Sentinel, metrics → ITOps. Your SOC bill will thank you and your signal-to-noise ratio improves.
2. **Use `DeployIfNotExists` to make visibility self-healing.** If diagnostics depend on human memory, half your fleet won't have them. Policy makes it automatic.
3. **Audit the protocol layer, not just the platform.** No-TLS and anonymous-auth policies on MQTT catch the exact threats OT adversaries exploit.
4. **Get process-level telemetry from edge hosts.** OT intrusions are LOTL-heavy. Without `DeviceProcessEvents`, you won't see them.
5. **Be explicit about what's out of scope.** Saying "Defender for IoT is a different product, not this" in your docs prevents a dangerous false sense of coverage.

OT security used to mean hoping nobody found the gap in the air gap. Azure IoT Operations replaces hope with telemetry — but only if you deploy the telemetry alongside the platform. Making security visibility a non-optional deployment artifact, with AI handling the fiddly policy authoring, is how you ship edge security that the SOC can actually use.

*Next: the AI capacity layer itself — governing Security Copilot and Azure OpenAI as code, with a "provision-one-then-zero" pattern that eliminates standing cost.*
