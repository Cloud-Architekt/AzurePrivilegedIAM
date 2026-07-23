---
id: azure-rbac-escalation
name: Azure RBAC role assignment escalation
source: Fabian Bader (cloudbrothers) | https://cloudbrothers.info/en/azure-attack-paths/
severity: Critical
targetTier: ControlPlane
---

## Summary
Write access to role assignments (User Access Administrator or Owner) lets a principal grant itself Owner over subscriptions and resources, including Tier 0 resources.

## Prerequisite
A role containing Microsoft.Authorization/roleAssignments/write at the target scope.

## Steps
1. Identify the scope (management group, subscription, resource) where you hold roleAssignments/write.
2. Create a role assignment granting a controlled principal the Owner (or another privileged) role.
3. Use the new Owner rights to manage resources and any attached managed identities.

## Actions
- Azure | Microsoft.Authorization/roleAssignments/write

## Roles
- Azure | Owner
- Azure | Role Based Access Control Administrator
- Azure | User Access Administrator


## References
- Microsoft Learn — Elevate access to manage all subscriptions | https://learn.microsoft.com/azure/role-based-access-control/elevate-access-global-admin
- Fabian Bader (cloudbrothers) — Azure Attack Paths: Elevate Azure Subscription Access | https://cloudbrothers.info/en/azure-attack-paths/
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
