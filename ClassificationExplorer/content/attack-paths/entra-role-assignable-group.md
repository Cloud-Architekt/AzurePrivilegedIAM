---
id: entra-role-assignable-group
name: Role-assignable group takeover
basedOn: Microsoft Learn | https://learn.microsoft.com/entra/identity/role-based-access-control/groups-concept
severity: High
targetTier: ControlPlane
---

## Summary
A role-assignable group (`isAssignableToRole` = `true`) inherits any directory role assigned to it into every member. By default, Privileged Role Administrator (and Global Administrator) can manage the membership of a role-assignable group, but that management can be delegated to non-admin **group owners** — an owner of the group can add/remove members and does not need to hold Privileged Role Administrator (or any directory role) themselves. Either way, the operation requires the `RoleManagement.ReadWrite.Directory` Microsoft Graph permission; the regular group-management permission `Group.ReadWrite.All` explicitly does not work for role-assignable groups. Compromising a Privileged Role Administrator, an owner of the group, or a service principal consented with `RoleManagement.ReadWrite.Directory` lets an actor add a controlled principal to the group and inherit its role.

## Prerequisite
One of the following over the role-assignable group:
- The Privileged Role Administrator (or Global Administrator) role.
- Being a delegated owner of the role-assignable group (does not require any directory role).
- Control of a service principal consented with the Microsoft Graph application permission `RoleManagement.ReadWrite.Directory`.

## Steps
1. Find a role-assignable security group that is assigned a privileged directory role, either as an active assignment or as a PIM-eligible assignment.
2. Identify a principal with rights to manage its membership — a Privileged Role Administrator, a delegated group owner, or a service principal holding `RoleManagement.ReadWrite.Directory`.
3. Add a principal you control as a member of that group, or — if the group only has a PIM-eligible role assignment — activate the eligible assignment for a member you control.
4. Inherit the group’s role assignment and act with its privileges.

## Actions
- EntraID | microsoft.directory/groupsAssignableToRoles/allProperties/update

## Permissions
- Microsoft Graph | RoleManagement.ReadWrite.Directory | Application

## Roles
- EntraID | Privileged Role Administrator

## References
- Microsoft Learn — Use Microsoft Entra groups to manage role assignments | https://learn.microsoft.com/entra/identity/role-based-access-control/groups-concept
- Microsoft Learn — Assign eligibility for a group in Privileged Identity Management | https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/groups-assign-member-owner
- MITRE ATT&CK T1098 — Account Manipulation | https://attack.mitre.org/techniques/T1098/
