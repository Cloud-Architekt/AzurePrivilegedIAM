---
id: entra-pass-through-auth-agent
name: Pass-Through Authentication (PTA) Agent takeover
source: Nestori Syynimaa (AADInternals) | https://o365blog.com/post/pta/
severity: Critical
targetTier: ControlPlane
---

## Summary
Microsoft Entra Pass-Through Authentication (PTA) validates sign-ins against on-premises Active Directory via lightweight PTA Agents (Microsoft Azure AD Connect Authentication Agent). An attacker with Local Administrator / SYSTEM rights on a server running a PTA agent can export the agent's certificate and its "bootstrap" configuration from the certificate store, then use that stolen material to stand up a hijacked agent instance on attacker-controlled infrastructure. Because the agent keeps using the original bootstrap, its IP address in the Entra ID portal never changes, so the attacker can inject a credential-harvesting/backdoor DLL (for example PTASpy) into the impersonated agent to always report "authentication successful" regardless of the password, and/or log every plaintext credential submitted by real users — without registering a new, detectable agent.

## Prerequisite
Local Administrator (SYSTEM) access to an on-premises server running the Microsoft Azure AD Connect Authentication Agent (PTA agent), so the agent's certificate and private key can be exported from the local machine / service-account certificate store.

## Steps
1. Gain Local Administrator / SYSTEM access to a server that runs the PTA agent.
2. Export the PTA agent's certificate (with private key) and its bootstrap configuration from the certificate store and `TrustSettings.xml`.
3. Install a genuine PTA agent binary on attacker-controlled infrastructure, configure it to use the stolen certificate, and serve the stolen bootstrap locally so the agent's IP address in Entra ID never changes.
4. Inject a backdoor/credential-harvesting DLL into the hijacked agent so it accepts any password as valid sign-in and/or logs plaintext credentials for every pass-through authentication request.

## Actions
- EntraID | microsoft.directory/onPremisesSynchronization/basic/update
- EntraID | microsoft.directory/hybridAuthenticationPolicy/allProperties/allTasks

## Roles
- EntraID | Hybrid Identity Administrator

## References
- Nestori Syynimaa (AADInternals) — Exploiting Azure AD PTA vulnerabilities: Creating backdoor and harvesting credentials | https://o365blog.com/post/pta/
- Secureworks — Azure Active Directory Pass-Through Authentication Flaws | https://www.secureworks.com/research/azure-active-directory-pass-through-authentication-flaws
- Adam Chester (xpn) — Azure AD Connect for Red Teamers | https://blog.xpnsec.com/azuread-connect-for-redteam/
- MITRE ATT&CK T1556 — Modify Authentication Process | https://attack.mitre.org/techniques/T1556/
