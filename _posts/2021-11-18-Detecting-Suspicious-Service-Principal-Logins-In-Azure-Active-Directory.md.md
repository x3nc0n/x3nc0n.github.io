---
layout: post
title:  "Detecting Suspicious Login Activity for Service Principals in Azure Active Directory"
description: This post explains the reasoning behind a Microsoft Sentinel rule to detect Service Principals logging in from IPs they haven't used before
img:
date: 2021-11-18 09:00:00AM -0600
tags: CVE-2021-42306, Microsoft Sentinel, Analytics, security
---

## CVE-2021-42306

Microsoft released [guidance on CVE-2021-42306](https://msrc-blog.microsoft.com/2021/11/17/guidance-for-azure-active-directory-ad-keycredential-property-information-disclosure-in-application-and-service-principal-apis/) yesterday. Searching for suspicious Service Principal activity is a key part of securing your Azure AD environment, and this vulnerability simply highlights that fact. Fortunately, Microsoft also released a [Microsoft Sentinel notebook to search for vulnerable apps in your environment](https://github.com/Azure/Azure-Sentinel-Notebooks/blob/master/AffectedKeyCredentials-CVE-2021-42306.ipynb). I also have a pre-existing Analytics Rule that looks for Service Principal (SP) login attempts from IP addresses that SP has not previously used. Let's take a look.

## The Rule

This rule uses the [Azure Sentinel Information Model (ASIM)](https://docs.microsoft.com/en-us/azure/sentinel/normalization) (which I suppose will be renamed to Microsoft Sentinel Information Model in due time).

```kusto
// If this is too noisy, create and use the watchlist below, then uncomment the first line and last line of this query
// let watchlist = (_GetWatchlist('NoisyIpApps') | project AppName);
let lookback = 30d;
let detectionTime = 1d;
let ipNew =
    imAuthentication
    | where EventProduct == 'AAD Service Principal'
    | where TimeGenerated > ago(detectionTime)
    | summarize by ServicePrincipalName, SrcDvcIpAddr;
let ipHistory =
    imAuthentication
    | where TimeGenerated > ago(lookback) and TimeGenerated < ago(detectionTime)
    | where EventProduct == 'AAD Service Principal'
    | summarize by ServicePrincipalName, SrcDvcIpAddr;
ipNew
| join kind=leftanti ( 
    ipHistory
    )
    on ServicePrincipalName, SrcDvcIpAddr
// |where ServicePrincipalName !in (watchlist)
```

The first thing I noticed when I was developing this rule is that some SPs are very noisy and login from many IPs. I developed the watchlist mentioned to tune these out. You would still want to monitor the SPs for logins from IPs that had a bad reputation or were in your threat intelligence data, but that is accomplished in other rules. Here, we just have to tune them out.

We start by creating a table of the last day's SP logins and the IPs they used (ipNew). Then we create a historical table of the same thing (ipHistory). Finally, we do a left anti join from ipNew to ipHistory, removing all the SP & IP combinations from ipNew that we have seen before in ipHistory. This leaves us with only the new SP & IP combinations to investigate.

## Conclusion

I highly recommend using the watchlist feature to tune out noisy apps for this rule, otherwise you will have alert fatigue in no time. This rule should be used in conjunction with others and other steps should be taken to secure against compromised Service Principals.