---
layout: post
title: "Phishing in the Age of AI: Detection Engineering for LLM-Generated Lures"
description: "AI-generated phishing emails have eliminated the grammar mistakes and formatting tells that defenders relied on. Here's how to update your Sentinel detections and user training for 2026."
date: 2026-04-26 09:00:00 -0600
tags: phishing AI LLM Microsoft Sentinel Defender email security detection
---

<!-- DRAFT POST - fill in content below -->

## Introduction

The era of "just look for bad grammar" phishing detection is over. Large language models have made it trivially inexpensive to generate thousands of highly personalized, grammatically perfect phishing emails — including spear-phishing content scraped from LinkedIn, GitHub, and public corporate communications.

At the same time, Microsoft Defender for Office 365 has shipped several AI-driven detection improvements. This post covers both the threat evolution and the detection engineering response.

## What Changed in 2025-2026

- LLM-generated lures: hyper-personalization at scale
- AI voice cloning in vishing attacks
- "Semantic similarity" bypass of keyword-based filters
- QR code phishing (quishing) persistence

## Defender for Office 365: What's New in the Detections

<!-- Summarize recent Microsoft Defender for Office 365 AI detection improvements -->

## Sentinel Detection: Hunting for Post-Phishing Behavior

The best signal is often downstream from the initial lure. Focus on what happens *after* a user clicks.

```kusto
// Detect OAuth app consent granted shortly after a suspicious email delivery
// Source: EmailEvents, CloudAppEvents
let suspiciousEmailTime = 
    EmailEvents
    | where ThreatTypes has "Phish"
    | where TimeGenerated > ago(24h)
    | project RecipientEmailAddress, EmailDeliveredTime = TimeGenerated;
CloudAppEvents
| where ActionType == "Consent to application"
| where TimeGenerated > ago(24h)
| join kind=inner suspiciousEmailTime on $left.AccountObjectId == $right.RecipientEmailAddress
| where TimeGenerated between (EmailDeliveredTime .. (EmailDeliveredTime + 1h))
```

## User Training That Actually Works in 2026

- Shift from "spot the typo" to "verify the request out-of-band"
- QR code awareness
- Reporting culture over detection culture

## Conclusion
