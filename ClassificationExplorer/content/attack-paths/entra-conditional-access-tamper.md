---
id: entra-conditional-access-tamper
name: Conditional Access policy tampering
basedOn: Microsoft Security | https://learn.microsoft.com/entra/identity/conditional-access/overview
severity: High
targetTier: ControlPlane
---

## Summary
Modifying or disabling Conditional Access can remove the MFA / compliant-device requirements protecting privileged accounts, enabling sign-in or token replay.

## Prerequisite
A role that can manage Conditional Access policies.

## Steps
1. Identify the Conditional Access policies enforcing MFA or device compliance for administrators.
2. Disable, weaken or exclude a controlled principal from those policies.
3. Authenticate (or replay a token) without the now-removed control.

## Actions
- EntraID | microsoft.directory/conditionalAccessPolicies/basic/update
- EntraID | microsoft.directory/conditionalAccessPolicies/create
- EntraID | microsoft.directory/conditionalAccessPolicies/delete

## Roles
- EntraID | Conditional Access Administrator
- EntraID | Security Administrator

## References
- Microsoft Learn — Conditional Access overview | https://learn.microsoft.com/entra/identity/conditional-access/overview
- MITRE ATT&CK T1556 — Modify Authentication Process | https://attack.mitre.org/techniques/T1556/
