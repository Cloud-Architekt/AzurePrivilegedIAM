---
id: entra-federation-golden-saml
name: Federated domain backdoor (Golden SAML)
source: Shaked Reiner (CyberArk) | https://www.cyberark.com/resources/threat-research-blog/golden-saml-newly-discovered-attack-technique-forges-authentication-to-cloud-apps
severity: Critical
targetTier: ControlPlane
---

## Summary
Configuring domain federation or token-signing trust lets an actor forge SAML tokens and impersonate any user in the tenant, including Global Administrators.

## Prerequisite
A role that can update domain federation / authentication configuration.

## Steps
1. Add or modify a federated domain (or its token-signing trust) so that a key you control is trusted.
2. Forge a SAML token asserting any user identity and the desired claims.
3. Present the forged token to access cloud services as that user — bypassing MFA and Conditional Access.

## Actions
- EntraID | microsoft.directory/domains/federation/update
- EntraID | microsoft.directory/domains/federationConfiguration/basic/update

## Roles
- EntraID | Domain Name Administrator
- EntraID | External Identity Provider Administrator
- EntraID | Hybrid Identity Administrator
- EntraID | Security Administrator

## References
- Shaked Reiner (CyberArk) — Golden SAML: Forging authentication to cloud apps | https://www.cyberark.com/resources/threat-research-blog/golden-saml-newly-discovered-attack-technique-forges-authentication-to-cloud-apps
- Dr. Nestori Syynimaa — Unnoticed sidekick: Getting access to cloud as an on-prem admin | https://o365blog.com/post/on-prem_admin/
- MITRE ATT&CK T1606.002 — Forge Web Credentials: SAML Tokens | https://attack.mitre.org/techniques/T1606/002/
