---
id: azure-storage-key-theft
name: Storage account access key dumping (AZT605.1)
basedOn: Microsoft (Azure Threat Research Matrix) | https://microsoft.github.io/Azure-Threat-Research-Matrix/CredentialAccess/AZT605/AZT605-1/
severity: Medium
targetTier: ManagementPlane
---

## Summary
A principal who can list a storage account’s access keys gains full data-plane control of every container, blob, file share, queue and table in that account — bypassing Entra ID data-plane RBAC entirely. This enables reading or tampering with deployment artifacts, scripts, Terraform state and other data that can seed further compromise.

## Prerequisite
A role that can list storage account keys (for example Storage Account Contributor).

## Steps
1. Identify storage accounts in scope and confirm shared-key access is enabled.
2. Call the listKeys action to retrieve the account’s shared access keys.
3. Use the keys for full data-plane access to blobs, files, queues and tables, bypassing Entra RBAC.
4. Read or tamper with stored artifacts (scripts, IaC state, backups) to enable downstream compromise.

## Actions
- Azure | Microsoft.Storage/storageAccounts/listKeys/action

## Roles
- Azure | Storage Account Contributor

## References
- Azure Threat Research Matrix — AZT605.1 Storage Account Access Key Dumping | https://microsoft.github.io/Azure-Threat-Research-Matrix/CredentialAccess/AZT605/AZT605-1/
- Microsoft Learn — Prevent Shared Key authorization for Azure Storage | https://learn.microsoft.com/azure/storage/common/shared-key-authorization-prevent
- MITRE ATT&CK T1552.001 — Credentials In Files | https://attack.mitre.org/techniques/T1552/001/
