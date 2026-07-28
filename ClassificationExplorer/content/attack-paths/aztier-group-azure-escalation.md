---
id: aztier-group-azure-escalation
name: Group membership to Azure escalation (Directory Writers)
basedOn: Emilien Socchi | https://github.com/emiliensocchi/azure-tiering
severity: Critical
targetTier: ControlPlane
---

## Summary
Roles that can manage group membership without role-assignable groups (including Directory Writers, Groups Administrator, Identity Governance Administrator, User Administrator, and partner support roles) can add a principal to a non-role-assignable group that holds privileged Azure RBAC. The role is an indirect Control Plane path only when that Azure access can reach a resource or workload identity with Control Plane privileges.

## Prerequisite
A role that can update the membership of a security group (for example Directory Writers, Groups Administrator, Identity Governance Administrator, or User Administrator), plus a non-role-assignable group with Azure RBAC that can reach a resource or workload identity holding Control Plane privileges.

## Steps
1. Find a non-role-assignable group that is granted Azure RBAC sufficient to reach a resource or workload identity with Control Plane privileges.
2. Add your compromised account to that group.
3. Use the group’s Azure access to control the resource or impersonate the workload identity.
4. Use the inherited permissions to operate on the Control Plane.

## Actions
- EntraID | microsoft.directory/groups/members/update

## Roles
- EntraID | Directory Writers
- EntraID | Groups Administrator
- EntraID | Identity Governance Administrator
- EntraID | Partner Tier1 Support
- EntraID | Partner Tier2 Support
- EntraID | User Administrator

## References
- Emilien Socchi — Entra roles tiering (Directory Writers, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- MITRE ATT&CK T1098 — Account Manipulation | https://attack.mitre.org/techniques/T1098/
