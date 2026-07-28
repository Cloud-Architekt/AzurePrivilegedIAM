---
id: aztier-identity-governance-accesspackage
name: Access package assignment policy abuse (Identity Governance)
basedOn: Emilien Socchi | https://github.com/emiliensocchi/azure-tiering
severity: Critical
targetTier: ControlPlane
---

## Summary
An Identity Governance Administrator can modify the assignment policy of an Entitlement Management access package that provisions a Control Plane-capable resource — for example membership of a group with privileged Azure RBAC or an active directory-role assignment — so the package can be self-requested without approval. The role is an indirect Control Plane path only when such a resource is present in an accessible catalog.

## Prerequisite
The Identity Governance Administrator role (or equivalent Entitlement Management catalog rights), plus an accessible access package that provisions a resource, group, or workload identity with Control Plane privileges.

## Steps
1. Identify an access package that provisions access to a Control Plane-capable resource, group, or workload identity.
2. Add or modify an assignment policy on the access package so it can be requested by your compromised account without manual approval.
3. Request the access package and receive the privileged access.
4. Use the inherited permissions to operate on the Control Plane.

## Actions
- EntraID | microsoft.directory/entitlementManagement/allProperties/allTasks

## Roles
- EntraID | Identity Governance Administrator

## References
- Emilien Socchi — Entra roles tiering (Identity Governance Administrator, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- Microsoft Learn — Entitlement management access packages | https://learn.microsoft.com/entra/id-governance/entitlement-management-overview
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
