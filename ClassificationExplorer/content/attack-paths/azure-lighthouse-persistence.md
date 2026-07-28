---
id: azure-lighthouse-persistence
name: Azure Lighthouse delegated-access persistence (AZT507.1)
basedOn: Microsoft (Azure Threat Research Matrix) | https://microsoft.github.io/Azure-Threat-Research-Matrix/Persistence/AZT507/AZT507-1/
severity: High
targetTier: ManagementPlane
---

## Summary
An actor who can deploy the required Azure Lighthouse delegation at a subscription or resource-group scope can onboard that scope to an attacker-controlled managing tenant. This creates persistent cross-tenant access for authorized principals in the external tenant and is not removed by resetting credentials in the customer tenant.

## Prerequisite
A principal in the customer tenant with the permissions required to deploy the onboarding template, including `Microsoft.Authorization/roleAssignments/read`, `write`, and `delete` at the target scope. Owner is a common role that supplies these permissions. The delegated authorizations must use Azure Lighthouse-supported built-in roles; Owner, DataActions, and restricted actions cannot be delegated.

## Steps
1. Create an Azure Lighthouse registration definition referencing the attacker-controlled managing tenant and principals.
2. Create a registration assignment binding the victim subscription / resource group to that definition.
3. Principals in the external tenant now hold persistent delegated Azure RBAC over the victim resources.
4. Operate cross-tenant until a customer-tenant principal removes or replaces the delegation; monitor Service provider offers and `Microsoft.ManagedServices` changes to detect it.

## Actions
- Azure | Microsoft.ManagedServices/registrationAssignments/write

## Roles
- Azure | Owner

## References
- Azure Threat Research Matrix — AZT507.1 Azure Lighthouse | https://microsoft.github.io/Azure-Threat-Research-Matrix/Persistence/AZT507/AZT507-1/
- Microsoft Learn — Azure Lighthouse overview | https://learn.microsoft.com/azure/lighthouse/overview
- Microsoft Learn - Onboard a customer to Azure Lighthouse | https://learn.microsoft.com/en-us/azure/lighthouse/how-to/onboard-customer
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
