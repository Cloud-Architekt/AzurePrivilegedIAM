---
id: entra-rmau-group-management-bypass
name: Group / user management escalation on objects unprotected by RMAU
source: Thomas Naunheim | https://www.cloud-architekt.net/restricted-management-administrative-unit/
severity: High
targetTier: ControlPlane
---

## Summary
Security groups and user accounts that carry privileged Azure RBAC or other non-Entra-role access are not protected by default in Entra ID. Service-specific and user/group management roles (Intune, Groups, User Administrator) can modify the membership of such a group — or reset such a user — to inherit its downstream privileges, unless the objects are isolated in a Restricted Management Administrative Unit (RMAU).

## Prerequisite
A role that can manage group membership or user credentials tenant-wide (Groups Administrator, User Administrator, or service-specific roles such as Intune Administrator) over targets not placed in an RMAU.

## Steps
1. Find a non-role-assignable security group (or user) that holds privileged Azure RBAC, Conditional Access exclusion, or other management-plane access and is not protected by an RMAU.
2. Use tenant-level group-management or user-management permissions to add a controlled principal to that group, or reset the target user.
3. Inherit the group’s / user’s downstream privileges (for example Azure Owner via the group’s RBAC assignment, or a Conditional Access exclusion).
4. Pivot from that access toward Control Plane resources or managed identities.

## Actions
- EntraID | microsoft.directory/groups/members/update
- EntraID | microsoft.directory/users/password/update

## Roles
- EntraID | Groups Administrator
- EntraID | User Administrator
- EntraID | Intune Administrator

## References
- Thomas Naunheim — Protection of privileged users and groups by Restricted Management Administrative Units | https://www.cloud-architekt.net/restricted-management-administrative-unit/
- Microsoft Learn — Restricted management administrative units | https://learn.microsoft.com/entra/identity/role-based-access-control/admin-units-restricted-management
- MITRE ATT&CK T1098 — Account Manipulation | https://attack.mitre.org/techniques/T1098/
