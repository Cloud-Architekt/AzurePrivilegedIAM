---
id: idgov-catalog-owner-privileged-provisioning
name: Entitlement Management catalog owner privileged provisioning
basedOn: Thomas Naunheim | https://github.com/Cloud-Architekt/EntraOps
severity: Critical
targetTier: ControlPlane
---

## Summary
A Catalog owner (or AccessPackages manager) over an Entitlement Management catalog that contains a privileged resource — a role-assignable group, a Tier 0 group with an active directory-role assignment, or a privileged application — can publish an access package and an auto-approval assignment policy that provisions that resource, then self-request it to inherit Control Plane access. A service principal with EntitlementManagement.ReadWrite.All has an equivalent app-only, tenant-wide path over catalog-onboarded resources. EntraOps resolves the delegated roles dynamically (scope-aware), so a catalog containing Tier 0 objects makes the delegated role itself Tier 0.

## Prerequisite
Either a delegated Identity Governance role over a catalog containing privileged objects (Catalog owner or AccessPackages manager), or control of a service principal consented with EntitlementManagement.ReadWrite.All.

## Steps
1. Identify an access-package catalog that contains a privileged resource (for example a role-assignable group with an active Global Administrator assignment).
2. As Catalog owner, or with an app-only Graph token, create an access package that provisions membership of that group, with an assignment policy that auto-approves requests from a controlled principal.
3. Request the access package for a controlled account and receive the privileged group membership.
4. Inherit the group’s directory-role assignment to operate with Control Plane access.

## Actions
- IdentityGovernance | microsoft.entitlementManagement/allEntities/allTasks

## Roles
- IdentityGovernance | Catalog owner
- IdentityGovernance | AccessPackages manager

## Permissions
- Microsoft Graph | EntitlementManagement.ReadWrite.All | Application

## References
- Thomas Naunheim — Classification of Identity Governance delegation and roles | https://github.com/Cloud-Architekt/EntraOps
- Microsoft Learn — Delegate access governance to access package managers | https://learn.microsoft.com/entra/id-governance/entitlement-management-delegate
- Microsoft Learn — EntitlementManagement.ReadWrite.All permission reference | https://learn.microsoft.com/graph/permissions-reference#entitlementmanagementreadwriteall
- Emilien Socchi — Tiering Entra roles and application permissions based on attack paths | https://www.emiliensocchi.io/tiering-entra-roles-and-application-permissions-based-on-attack-paths/
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
