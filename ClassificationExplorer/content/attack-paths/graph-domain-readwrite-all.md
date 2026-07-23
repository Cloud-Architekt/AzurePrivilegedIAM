---
id: graph-domain-readwrite-all
name: Federated-domain backdoor / forged SAML via Domain.ReadWrite.All
source: Nestori Syynimaa (AADInternals) | https://aadinternals.com/post/aadbackdoor/
severity: Critical
targetTier: ControlPlane
---

## Summary
Domain.ReadWrite.All allows adding, verifying and reconfiguring tenant domains, including switching a domain to federated authentication and setting its issuer URI and token-signing certificate. An attacker who controls the federation trust can mint SAML tokens for any user whose ImmutableId is known — including Global Administrators — bypassing passwords and MFA. This is a classic, stealthy full-tenant-takeover and persistence primitive.

## Prerequisite
Control of a principal holding Domain.ReadWrite.All, often obtained by adding credentials to a highly privileged first-party service principal after gaining Application Administrator or equivalent.

## Steps
1. Authenticate with the permission and add or convert a domain to use federated authentication.
2. Register an attacker-controlled issuer URI and token-signing certificate for the domain.
3. Obtain a target user's ImmutableId / UPN.
4. Forge a signed SAML token to authenticate as that user — including Global Administrator — with no credentials or MFA.

## Permissions
- Microsoft Graph | Domain.ReadWrite.All | Application

## Roles
- EntraID | Application Administrator

## References
- Nestori Syynimaa (AADInternals) — Creating an Azure AD backdoor with federation | https://aadinternals.com/post/aadbackdoor/
- Katie Knowles (Datadog Security Labs) — I SPy: Escalating to Global Admin with a first-party app | https://securitylabs.datadoghq.com/articles/i-spy-escalating-to-entra-id-global-admin/
- Mandiant — Detecting Microsoft 365 and Azure Active Directory Backdoors | https://cloud.google.com/blog/topics/threat-intelligence/detecting-microsoft-365-azure-active-directory-backdoors
- Clément Notin (Tenable) — Stealthy persistence via federated auth secondary token-signing cert | https://medium.com/tenable-techblog/stealthy-persistence-privesc-in-entra-id-by-using-the-federated-auth-secondary-token-signing-cert-876b21261106
