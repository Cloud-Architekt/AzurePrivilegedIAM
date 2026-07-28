---
id: entra-federated-domain-takeover
name: Federated domain modification backdoor
basedOn: Dr. Nestori Syynimaa | https://aadinternals.com/post/aad-deepdive/
severity: Critical
targetTier: ControlPlane
---

## Summary
An attacker with sufficient privileges can modify an existing federated domain's trust. By pointing the federation trust to an attacker-controlled identity provider with a known signing key, the attacker might forge tokens accepted for users in that domain. The outcome depends on the federation protocol, relying applications, token validation, and any applicable Conditional Access or claim requirements.

## Prerequisite
Administrative access allowing the modification of domain authentication types and federation settings.

## Steps
1. Identify an existing federated domain in the target Entra tenant whose federation settings can be modified.
2. Modify the federation configuration to reference an attacker-controlled identity provider and signing material.
3. Attempt authentication using tokens signed by the attacker-controlled issuer.
4. Access only applications that accept the resulting tokens and claims; do not assume password, MFA, or Conditional Access bypass without validating the application's controls.

## Actions
- EntraID | microsoft.directory/domains/federation/update

## Roles
- EntraID | External Identity Provider Administrator
- EntraID | Security Administrator

## References
- MITRE ATT&CK T1484.002 — Domain Policy Modification: Domain Trust Modification | https://attack.mitre.org/techniques/T1484/002/
- Nestori Syynimaa (AADInternals) — Exploiting Entra ID Identity Federation | https://aadinternals.com/post/aad-deepdive/
