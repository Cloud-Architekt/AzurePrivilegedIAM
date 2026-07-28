---
id: entra-role-assignment-escalation
name: Directory role assignment self-escalation
basedOn: Microsoft Security | https://learn.microsoft.com/entra/identity/role-based-access-control/privileged-roles-permissions
severity: Critical
targetTier: ControlPlane
---

## Summary
The ability to manage role assignments or role definitions lets an actor grant themselves Global Administrator or any other directory role.

## Prerequisite
A role that can write directory role assignments / definitions (for example Privileged Role Administrator).

## Steps
1. Enumerate assignable directory roles and the highest-privilege ones (Global Administrator, Privileged Role Administrator).
2. Assign the privileged role to a principal you control (or create a custom role with control-plane actions).
3. Activate / use the new role to control the identity fabric.

## Actions
- EntraID | microsoft.directory/roleAssignments/allProperties/allTasks
- EntraID | microsoft.directory/roleDefinitions/allProperties/allTasks

## Roles
- EntraID | Privileged Role Administrator

## References
- Microsoft Learn — Privileged roles and permissions | https://learn.microsoft.com/entra/identity/role-based-access-control/privileged-roles-permissions
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
