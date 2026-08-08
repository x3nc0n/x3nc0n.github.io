---
layout: post
title:  "Stopping Midnight Blizzard's Device Code Phishing: Prevention, Detection, and Persistence Hunting"
description: "A restaurant IR exposed at least 24 days of token replay before Attack Disruption evicted the attacker. Here's how to defend against device-code phishing used by Midnight Blizzard and other actors."
categories: security devsecops azure identity entra incident-response
linkedin_promote: true
linkedin_promote_date: 2026-08-27
---

# Stopping Midnight Blizzard's Device Code Phishing: Prevention, Detection, and Persistence Hunting

A friend of mine runs a restaurant. Not a tech company, not a government contractor—a restaurant. Earlier this week, I published the [case study of his incident response](/2026/08/25/One-Day-Incident-Response-with-an-AI-SecOps-Squad.html). This is the companion technical playbook.

What we found was a textbook device-code phishing intrusion. The tenant's telemetry tagged the activity as `STORM-3052` and classified it as nation-state, but that tracking label has no public profile that supports naming a sponsor. Midnight Blizzard and its Storm-2372 sub-cluster are documented users of the same technique; they are not an attribution for this restaurant incident.

Microsoft Defender XDR's Attack Disruption feature did its job spectacularly—once the attacker went interactive, it was under 18 minutes to eviction. Automatic. No analyst paged at 3am, no manual response playbook scrambled in real time. The system just... did it.

But here's the uncomfortable truth we ran into: **Attack Disruption is not the full story.** The evidence established roughly 1,100 successful attacker token refreshes over at least 24 days. The available retention window did not establish whether the first observed refresh was the true initial compromise, so 24 days was a defensible lower bound—not a complete dwell-time measurement.

Fast eviction of an active session is a win. Not knowing how long the attacker was present before they went interactive—and what they may have done in that window—is the failure mode. I'll come back to this at the end, because there's an entire section below on designing for long-dwell-time intrusions that addresses exactly this problem.

The silver lining: using [SecOps Squad](https://github.com/x3nc0n/secops-squad-starter-kit), my open-source AI agent starter kit for security operations, I was able to complete a full, comprehensive incident response in under a day. The output was a structured IR report with concrete remediation recommendations—the kind of quality you'd expect from a dedicated SOC team, delivered for a small business that absolutely does not have one. The [full case study](/2026/08/25/One-Day-Incident-Response-with-an-AI-SecOps-Squad.html) covers that workflow; [Squad: Standing Up an AI Agent Team for the SOC](/2026/07/21/Squad-Standing-Up-an-AI-Agent-Team-for-the-SOC.html) explains the underlying pattern.

This post is the technical playbook I wished existed before that call came in.

---

## Why device code phishing works

Device code flow is not a vulnerability. It is a legitimate OAuth 2.0 authorization grant designed for devices and command-line tools that cannot provide a conventional interactive browser experience.

That distinction matters because Midnight Blizzard and associated operations—including Storm-2372, which Microsoft now assesses as an initial-access sub-cluster of Midnight Blizzard—have turned the flow's intended usability into an effective identity-phishing technique. Victims authenticate on Microsoft's legitimate sign-in pages, complete multifactor authentication, and unknowingly authorize an attacker-controlled session.

In a normal device authorization grant:

1. An application requests a device code from the Microsoft identity platform.
2. Microsoft returns a long `device_code`, a short user-facing code, and a verification URL.
3. The user visits the legitimate Microsoft verification page and enters the code.
4. The user authenticates and reviews any presented prompts.
5. The application polls the token endpoint until authorization completes.
6. The application receives an access token and, when requested and permitted, a refresh token.

The short device code normally expires after approximately 15 minutes. That sounds limiting, but it is more than enough time for an attacker engaged in an active social-engineering conversation.

The attacker does not need to steal the password or intercept MFA. Instead, the attacker starts the flow and convinces the target to finish it. The authentication is real; the context presented to the victim is false.

Microsoft has documented Storm-2372 operators impersonating prominent or relevant individuals over Signal, WhatsApp, and Microsoft Teams. After building rapport, the operator sends what appears to be a meeting or event invitation containing a device code. The victim enters that code into Microsoft's legitimate device sign-in page, completing authorization for the attacker's pending session.

This creates several defensive complications:

- The authentication occurs on a trusted Microsoft domain.
- The user may successfully complete phishing-resistant MFA.
- Secure web gateways may see no malicious credential-harvesting page.
- The resulting access is token-based rather than password-based.
- Regional proxies can make the source IP appear geographically plausible.
- Refresh tokens can substantially outlive the initial access token.
- The compromised mailbox can be used to continue phishing from a trusted internal identity.

Security awareness remains useful, but this technique cannot be addressed through user training alone.

## Midnight Blizzard and Storm-2372

Midnight Blizzard—also tracked as NOBELIUM, APT29, or Cozy Bear—is attributed by Microsoft and the US government to Russia's Foreign Intelligence Service, the SVR.

Microsoft first described Storm-2372 as an actor aligned with Russian interests. Microsoft has since assessed Storm-2372 as a Midnight Blizzard initial-access operations sub-cluster based on technical and operational overlaps.

The cluster has targeted governments, nongovernmental organizations, defense, technology, telecommunications, healthcare, higher education, energy, and other organizations across multiple regions.

Device code abuse is not exclusive to Midnight Blizzard. Microsoft has also reported its use by actors including Storm-1249, while other security researchers have documented additional Russian clusters employing similar techniques. **Treat device code phishing as a reusable identity attack pattern, not a detection tied to a single actor name.** The technique outlives any particular threat cluster's operational tempo.

## From authorization to durable access

A successful device code authorization can produce more than a short-lived access token. When the requested scopes and client permit it, the attacker receives a refresh token that can be exchanged repeatedly for new access tokens.

Microsoft Entra refresh tokens commonly have a default lifetime of 90 days, though policy, token family, application type, revocation events, and continuous access evaluation can alter effective lifetime. Rotation matters too: redeeming a refresh token can produce a new refresh token, and applications are expected to discard the old one.

This is one reason identity intrusions can have long dwell times. Resetting a password does not necessarily terminate every existing session immediately, and revoking refresh tokens does not retroactively eliminate every active access token at the instant of response.

Microsoft observed Storm-2372 taking this further. In February 2025, the actor used the Microsoft Authentication Broker client identity to:

1. Obtain a refresh token.
2. Request a Device Registration Service token.
3. Register an attacker-controlled device in Microsoft Entra ID.
4. Combine the device identity and refresh token to obtain a Primary Refresh Token (PRT).
5. Use the resulting access to collect email.

A PRT is especially valuable because it participates in single sign-on and token acquisition from an Entra-registered device. An attacker-controlled device registration can therefore transform an initial phish into an identity with durable, device-associated access that survives a password reset.

## Prevention: block device code flow by default

Microsoft recommends blocking device code flow as broadly as possible using Conditional Access. This is the correct call. Here's the policy baseline:

| Setting | Recommended configuration |
|---|---|
| Users | All users |
| Exclusions | Emergency-access accounts only, plus separately governed temporary exceptions |
| Target resources | All resources |
| Condition | Authentication flows → Device code flow |
| Access control | Block access |
| Initial state | Report-only |
| Final state | On after impact assessment |

Start in report-only mode. But do not leave the policy there indefinitely—report-only is an assessment state, not a mitigating control. Review the results in Entra sign-in logs, the Conditional Access Insights and Reporting workbook, Log Analytics, Sentinel, and Defender XDR. Once known use cases are identified, enforce.

### Why "require a compliant device" is not enough

Do not attempt to solve device code phishing by requiring the authenticating device to be compliant or hybrid-joined.

The user authenticates in a browser, but the device consuming the code is a different endpoint. Device state cannot be reliably transferred from the browser performing authentication to the device polling the token endpoint. Microsoft documents compliant-device and hybrid-joined-device grant controls as unsupported for this flow.

Block the flow itself.

## Accounting for legitimate device code use

Some environments still have valid uses for device code flow—constrained command-line experiences, older administrative tooling, specialized appliances, or devices without practical browser input. These should be treated as managed exceptions, not as justification for tenant-wide exposure.

### Build an inventory before you enforce the block

Use `AuthenticationProtocol` in Microsoft Entra sign-in logs to identify device code activity before you block anything. For each occurrence, document at minimum:

- User principal name and application display name
- Application/client ID and target resource
- Source IP address, location, and ASN
- User agent and device details
- First and last observed use, frequency
- Conditional Access result and sign-in risk
- Business owner and operational justification

Here's a Sentinel query to get that inventory:

```kusto
SigninLogs
| where TimeGenerated > ago(30d)
| where AuthenticationProtocol =~ "deviceCode"
| extend
    DeviceName = tostring(DeviceDetail.displayName),
    OperatingSystem = tostring(DeviceDetail.operatingSystem),
    Browser = tostring(DeviceDetail.browser)
| summarize
    SignIns = count(),
    FirstSeen = min(TimeGenerated),
    LastSeen = max(TimeGenerated),
    SourceIPs = make_set(IPAddress, 20),
    Applications = make_set(AppDisplayName, 20),
    Resources = make_set(ResourceDisplayName, 20),
    CAResults = make_set(ConditionalAccessStatus, 10)
    by UserPrincipalName, AppId, DeviceName,
       OperatingSystem, Browser, Location,
       RiskLevelDuringSignIn
| order by LastSeen desc
```

### Govern exceptions as privileged access

For every approved exception, document it like a privileged access grant:

- Application and client ID
- Authorized identities, business and technical owners
- Exact operational requirement and expected resources/scopes
- Expected source networks and normal frequency window
- Approval date, **expiration date**, and review cadence
- Migration or retirement plan

Put authorized users in a dedicated, access-reviewed group. Keep it small, avoid nested memberships, alert on membership changes. An exception should expire automatically unless its owner revalidates it.

Where possible, replace device code use entirely:
- Interactive browser authentication for humans
- Workload identities or managed identities for automation
- Certificate-based application authentication for scripts
- Newer versions of Azure CLI, PowerShell, and admin tools that support stronger flows

## Detecting the initial compromise

The highest-value detection window is the short interval between lure and successful authorization. Here's how to cover it.

### 1. Alert on device code use outside the approved inventory

Once legitimate users and applications are documented, every other successful device code authentication is suspicious:

```kusto
let ApprovedUsers = datatable(UserPrincipalName:string)
[
    "approved-user@contoso.com"
];
SigninLogs
| where TimeGenerated > ago(24h)
| where AuthenticationProtocol =~ "deviceCode"
| where ResultType == "0"
| where UserPrincipalName !in~ (ApprovedUsers)
| project
    TimeGenerated,
    UserPrincipalName,
    AppDisplayName,
    AppId,
    ResourceDisplayName,
    IPAddress,
    Location,
    UserAgent,
    SessionId,
    CorrelationId,
    ConditionalAccessStatus,
    RiskLevelDuringSignIn,
    RiskEventTypes_V2
```

In production, the approved inventory should come from a watchlist or identity-governance source rather than being hardcoded.

### 2. Correlate delivery with authorization

Microsoft published a Defender XDR hunting pattern that correlates:

- Clicks involving `microsoft.com/devicelogin` or device authorization endpoints
- Entra sign-in activity for the same user
- Error `50199`, associated with pending device authorization
- A subsequent successful authentication
- Events occurring within minutes of one another

This correlation is much stronger than detecting a visit to the legitimate device-login page alone. Relevant Defender tables include `UrlClickEvents`, `AADSignInEventsBeta`, `EmailEvents`, `EmailUrlInfo`, and `CloudAppEvents`. Keep the correlation window narrow enough to preserve fidelity while accounting for the time required for the user to read the lure, navigate to the verification page, and complete authentication.

### 3. Score the surrounding context

A successful device code sign-in becomes higher confidence when combined with:

- No historical device code use by that user
- An uncommon client ID or an application unrelated to the user's role
- A source IP never previously used by the identity
- Anonymous or hosting-provider infrastructure
- A location inconsistent with surrounding activity
- Risk signals such as `anonymizedIPAddress` or Microsoft Entra threat-intelligence detections
- A device code sign-in shortly after an unsolicited Teams message or email
- Subsequent Microsoft Graph access from a different infrastructure provider
- New device registration within minutes or hours
- Mailbox access outside the user's normal pattern

Regional proxying weakens simple impossible-travel and country-based analytics. Behavioral baselining by client, resource, ASN, session, and follow-on action is more resilient.

### 4. Preserve the right identifiers

Investigators need these to connect the initial sign-in to subsequent Graph, Exchange, device-registration, and application-consent events:

- `SessionId` and `CorrelationId`
- `AppId` and `ResourceServicePrincipalId`
- `IPAddress` and `UserAgent`
- `IncomingTokenType` and authentication details
- Conditional Access evaluations and risk events
- Token-protection status and device/join identifiers

## Hunt for persistence, not just the phish

A device code alert should initiate a persistence investigation. Closing the incident after password reset leaves too much attacker-controlled state unexamined.

### Attacker-controlled device registration

Storm-2372 has registered devices and pursued PRT-backed access. Hunt for device registrations initiated by the compromised identity, especially shortly after device code authentication:

```kusto
CloudAppEvents
| where AccountDisplayName == "Device Registration Service"
| extend ModifiedProperties =
    parse_json(tostring(RawEventData.ModifiedProperties))
| extend
    DeviceObjectId =
        tostring(ModifiedProperties[0].NewValue),
    DeviceName =
        tostring(ModifiedProperties[1].NewValue),
    RegisteredUser =
        tostring(RawEventData.ObjectId)
| project
    Timestamp,
    RegisteredUser,
    DeviceName,
    DeviceObjectId,
    IPAddress,
    UserAgent,
    RawEventData
```

Validate the property order against your tenant's events before operationalizing. Raw audit-event structures can vary.

Correlate registrations with the device code sign-in, new refresh-token activity, Authentication Broker usage, Device Registration Service access, and any PRT-backed authentication. Look for devices without expected Intune enrollment or compliance history.

### OAuth application persistence

Midnight Blizzard has previously abused legacy OAuth applications and created malicious applications, service principals, identities, credentials, and consent grants to preserve access to Exchange Online. This tradecraft was documented in a separate Midnight Blizzard intrusion and should not be assumed in every Storm-2372 case. It is nevertheless essential hunting scope after any high-confidence identity compromise.

Review Microsoft Entra audit logs for:

- Application registrations and service-principal creation
- Added application passwords or certificates
- Delegated permission grants and app-role assignments
- User or administrator consent, including tenant-wide admin consent
- Changes to verified-publisher status
- New owners added to applications
- Changes to Conditional Access, role assignments, or authentication methods

High-impact Exchange permissions such as `full_access_as_app` require immediate investigation.

Defender for Cloud Apps can help surface applications that are recently authorized, unverified, rare in the tenant, authorized by very few users, granted broad permissions, or accessing unusual volumes of mail.

### Mailbox persistence and collection

Storm-2372 has used Microsoft Graph to search compromised mailboxes for high-value terms and exfiltrate matching messages. It has also used compromised accounts to distribute additional device code lures.

Investigate:

- New inbox rules, hidden or unusual forwarding rules, external forwarding
- Delegate access changes, send-as or send-on-behalf grants
- New subscriptions or Graph access patterns
- Large or selective message reads
- Searches for credentials, secrets, remote-access tools, or government-adjacent terms
- Internal phishing sent from the victim account
- Deleted sent items or altered mailbox auditing settings
- Authentication from infrastructure not used during the initial sign-in

**Do not scope the incident only to recipients who clicked.** Search for everyone who received the lure or subsequent internal messages from the compromised account.

### Hybrid identity persistence

Where the compromised identity has access to on-premises resources, correlate cloud activity with Defender for Identity telemetry. Investigate:

- New privileged group memberships
- Directory replication activity
- AD FS access and configuration changes
- Certificate Services abuse and service-account access
- Lateral movement to identity infrastructure
- Suspicious use of remote-management tools

Midnight Blizzard's historical MAGICWEB capability demonstrates why identity-infrastructure monitoring matters here. MAGICWEB required privileged access to AD FS and manipulated claims to authenticate as users. It was not a device code payload, but it illustrates how a cloud identity compromise can become a much deeper persistence operation if privileged infrastructure is reached.

## Responding to a confirmed compromise

Token theft requires a broader response than a password reset. Work through this list:

1. **Disable the account** if active attacker access is suspected.
2. **Revoke sign-in sessions** using Microsoft Graph or the Entra administrative experience.
3. **Reset the password** and verify the integrity of registered authentication methods.
4. **Remove attacker-controlled devices** and disable suspicious device identities. Disabling a device revokes its PRT and associated refresh tokens.
5. **Remove malicious OAuth grants, applications, service principals, and credentials.**
6. **Remove inbox rules, forwarding, delegates, and unauthorized mailbox permissions.**
7. **Review role assignments and privileged group changes.**
8. **Search for lateral phishing** from the compromised mailbox.
9. **Hunt for Graph and Exchange collection** beginning before the first alert—the initial detection date may not be the initial compromise date.
10. **Expand the investigation** to identities, devices, IP addresses, applications, recipients, and resources connected by session and correlation identifiers.
11. **Enforce the Conditional Access block** if device code flow is not required.
12. **Rotate exposed secrets** found in compromised mail, files, scripts, or administrative conversations.

Refresh-token revocation may not immediately terminate every active access token. Disable the identity while containment proceeds to reduce that exposure.

## Designing for long-dwell-time intrusions

This is the section I want you to sit with, because it connects directly to the restaurant story I opened with.

Attack Disruption automatically evicted the attacker once they went interactive—under 18 minutes. That capability is real, it works, and my friend is lucky he had it. But the evidence only established a lower bound: **at least 24 days of successful attacker token refreshes.** The available retention window did not prove that the first observed refresh was initial access. The forensic limit was structural, not permission to invent a more precise timeline.

Long dwell time changes the investigation question from *"What happened around the alert?"* to *"What identity state could the attacker have created since the earliest plausible compromise?"*

Retention and baselining are therefore critical. Organizations should retain sufficient history for:

- Interactive and non-interactive sign-ins
- Microsoft Entra audit events
- Exchange mailbox audit events
- Microsoft Graph activity
- Defender for Cloud Apps events
- Device registration and management events
- Conditional Access policy changes
- Identity Protection risk detections
- Defender for Identity events
- OAuth consent and application changes

Detection engineering should also maintain historical baselines for:

- Device code use by user and application
- Client IDs used by each population
- Normal Graph resources and source networks/ASNs
- Device registrations and consent grants
- Mailbox access volume
- Administrative actions

The safest design is not a single analytic. It is a sequence:

```text
Lure or suspicious message
        ↓
Device-login navigation
        ↓
Pending device authorization
        ↓
Successful device code sign-in
        ↓
Token use against Graph or Exchange
        ↓
Device registration or OAuth changes
        ↓
Mailbox collection, lateral phishing, or persistence
```

Each stage increases confidence. More importantly, the sequence distinguishes an approved administrative workflow from an espionage operation establishing durable access. You can't run this analysis if you don't have the data. The restaurant's available retention was enough to prove a 24-day token-replay path and evict the active session—it was not enough to establish the true initial-access date.

## Final recommendations

For most organizations, the correct target state is clear:

- Block device code flow for all users and resources via Conditional Access.
- Maintain only narrowly scoped, time-bound exceptions with documented owners and expiration dates.
- Alert on every successful use outside the approved inventory.
- Correlate the authorization with message delivery, URL clicks, token activity, Graph access, and device registration.
- Treat device code compromise as token theft, not merely credential phishing.
- Hunt for device, OAuth, mailbox, and hybrid-identity persistence after every high-confidence alert.
- Preserve enough telemetry to investigate months—not just days—of potential attacker activity.

Device code phishing succeeds because the authentication is technically legitimate. Conditional Access provides the control to remove that ambiguity: if your organization doesn't require the flow, don't leave it available to an attacker.

## AI cost

This post is original synthesis and a personal anecdote, not a walkthrough of a specific repo. Blog production cost follows this site's flat model: research ~$0.40, writing ~$0.30, review ~$0.30—approximately **$1.00** total. No source-repo build cost to cite.

## What to steal

1. **Block device code flow now.** Start with a Conditional Access policy in report-only mode, run the KQL inventory query above, and enforce within two weeks. This is the single highest-value action in this post.

2. **Your log retention is your forensic horizon.** The restaurant's available window was enough to prove at least 24 days of token replay but not enough to establish the true initial-access date. For identity infrastructure in Microsoft 365, target 90+ days for sign-in and audit logs. Plan for the attacker's dwell time to exceed whatever you have.

3. **Attack Disruption did its job—but only on the interactive session.** Automatic eviction in under 18 minutes is genuinely impressive. It does not retroactively close the dwell-time gap or replace persistence hunting. Run through the full response list above, including checking OAuth app grants, device registrations, and mailbox rules.

4. **Device code compromise is token theft, not a password incident.** Password reset alone is insufficient. You need to revoke sessions, remove attacker-registered devices, audit OAuth grants, and hunt for collection activity that started before your first alert.

5. **Treat exceptions as privileged access.** Every approved device code carve-out should have a named owner, an expiration date, and a review cadence. If a legitimate use case existed two years ago, it probably has a better alternative today.

6. **Small businesses can run enterprise-quality IR.** My friend runs a restaurant. Using [SecOps Squad](https://github.com/x3nc0n/secops-squad-starter-kit), I completed a comprehensive, report-quality incident response in under a day—with concrete remediation recommendations, not just "change your password." You don't need a SOC team to get SOC-quality output. Read the [incident case study](/2026/08/25/One-Day-Incident-Response-with-an-AI-SecOps-Squad.html), then see [Standing Up an AI Agent Team for the SOC](/2026/07/21/Squad-Standing-Up-an-AI-Agent-Team-for-the-SOC.html) if you want to build the same capability.

7. **Make the attack sequence your hunting checklist.** The lure → device-login navigation → pending auth → successful sign-in → token use → device registration → collection chain is the forensic spine of a Storm-2372 investigation. If you can cover every stage with detection and retention, you can reconstruct the intrusion even when the attacker moves carefully.

## References

- [Microsoft: Storm-2372 conducts device code phishing campaign](https://www.microsoft.com/en-us/security/blog/2025/02/13/storm-2372-conducts-device-code-phishing-campaign/)
- [Microsoft Learn: OAuth 2.0 device authorization grant](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)
- [Microsoft Learn: Block authentication flows with Conditional Access](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-authentication-flows)
- [Microsoft Learn: Conditional Access grant controls](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-grant)
- [Microsoft Learn: Refresh tokens](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens)
- [Microsoft: Midnight Blizzard guidance for responders](https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/)
- [Microsoft: MAGICWEB—NOBELIUM's post-compromise authentication capability](https://www.microsoft.com/en-us/security/blog/2022/08/24/magicweb-nobeliums-post-compromise-trick-to-authenticate-as-anyone/)
- [Microsoft Learn: Investigate risky OAuth applications](https://learn.microsoft.com/en-us/defender-cloud-apps/investigate-risky-oauth)
- [CISA: SVR cyber actors adapt tactics for initial cloud access](https://www.cisa.gov/news-events/cybersecurity-advisories/aa24-057a)
