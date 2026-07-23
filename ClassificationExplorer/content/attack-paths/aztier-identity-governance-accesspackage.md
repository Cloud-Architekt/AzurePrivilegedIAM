---
id: aztier-identity-governance-accesspackage
name: Access package assignment policy abuse (Identity Governance)
source: Emilien Socchi (AzTier) | https://github.com/emiliensocchi/azure-tiering
severity: Critical
targetTier: ControlPlane
---

## Summary
An Identity Governance Administrator can modify the assignment policy of an Entitlement Management access package that provisions privileged access — for example membership of a group with an active Global Administrator assignment — so the package can be self-requested without approval, escalating to Global Admin via group membership.

## Prerequisite
The Identity Governance Administrator role (or equivalent Entitlement Management catalog rights).

## Steps
1. Identify an access package that provisions access to a privileged group (for example one with an active Global Administrator role assignment).
2. Add or modify an assignment policy on the access package so it can be requested by your compromised account without manual approval.
3. Request the access package and receive the privileged group membership.
4. Inherit the group’s Global Administrator assignment.

## Actions
- EntraID | microsoft.directory/entitlementManagement/allProperties/allTasks

## Roles
- EntraID | Identity Governance Administrator

## References
- Emilien Socchi (AzTier) — Entra roles tiering (Identity Governance Administrator, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- Microsoft Learn — Entitlement management access packages | https://learn.microsoft.com/entra/id-governance/entitlement-management-overview
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
