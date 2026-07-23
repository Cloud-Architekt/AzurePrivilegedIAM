---
id: azure-inhibit-backup-recovery
name: Inhibit system recovery (Azure Backup deletion)
source: Microsoft Azure Threat Research Matrix | https://microsoft.github.io/Azure-Threat-Research-Matrix/Impact/DataDestruction/
severity: Critical
targetTier: ManagementPlane
---

## Summary
Ransomware operators and malicious actors target backup infrastructure before deploying destructive actions to prevent recovery. An attacker with adequate permissions might be able to alter backup configuration, stop protection, or delete protected items. The recovery impact depends on workload, vault type, API version, and the configured soft-delete and multi-user authorization protections.

## Prerequisite
Azure RBAC permissions to manage the relevant Recovery Services vault configuration and protected items. The described permanent-deletion outcome additionally requires a configuration and region where the applicable soft-delete safeguards can be disabled or bypassed.

## Steps
1. Identify Azure Recovery Services Vaults containing critical database and virtual machine backups.
2. Assess the vault's soft-delete and multi-user authorization settings. Secure-by-default soft delete prevents immediate permanent deletion in supported configurations.
3. Stop backup protection for the targeted workloads.
4. Permanently delete the existing backup data.
5. Deploy ransomware or destroy primary workloads; determine recoverability from the vault configuration and retained recovery points.

## Actions
- Azure | Microsoft.RecoveryServices/vaults/backupconfig/write
- Azure | Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems/stopprotection/action
- Azure | Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems/delete

## Roles
- Azure | Backup Contributor
- Azure | Contributor

## References
- MITRE ATT&CK T1490 — Inhibit System Recovery | https://attack.mitre.org/techniques/T1490/
- Azure Threat Research Matrix — Impact: Data Destruction | https://microsoft.github.io/Azure-Threat-Research-Matrix/Impact/DataDestruction/
- Microsoft Learn - Secure by Default with Soft Delete for Azure Backup | https://learn.microsoft.com/en-us/azure/backup/secure-by-default
