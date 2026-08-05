---
id: aztier-identity-governance-accesspackage
name: Access package assignment policy abuse (Identity Governance)
basedOn: Emilien Socchi | https://github.com/emiliensocchi/azure-tiering
severity: Critical
targetTier: ControlPlane
---

## Summary
An Identity Governance Administrator, or a service principal granted the Microsoft Graph application permission EntitlementManagement.ReadWrite.All, can modify the assignment policy of an Entitlement Management access package that provisions a Control Plane-capable resource — for example membership of a group with privileged Azure RBAC or an active directory-role assignment — so the package can be self-requested without approval. The path is relevant only when such a resource is present in a catalog; the application permission operates app-only and is not limited to a delegated catalog scope.

## Prerequisite
Either the Identity Governance Administrator role (or equivalent Entitlement Management catalog rights), or control of a service principal consented with EntitlementManagement.ReadWrite.All. In both cases, an accessible access package must provision a resource, group, or workload identity with Control Plane privileges.

## Steps
1. Identify an access package that provisions access to a Control Plane-capable resource, group, or workload identity.
2. Use the delegated role or app-only Graph token to add or modify an assignment policy so the package can be requested by a controlled account without manual approval.
3. Request the access package and receive the privileged access.
4. Use the inherited permissions to operate on the Control Plane.

## Actions
- EntraID | microsoft.directory/entitlementManagement/allProperties/allTasks

## Roles
- EntraID | Identity Governance Administrator

## Permissions
- Microsoft Graph | EntitlementManagement.ReadWrite.All | Application
- Microsoft Graph | EntitlementManagement.ReadWrite.All | Delegated

## References
- Emilien Socchi — Entra roles tiering (Identity Governance Administrator, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- Microsoft Learn — Entitlement management access packages | https://learn.microsoft.com/entra/id-governance/entitlement-management-overview
- Microsoft Learn — EntitlementManagement.ReadWrite.All permission reference | https://learn.microsoft.com/graph/permissions-reference#entitlementmanagementreadwriteall
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
