---
layout: post
title: "Post-Quantum Cryptography: What IT Security Teams Need to Do Right Now"
description: "NIST finalized its first post-quantum cryptographic standards in 2024. Here's what that means for certificate infrastructure, VPNs, and your PKI — and what to do before 'harvest now, decrypt later' attacks catch up."
date: 2026-04-26 09:00:00 -0600
tags: cryptography PKI certificates post-quantum NIST security
---

<!-- DRAFT POST - fill in content below -->

## Introduction

NIST finalized ML-KEM (CRYSTALS-Kyber), ML-DSA (CRYSTALS-Dilithium), and SLH-DSA (SPHINCS+) as FIPS 203/204/205 in August 2024. Nation-state actors are already harvesting encrypted traffic today with the intent to decrypt it once cryptographically-relevant quantum computers arrive. The window to act is now.

This post is for IT security teams — not cryptographers. It covers the practical steps organizations need to take, with a focus on the Microsoft stack.

## Inventory Your Cryptography

- Azure Key Vault certificate lifecycle
- On-premises PKI (Active Directory Certificate Services)
- TLS termination points: load balancers, WAF, API Management

<!-- Reference back to the 2016 "Managing a Microsoft PKI with SharePoint" post -->

## Microsoft's PQC Roadmap

<!-- Summary of Microsoft's stated PQC migration timeline and which products are affected -->

## Priority Actions for the Next 12 Months

1. Complete cryptographic asset inventory
2. Identify "harvest now, decrypt later" exposure (long-lived secrets, healthcare/OT data)
3. Test ML-KEM hybrid TLS where supported (Windows 11 24H2 / Azure)
4. Update PKI certificate templates

## Conclusion
