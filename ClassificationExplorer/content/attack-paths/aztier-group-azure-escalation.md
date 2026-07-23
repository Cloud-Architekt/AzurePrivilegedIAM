---
id: aztier-group-azure-escalation
name: Group membership to Azure escalation (Directory Writers)
source: Emilien Socchi (AzTier) | https://github.com/emiliensocchi/azure-tiering
severity: Critical
targetTier: ControlPlane
---

## Summary
Roles that can manage group membership without role-assignable groups (Directory Writers, Groups Administrator and several M365 service-admin roles) can add a principal to a non-role-assignable group that holds privileged Azure RBAC. Via a resource with an attached managed identity that has privileged Microsoft Graph permissions, this yields an indirect path to Global Admin. AzTier tiers these roles as Tier 0 because of this indirect Azure-based escalation.

## Prerequisite
A role that can update the membership of a security group (for example Directory Writers or Groups Administrator).

## Steps
1. Find a non-role-assignable group that is granted privileged Azure RBAC — for example Contributor on a subscription containing a resource with an assigned managed identity.
2. Add your compromised account to that group.
3. Use the group’s Azure access to control the resource and impersonate its managed identity.
4. Abuse the managed identity’s Microsoft Graph application permissions to escalate to Global Admin.

## Actions
- EntraID | microsoft.directory/groups/members/update

## Roles
- EntraID | Directory Writers
- EntraID | Groups Administrator

## References
- Emilien Socchi (AzTier) — Entra roles tiering (Directory Writers, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- Andreas Happe (m365internals) — Lateral Movement with Managed Identities of Azure VMs | https://m365internals.com/2021/11/30/lateral-movement-with-managed-identities-of-azure-virtual-machines/
- MITRE ATT&CK T1098 — Account Manipulation | https://attack.mitre.org/techniques/T1098/
