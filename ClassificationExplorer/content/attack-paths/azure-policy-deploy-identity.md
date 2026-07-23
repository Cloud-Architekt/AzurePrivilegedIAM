---
id: azure-policy-deploy-identity
name: Azure Policy deployIfNotExists identity abuse (AZT508)
source: Microsoft (Azure Threat Research Matrix) | https://microsoft.github.io/Azure-Threat-Research-Matrix/Persistence/AZT508/AZT508/
severity: High
targetTier: ControlPlane
---

## Summary
A principal who can author and assign Azure Policy can create a `deployIfNotExists` or `modify` policy that uses a policy-assignment managed identity for remediation. Escalation requires the assignment identity to receive the permissions declared by the policy's `roleDefinitionIds`, and any deployment or role-assignment effect must be allowed by those permissions at the remediation scope.

## Prerequisite
A role that can create the required policy definition and assignment, plus authority to grant the policy-assignment managed identity the roles required for remediation. Resource Policy Contributor can manage policy objects but does not by itself grant the identity Azure RBAC roles.

## Steps
1. Author a `deployIfNotExists` or `modify` policy definition whose `details.roleDefinitionIds` and remediation template would permit the intended change.
2. Create an assignment with a managed identity, then grant that identity the least role required for its remediation scope. This requires independent Azure RBAC authority.
3. Trigger remediation so the managed identity performs the permitted deployment or modification.
4. The policy can reapply the configured change while its assignment and remediation permissions remain in place.

## Actions
- Azure | Microsoft.Authorization/policyDefinitions/write
- Azure | Microsoft.Authorization/policyAssignments/write

## Roles
- Azure | Resource Policy Contributor
- Azure | Owner

## References
- Azure Threat Research Matrix — AZT508 Azure Policy | https://microsoft.github.io/Azure-Threat-Research-Matrix/Persistence/AZT508/AZT508/
- Microsoft Learn — Remediate non-compliant resources with managed identity | https://learn.microsoft.com/azure/governance/policy/how-to/remediate-resources
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
