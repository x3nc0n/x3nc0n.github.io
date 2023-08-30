---
layout: post
title:  "Writing Sentinel Analytics Rules to Detect Anomalies"
description: "A tutorial on writing Sentinel rules in KQL with dynamic thresholds for detections"
categories: security Azure Sentinel KQL Kusto Analytics
---

# Writing Sentinel Analytics Rules to Detect Anomalies

## Introduction to Sentinel Analytics Rules

Azure Sentinel uses Analytics Rules to detect suspicious events, correlate them, and alert the Security Operations Center (SOC) team. Often, analysts will write a rule that uses a static threshold for alerts. Example: `if >5 then alert`

However, the problem with using a threshold like this is that the threshold for a particular server, user, or other entity might change seasonally or over time. For example, a startup would love to see more traffic to their site, so setting a static threshold based on past traffic volume will eventually generate a false positive alert. The analyst will investigate, come to this conclusion, and adjust the threshold manually. Repeat forever, as long as the site keeps growing. This wastes valuable time & resources.

The method I will outline examines the past behavior of the entity, sorts the events into time-boxed bins, calculates the average number of events, and the standard deviation. The average and standard deviation are then summed to give a true dynamic threshold for alerts, based entirely upon past event volume seen.

## Writing the Query

Let's start with a simple detection. Here, we're looking for file events using the [ASIM function imFileEvent](https://docs.microsoft.com/en-us/azure/sentinel/normalization):

```kusto
let threshold = 100;
imFileEvent
| where TimeGenerated between (ago(1h)..now()) // get data from the last hour
| summarize count() by DvcHostname // count events per Host
| where count_ > threshold // only show records above our threshold
```

This gets us *any* host with more than 100 file events in the past hour. Obviously, this makes almost no sense for our use case; maybe we looked at the past data and didn't see more than 100 file events on any server, so we picked this. Then the organization gets a little bigger and a new employee's file usage pushes several servers over our threshold. Instead of updating the static `100` above, we decide to be smart and use a dynamic threshold *per host* based on its historical activity.

```kusto
let threshold = (
// create the historical threshold for each host
imFileEvent
| where TimeGenerated between (ago(14d)..ago(1h)) // get the past two weeks of events, minus our detection time of the past hour
| summarize cnt=count() by DvcHostname, bin(TimeGenerated, 1h) //count the events for each Host by hour
| summarize avg(cnt), stdev(cnt) by DvcHostname // compute the average and standard deviation for each Host
| project threshold = avg_cnt + stdev_cnt, DvcHostname); // project only what we need; the threshold per Host, which is the sum of average and standard deviation
// get the detection behavior
imFileEvent
| where TimeGenerated between (ago(1h)..now()) // get data from the last hour
| summarize count() by DvcHostname // count events per Host
| join kind=inner threshold on DvcHostname // do an inner join to make one table with the recent event count and threshold from the last function
| where count_ > ['threshold'] // only show Hosts that are above their threshold
```

Done. Now, instead of a static `100` threshold, we build a table that has a dynamically set threshold per Host. We then do an inner join so that we can get the current count of events and the threshold in the same table, and finally drop rows where the current detection count is less than the threshold.

## Closing

I hope this helps explain how to set a dynamic threshold. It's a slightly more complex example than some of the [Microsoft Learn](https://aka.ms/learn) [KQL content](https://docs.microsoft.com/en-us/learn/paths/sc-200-utilize-kql-for-azure-sentinel/) because it uses a per Host threshold.
