---
layout: post
title: "Entra External ID and B2B: Closing the Gaps Attackers Are Using"
description: "External identities and B2B guest accounts are a persistent blind spot in Entra ID environments. Here's a Sentinel detection rule and a hardening checklist for organizations with heavy partner or contractor access."
date: 2026-04-26 09:00:00 -0600
tags: Entra Azure AD B2B external identity Sentinel KQL security detection
---

<!-- DRAFT POST - fill in content below -->

## Introduction

Microsoft Entra External ID (formerly Azure AD B2B) enables collaboration with partners, contractors, and customers — but external identities are routinely under-monitored. Attackers who compromise a partner organization can use their legitimate guest access as an initial foothold, bypassing many detections that focus only on internal users.

This post builds on the earlier [Service Principal detection post](/2021/11/18/Detecting-Suspicious-Service-Principal-Logins-In-Azure-Active-Directory.html) to cover a related blind spot: guest user and cross-tenant access abuse.

## The Threat Pattern

1. Attacker compromises a small partner or MSP tenant
2. Uses existing guest access to your tenant (no new invite needed)
3. Authenticates from a new IP — but your detection only watches member users
4. Escalates via app consent or resource access

## Detection Rule: Guest Logins from New IPs

```kusto
let lookback = 30d;
let detectionWindow = 1d;
let guestHistoricalIPs =
    SigninLogs
    | where TimeGenerated > ago(lookback) and TimeGenerated < ago(detectionWindow)
    | where UserType == "Guest"
    | where ResultType == 0
    | summarize HistoricalIPs = make_set(IPAddress) by UserPrincipalName;
let guestRecentLogins =
    SigninLogs
    | where TimeGenerated > ago(detectionWindow)
    | where UserType == "Guest"
    | where ResultType == 0
    | summarize RecentIPs = make_set(IPAddress) by UserPrincipalName;
guestRecentLogins
| join kind=leftouter guestHistoricalIPs on UserPrincipalName
| mv-expand RecentIP = RecentIPs to typeof(string)
| where not(set_has_element(HistoricalIPs, RecentIP))
| project UserPrincipalName, RecentIP, HistoricalIPs
```

## Cross-Tenant Access Policy Hardening

- Inbound/outbound cross-tenant access settings (Entra admin center)
- Restricting external collaboration to approved partner domains
- Requiring MFA for all guest users regardless of their home tenant's MFA claim

## Monitoring Guest Account Lifecycle

- Stale guest accounts (last sign-in > 90 days)
- Guests with direct role assignments vs. group-based access

## Conclusion
