---
layout: post
title:  "Edmond Public Schools Server Exposing Potentially Vulnerable Services to Internet Since 2019"
description: "Edmond Public Schools has been running a server exposing WinRM & RDP to the Internet since January 2019"
categories: security schools government COVID COVID-19
---

Sending my children back to school during the second (third?) phase of COVID-19 has been a challenge in many ways. I'm sure everyone has experienced problems, but since this is a technology-focused site and I'm a security guy, I'm going to focus on something that isn't about masks, vaccines, or all the ususal stuff. Our schools have long collected some amount of personal health data on enrolled children, even families. Sometimes, this data is structured, like a checkbox in a form that indicates your child has an allergy to peanuts, which ends up in a database or spreadsheet. Sometimes it's just scanned paper or digital forms, like PDFs with structured text; these are a little harder to aggregate and read, but with modern search engine technologies it's actually very easy for someone with access to this type of unstructured or semi-structured data to extract and aggregate it. However, with COVID-19 we're starting to stray into new territory: individual student's COVID test results are being emailed to schools, Google Forms are being filled out, and my own school district, Edmond Public Schools (EPS) in Oklahoma, recently requested voluntary submission of the vaccination status of my 8th grader via email. This started me wondering, "What are they doing with all this information? How are they protecting it? Will they ever get rid of it?"

I decided to conduct a quick check. Email is a poor medium for the submission of this kind of information, but it's common enough (unfortunately), even in healthcare settings. A basic check (and some prior knowledge) confirmed that EPS is using Google's Gmail for most of their mail services. There were also two IPv4 addresses in the Sender Policy Framework (SPF) entry that caught my eye; they look like email relay servers running SMTP. I checked Shodan for them and found that one has been running with Remote Desktop Protocol (RDP; TCP/3389) and Windows Remote Management (WinRM; TCP/5985) since at least January 2019. This doesn't bode well, but things do happen by mistake; firewall changes are improperly entered and this kind of thing happens by accident.

On Tuesday, August 31st, 2021, I contacted EPS IT via their "Tech Help" link for parents. I explained what I had found and the configuration of this potentially vulnerable server. The first response was classic; to paraphrase "There's a firewall; it's fine." So I sent a screenshot of my TCP connection to the RDP port, and the Director of Technology was looped into the email. I also asked how EPS was handling all this data. His response, "We will review both the potential exploits you have suggested and our policy of medical record information transfer." Not exactly overwhelming in its detail but a step in the right direction.

On Friday, I tested and found that the remote ports were still exposed. I emailed the superintendent about the issue and received a similarly dismissive response: "...if you have any concerns about submitting the documentation by email, that you instead deliver it directly to the school.  It isn't required that it be submitted by email." Unfortunately, this doesn't address my concern with the protection and data governance of the data, regardless of the method by which I submit it.

For clarity, all I have done is test that the server is allowing connections on these ports. I have seen historic data on [Shodan](https://www.shodan.io/host/164.58.74.28), an Internet security scanning service, that indicates the ports are running the traditional services and have been since January 2019. I have not conducted any vulnerability scanning; I do not *know* that there are vulnerabilities in the versions of the services running. I do know that RDP and WinRM are frequently found to be vulnerable, especially if left unpatched. If these services have been running since 2019 and exposed like this, I believe it possible that someone could have compromised this server and used that foothold to gain access to other parts of EPS' network and/or data. This is a well-known attack pattern; malicious actors find a vulnerable service, exploit it, and move about the other systems in search of more valuable data. Further, EPS provides iPad and Chromebook devices that are necessarily connected to our home Internet connections for remote learning. I isolate their devices on a separate network, but an attacker would have a great opportunity to gain access to household networks without that configuration capability to know-how if they could pivot into the device management platform.

Also, I'm not "announcing a vulnerability" or "dropping an 0-day"; this is a configuration that would take about five minutes to fix if anyone could be bothered to change it. If the response to my emails had been more along the lines of, "oops, thanks, we're going to address that Monday," I wouldn't be as bothered. The response I am getting is typical of an organization that doesn't prioritize security or privacy, which places my children's data at risk. It's impossible to quantify the level of risk without knowing more about EPS' systems.

Today, Monday, September 6th, 2021, as I finish this and publish it on my personal site, the remote ports are *still* open. EPS has not addressed my inquiry about the protection and governance of this data. I plan to continue raising awareness of not just this potentially vulnerable configuration but the complete lack of visibility into the policies that concern my children's data.

Finally, when an organization finds out about these types of exposures, there is usually an effort to discover if anyone *did* exploit a vulnerability and attempt to access the server. I am hoping to inspire EPS to conduct such an investigation. It is *possible* that over the last 2 years someone noticed these services were exposed and exploited a vulnerability in them and is already elsewhere in connected systems. Even if this server is fairly isolated, password reuse by the administrator could lead to an attacker obtaining access elsewhere. The only problem is that an organization that responds this dismissively is usually completely unprepared to do any incident investigation; they won't even have the logs that could show an attacker did or did not get in, and no one will ever know if any data given to EPS has been taken.

## Try It Yourself

Want to see if EPS has fixed this? Run the following command on your Windows PowerShell terminal. All it does is open a TCP connection to the server and return 'True' if it works.

```tnc 164.58.74.28 -port 3389```

You should get something like this:

```text
ComputerName     : 164.58.74.28
RemoteAddress    : 164.58.74.28
RemotePort       : 3389
InterfaceAlias   : Ethernet
SourceAddress    : 192.168.50.58
TcpTestSucceeded : True
```

If TcpTestSucceeded is 'True', RDP is still open.

## Update 2021.09.15

EPS emailed me and they have closed the ports.
