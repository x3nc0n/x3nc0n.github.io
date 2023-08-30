---
layout: post
title:  "CI/CD for ASIM functions in Microsoft Sentinel"
description: Keeping ASIM functions up-to-date with GitHub Actions
img: sentinel_logo.png
date: 2021-11-15 06:00 -0600
tags: Microsoft Sentinel Azure ASIM GitHub CI/CD security SIEM
---

>UPDATE: ASIM is now [built-in to Sentinel](https://cda.ms/3W3), so don't do this

## What is ASIM for Microsoft Sentinel

The Azure Sentinel Information Model (ASIM) is an implementation of the [Open Source Security Events Metadata (OSSEM)](https://ossemproject.com/intro.html) project's [Common Data Model (CDM)](https://ossemproject.com/cdm/intro.html). The CDM normalizes and standardizes table and log data into a consistent format from disparate sources.

Consider two different vendors' raw firewall logs. Even using Common Event Format (CEF), we still see differences in the labels and data imported into Sentinel. One logs a block action with `block` and the other with `deny`. They're the same thing for a network event that is prevented at the firewall. If we wanted to write a query to find all blocked network sessions in the last hour, we would need to write a query that returned the information based on each vendor's log format.

ASIM solves this problem by normalizing the data from both vendors to `Block`. However, since Microsoft is continually updating ASIM, how can we keep it current? The answer is, of course, a CI/CD pipeline in the form of a GitHub Action.

## The ASIM GitHub

The [ASIM docs page](https://docs.microsoft.com/en-us/azure/sentinel/normalization) links to the [official Microsoft Sentinel GitHub repo](https://github.com/Azure/Azure-Sentinel). However, there is another repo with the ASIM parsers in the format that the new [Repositories feature](https://docs.microsoft.com/en-us/azure/sentinel/ci-cd?tabs=github) uses: [ASIM Parsers CI/CD-ready Repo](https://github.com/x3nc0n/sentinel-content-2)

## Setup

Start with a clean Sentinel Workspace - if you have deployed the ASIM parsers, remove them. I have noticed some issues when the parsers have been deployed manually multiple times.

Fork [this repo](https://github.com/x3nc0n/sentinel-content-2) to your own account and open Microsoft Sentinel to the Repositories blade where you will click the **+ Add New** button.

![MsftSentinel-Repositories](..\assets\img\asimcicd-azs-addnew.png)

Authorize your GitHub account access from Sentinel (you can restrict it to the repository you forked for security purposes rather than granting complete access).
Select the repository you forked above as the source, noting that Azure Dev Ops (ADO) is also supported if your organization isn't on GitHub yet.

Select **Parsers** as the content.

Save the connection and navigate to your GitHub repo and edit the new YAML file for the Action as shown in the code snippet below.

>TIP: This is in the .github/Workflows directory in your repo now; Sentinel put it there and did a commit for you. The first deployment already failed, because you need to add **/Parsers** to the directory, as shown below.

```handlebars
jobs:
  deploy-content:
    runs-on: windows-latest
    env:
      resourceGroupName: 'spaid-sharedsvcs-log-rg'
      workspaceName: 'spaid-sharedsvcs-log'
      directory: {% raw %}'${{ github.workspace }}/Parsers'{% endraw %}
      cloudEnv: 'AzureCloud'
      creds: {% raw %}${{ secrets.AZURE_SENTINEL_CREDENTIALS_<guid> }}{% endraw %}
      contentTypes: 'Parser'
```

Watch your Action succeed at deploying the ASIM parsers. You can verify the deployment by trying to use one of the parsers in a Log query window:

```kusto
imNetworkSession
| take 10
```

## Summary

You now have a CI/CD pipeline via GitHub Actions that can keep your ASIM Parsers current. Make sure to check back for updates to the parsers regularly. The official guidance on how to do this might change as time goes on; a lot of the stuff shown above is in Preview.

## Other Helpful Links

- Graylog has a [great article on log formats](https://www.graylog.org/post/log-formats-a-complete-guide)
- [Azure Security Private Preview Program Sign-up for Customers](https://aka.ms/SecurityPrP)
- Deploy other types of content, like Analytics Rules and Workbooks, with the new [Sentinel Repositories (Preview) blade](https://docs.microsoft.com/en-us/azure/sentinel/ci-cd?tabs=github)
