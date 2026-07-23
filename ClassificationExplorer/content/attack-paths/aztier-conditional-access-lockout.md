---
id: aztier-conditional-access-lockout
name: Conditional Access lockout & tenant extortion
source: Emilien Socchi (AzTier) | https://github.com/emiliensocchi/azure-tiering
severity: Critical
targetTier: ControlPlane
---

## Summary
A Conditional Access (or Security) Administrator can deploy a policy that blocks every user — including Global Administrators and break-glass / emergency-access accounts — from all applications except a single controlled account, rendering the tenant unavailable. AzTier classifies this as a direct, Global-Admin-like path because it affects tenant availability the same way a Global Admin could, enabling a denial-of-service / extortion scenario.

## Prerequisite
A role that can create or modify Conditional Access policies (Conditional Access Administrator or Security Administrator).

## Steps
1. Enumerate the existing Conditional Access policies and the emergency-access / break-glass accounts they exclude.
2. Create a Conditional Access policy that blocks all users for all cloud applications, excluding only a single account you control.
3. Every other principal — including Global Administrators and break-glass accounts — is locked out of the tenant.
4. Demand a ransom to remove the malicious policy (denial of service / extortion).

## Actions
- EntraID | microsoft.directory/conditionalAccessPolicies/create
- EntraID | microsoft.directory/conditionalAccessPolicies/basic/update

## Roles
- EntraID | Conditional Access Administrator
- EntraID | Security Administrator

## References
- Emilien Socchi (AzTier) — Entra roles tiering (Conditional Access Administrator, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- Emilien Socchi — Tiering Entra roles and application permissions based on attack paths | https://www.emiliensocchi.io/tiering-entra-roles-and-application-permissions-based-on-attack-paths/
- MITRE ATT&CK T1531 — Account Access Removal | https://attack.mitre.org/techniques/T1531/
