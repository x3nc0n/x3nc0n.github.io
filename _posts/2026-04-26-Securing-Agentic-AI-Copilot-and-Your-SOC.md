---
layout: post
title: "Securing Agentic AI: What Copilot Agents Mean for Your SOC"
description: "As Microsoft 365 Copilot agents proliferate across enterprise environments, what are the new attack surfaces and how do you hunt for abuse in Sentinel?"
date: 2026-04-26 09:00:00 -0600
tags: AI Copilot Microsoft Sentinel KQL security agents
---

<!-- DRAFT POST - fill in content below -->

## Introduction

Microsoft 365 Copilot and Azure AI Foundry now support autonomous agents that can take actions on behalf of users: sending emails, querying data, triggering workflows. The security implications for SOC teams are significant and largely uncharted.

This post covers:
- What agentic AI actions look like in Microsoft 365 audit logs
- How to detect unusual or unauthorized agent activity in Microsoft Sentinel
- Recommended Conditional Access and Purview policies to govern agent scope

## What the Logs Look Like

<!-- KQL query to surface Copilot agent activity from the Office 365 UnifiedAuditLog or CloudAppEvents -->

## Detection Rule: Unexpected Copilot Agent Action

```kusto
// TODO: Build detection for high-volume or off-hours Copilot agent operations
// Source table: CloudAppEvents or MicrosoftGraphActivityLogs
```

## Governance Recommendations

<!-- Purview sensitivity labels, DLP policies, Copilot agent scope restrictions -->

## Conclusion
