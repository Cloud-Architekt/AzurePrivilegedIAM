---
id: azure-elevated-access-toggle
name: Elevated Access toggle to Azure root scope (AZT402)
basedOn: Microsoft (Azure Threat Research Matrix) | https://microsoft.github.io/Azure-Threat-Research-Matrix/PrivilegeEscalation/AZT402/AZT402/
severity: Critical
targetTier: ControlPlane
---

## Summary
A Global Administrator can enable the tenant-level "Access management for Azure resources" setting. The operation assigns that user the User Access Administrator role at Azure root scope (`/`), allowing them to view resources and assign Azure roles throughout the tenant. It is a direct Entra-to-Azure control-plane bridge; it does not itself grant resource-management permissions until a further Azure role assignment is made.

## Prerequisite
An active Global Administrator role in Microsoft Entra ID. The setting is per user, and the user must remove the resulting root-scope User Access Administrator assignment or set the toggle back to `No` to revoke it.

## Steps
1. As Global Administrator, enable "Access management for Azure resources" in the Entra ID properties (the elevateAccess operation).
2. This assigns the User Access Administrator role at the root scope "/" across the entire Azure hierarchy.
3. Assign Owner (or any role) to a controlled principal on the target management groups and subscriptions.
4. Operate with full control-plane access over all Azure resources in the tenant.

## Actions
The `Microsoft.Authorization/elevateAccess/action` provider operation is intentionally documented here but is not an Azure RBAC role-definition action in the local classification data.

## Roles
- EntraID | Global Administrator

## References
- Azure Threat Research Matrix — AZT402 Elevated Access Toggle | https://microsoft.github.io/Azure-Threat-Research-Matrix/PrivilegeEscalation/AZT402/AZT402/
- Microsoft Learn — Elevate access to manage all Azure subscriptions and management groups | https://learn.microsoft.com/azure/role-based-access-control/elevate-access-global-admin
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
