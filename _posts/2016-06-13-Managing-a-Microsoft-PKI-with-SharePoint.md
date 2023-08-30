---
layout: post
title:  "Managing a Microsoft PKI with SharePoint"
description: "Monitor something no one understands with something no one likes..."
categories: IWS security PKI
---
I run a private Public Key Infrastructure for a medium-sized organization. Part of that job is making sure that all the server or application certificates we issue are properly renewed. I eliminated a lot of the manual work for this early on by using autoenrollment and the <a href="https://www.iis.net/learn/get-started/whats-new-in-iis-85/certificate-rebind-in-iis85" data-blogger-escaped-target="_blank">automatic rebind feature in IIS 8.5 (Server 2012 R2)</a>. However, there are still always those applications which don't use the Windows keystore, or appliances that require you to load a certificate and private key manually.

Now, I recognize that the admins over these applications should be aware of when their certificate is expiring, but we all know that some of them don't. They either can't understand basic SSL/TLS, don't want to, or both; they have deployed a top-of-the-line <a href="http://hitchhikers.wikia.com/wiki/Somebody_Else's_Problem_field" data-blogger-escaped-target="_blank">Someone-Else's-Problem field</a> around the issue. So when a certificate expires, who gets the nasty emails?

There are a lot of products dedicated to certificate monitoring, but they all look at the servers themselves. This works for a majority of situations, but mainly I've found it to be unreliable in some. We have applications that use their own keystore, are on non-standard ports, off-site hosted servers, and other arrangements which make these tools harder to configure at best, simply impossible at worst. The easy way to make sure that at least none of our internal, private certificates expire without notifying everyone is to look at the certificate authority database.

This database contains all of the certificates issued by the CA, which means no scanning and missing anything. But it can be a pain to get data out of it in any usable format. Most places I've worked have had SharePoint, so I load this data into a list and setup notification workflows.

# Use certutil to Export the Data

With Server 2008, certutil added a feature to export to csv. This is perfect for what we want to do.

Using an administrative account (administrative on the PKI, not necessarily in AD), run the following in cmd or Powershell:

<div><span style="font-family: 'courier new', courier, monospace;" data-blogger-escaped-style="font-family: Courier New, Courier, monospace;">certutil -config "$CA_FQDN_OR_IP\$CA_Name" -view -restrict "NotAfter&gt;=$StartDate,NotAfter&lt;=$EndDate" -out "commonname,certificate expiration date, certificate template, requestername" csv &gt; $outDir</span></div>
<div></div>

Replace my variables above as follows:

<div>
<ol>
 	<li>$CA_FQDN_OR_IP = The fully-qualified domain name or IP address of your CA. For example, "server-certauth01.domain.local"</li>
 	<li>$CA_Name = The <i>name</i> of your CA. This is not the hostname or FQDN, but the name that appears on the "Issued By" field on your certificates. It <i>might</i> be your CA's hostname or FQDN, but it shouldn't be (<a href="http://social.technet.microsoft.com/wiki/contents/articles/16160.considerations-for-certification-authority-ca-names.aspx" data-blogger-escaped-target="_blank">and shame on you if it is</a>). For example, "Company CA 01".</li>
 	<li>$StartDate = the day you want to start with. For example, if you want certificates expiring on or after 1/1/2017, enter "1/1/2017".</li>
 	<li>$EndDate = the day you want to end with. For example, if you want certificates expiring before 12/31/2017, enter "12/31/2017".</li>
 	<li>$OutDir = Enter the directory and filename you want the csv to go to.</li>
</ol>
</div>
This script will give you the bare minimum data you'll need to setup expiration alerts. You'll need to run it for each CA in your PKI, as they each only have their own data. For example, I run a two-tier PKI with an offline root and two online intermediate CAs for availability purposes, so I need to do this on both the intermediates. I could run the same commands locally on the root and get its list, too, but I darn well better know when those are expiring already; they're my intermediates.

# SharePoint Workflows
Assuming you know how to setup a SharePoint list, add columns for the Common Name, Expiration Date, Template Name, Requester Name, etc. Then add calculated columns for each notification period you want to setup. For example, if I want a 90 day notice, create a calculated field with the formula "=[ExpirationDate]-90". This will calculate the date 90 days before the expiration date and you can setup a workflow to email you.
