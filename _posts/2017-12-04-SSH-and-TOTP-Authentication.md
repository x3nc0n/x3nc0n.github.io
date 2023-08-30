---
layout: post
title:  "SSH Key & TOTP Authentication"
description: "Two-factor SSH for extra security"
categories: IWS security network nmap rapid7 insightvm kali azure
---

I recently tried to setup SSH key + TOTP authentication to my Wordpress server. This proved to be a bit harder than I thought it would be, since there are guides to do exactly that on my VPS provider. I am guessing versions of PAM and SSH have changed configuration a bit or something. I'll show you how to set this up below. Note that I followed <a href="https://www.digitalocean.com/community/tutorials/how-to-set-up-multi-factor-authentication-for-ssh-on-ubuntu-16-04">this tutorial from DigitalOcean</a>, so this post is going to roughly follow that one.

I'm going to assume you've done the following:
<ol>
 	<li>Disable root login via SSH (DO IT!)</li>
 	<li>Configure SSH key authentication for your user that is in sudoers</li>
</ol>
If you haven't done either of those, Google it. Plenty of people have written it up.

"Step 0" when doing things like this: SNAPSHOT!!!

Follow everything in <a href="https://www.digitalocean.com/community/tutorials/how-to-set-up-multi-factor-authentication-for-ssh-on-ubuntu-16-04">DigitalOcean's post</a> thru Step 1, which installs Google Authenticator and does the initial configuration of it.

If you choose to live dangerously and don't snapshot, that's your risk to take. Good luck, brave adventurer.

My procedure changes at Step 2:
<h3>/etc/pam.d/sshd</h3>
Comment out this line:
<pre>@include common-auth</pre>
Now it should be:
<pre># @include common-auth</pre>
Add this line to the bottom:
<pre>auth required pam_google_authenticator.so nullok</pre>
(You can remove the "nullok" after all users have enrolled their TOTP device.)
<h3>/etc/ssh/sshd_config</h3>
Add the following line at the bottom of the file:
<pre>AuthenticationMethods publickey,keyboard-interactive</pre>
Restart sshd:
<pre>service sshd restart</pre>
Duplicate your session &amp; test that it works before disconnecting (or you could lock yourself out of SSH forever).