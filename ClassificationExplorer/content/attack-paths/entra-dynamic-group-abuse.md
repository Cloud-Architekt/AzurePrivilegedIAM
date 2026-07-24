---
id: entra-dynamic-group-abuse
name: Dynamic Group membership rule manipulation
source: Microsoft Learn | https://learn.microsoft.com/en-us/entra/identity/users/groups-dynamic-membership
severity: High
targetTier: ControlPlane
---

## Summary
By modifying the dynamic membership rule of a dynamic security group that has been granted privileged Azure RBAC, an attacker can construct a rule that explicitly matches their own low-privilege user account. Entra ID will automatically add the attacker to the privileged group. This only applies to ordinary dynamic security groups: role-assignable groups (`isAssignableToRole` = `true`) can never use dynamic membership — their membership type must be `Assigned` — so this technique cannot target a role-assignable group directly. The path also only works against groups (and the attacker's own user object) that are not isolated in a Restricted Management Administrative Unit (RMAU), since RMAU-protected objects can't be modified by tenant-wide Groups/User/Intune Administrator roles.

## Prerequisite
Permissions to update dynamic group membership rules (or the attacker's own matched user attribute) for an existing privileged dynamic security group that is not protected by an RMAU.

## Steps
1. Identify a dynamic security group — not a role-assignable group — that holds privileged access (e.g., Azure RBAC Owner) and is not placed in an RMAU.
2. Edit the dynamic membership rule of the group to include a condition that matches an attacker-controlled user (e.g., matching the exact `userPrincipalName` or a specific extension attribute), or update the attacker's own user attribute to match the existing rule.
3. Wait for the Entra ID dynamic group processing engine to update the membership.
4. Inherit the group's privileged access once the user is automatically added.

## Actions
- EntraID | microsoft.directory/groups/dynamicMembershipRule/update
- EntraID | microsoft.directory/users/basic/update

## Roles
- EntraID | Groups Administrator
- EntraID | Intune Administrator
- EntraID | User Administrator

## References
- Microsoft Docs — Dynamic membership rules for groups | https://learn.microsoft.com/en-us/entra/identity/users/groups-dynamic-membership
- Microsoft Learn — Use Microsoft Entra groups to manage role assignments (role-assignable groups can't use dynamic membership) | https://learn.microsoft.com/entra/identity/role-based-access-control/groups-concept
- MITRE ATT&CK T1098.004 — Account Manipulation: Cloud Groups | https://attack.mitre.org/techniques/T1098/004/
