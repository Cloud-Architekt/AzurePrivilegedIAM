---
id: entra-conditional-access-tamper
name: Conditional Access policy tampering
basedOn: Microsoft Security | https://learn.microsoft.com/entra/identity/conditional-access/overview
severity: High
targetTier: ControlPlane
---

## Summary
Modifying or disabling Conditional Access can remove the MFA or compliant-device requirements protecting privileged accounts, enabling sign-in or token replay. The same change can be made non-interactively by a service principal with the Microsoft Graph application permission Policy.ReadWrite.ConditionalAccess.

## Prerequisite
Either a role that can manage Conditional Access policies, or control of a service principal consented with Policy.ReadWrite.ConditionalAccess.

## Steps
1. Identify the Conditional Access policies enforcing MFA or device compliance for administrators.
2. Use the delegated role or an app-only Graph token to disable, weaken, or exclude a controlled principal from those policies.
3. Authenticate (or replay a token) without the now-removed control.

## Actions
- EntraID | microsoft.directory/conditionalAccessPolicies/basic/update
- EntraID | microsoft.directory/conditionalAccessPolicies/create
- EntraID | microsoft.directory/conditionalAccessPolicies/delete

## Roles
- EntraID | Conditional Access Administrator
- EntraID | Security Administrator

## Permissions
- Microsoft Graph | Policy.ReadWrite.ConditionalAccess | Application

## References
- Microsoft Learn — Conditional Access overview | https://learn.microsoft.com/entra/identity/conditional-access/overview
- Microsoft Learn — Policy.ReadWrite.ConditionalAccess permission reference | https://learn.microsoft.com/graph/permissions-reference#policyreadwriteconditionalaccess
- MITRE ATT&CK T1556 — Modify Authentication Process | https://attack.mitre.org/techniques/T1556/
