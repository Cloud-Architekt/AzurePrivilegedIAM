---
id: idgov-assignment-manager-direct-grant
name: Access package assignment manager direct grant
basedOn: Microsoft Security | https://learn.microsoft.com/entra/id-governance/entitlement-management-delegate
severity: High
targetTier: ControlPlane
---

## Summary
An AccessPackage assignment manager can create access-package assignments and grants directly — bypassing the access package’s request and approval workflow. If a catalog publishes an access package that provisions a privileged group or application role, the assignment manager can grant it straight to a controlled account, sidestepping approvals and access reviews.

## Prerequisite
The AccessPackage assignment manager delegated role over a catalog that publishes access packages provisioning privileged access.

## Steps
1. Identify an access package that provisions privileged access (for example membership of a Tier 0 group).
2. As assignment manager, create a direct assignment / grant of that access package to a controlled account, bypassing the request-and-approval policy.
3. The account receives the provisioned privileged group membership or application role.
4. Use the inherited access to reach Control Plane resources.

## Actions
- IdentityGovernance | microsoft.entitlementManagement/AccessPackageCatalog/AccessPackage/GrantRequests/allTasks
- IdentityGovernance | microsoft.entitlementManagement/AccessPackageCatalog/AccessPackage/Grants/allTasks

## Roles
- IdentityGovernance | AccessPackage assignment manager

## References
- Microsoft Learn — Delegate access governance to access package managers | https://learn.microsoft.com/entra/id-governance/entitlement-management-delegate
- Microsoft Learn — View, add, and remove access package assignments | https://learn.microsoft.com/entra/id-governance/entitlement-management-access-package-assignments
- Thomas Naunheim — Classification of Identity Governance delegation and roles | https://github.com/Cloud-Architekt/EntraOps
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
