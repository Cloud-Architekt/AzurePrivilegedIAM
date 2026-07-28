---
id: azure-keyvault-credential-theft
name: Key Vault secret & certificate dumping (AZT604)
basedOn: Microsoft (Azure Threat Research Matrix) | https://microsoft.github.io/Azure-Threat-Research-Matrix/CredentialAccess/AZT604/AZT604/
severity: High
targetTier: ControlPlane
---

## Summary
A principal with data-plane read access to a Key Vault can dump stored secrets and certificates. Vaults frequently hold service-principal client secrets, certificates and connection strings for privileged workload identities — reading them lets an actor authenticate as those identities and inherit their (often control-plane) permissions.

## Prerequisite
A role granting Key Vault data-plane read (Key Vault Administrator or Key Vault Secrets User) on an RBAC-model vault and containing secrets or certificates for a high-privileged workload identity.

## Steps
1. Enumerate accessible Key Vaults and the secrets / certificates they contain.
2. Use the data-plane getSecret action to read the stored secret or certificate material.
3. Authenticate as the service principal or application whose credential was stored in the vault.
4. Inherit that workload identity’s Azure or Microsoft Graph privileges to escalate further.

## Actions
- Azure | Microsoft.KeyVault/vaults/secrets/getSecret/action

## Roles
- Azure | Key Vault Administrator
- Azure | Key Vault Secrets User

## References
- Azure Threat Research Matrix — AZT604 Azure KeyVault Dumping | https://microsoft.github.io/Azure-Threat-Research-Matrix/CredentialAccess/AZT604/AZT604/
- Microsoft Learn — Azure Key Vault RBAC guide | https://learn.microsoft.com/azure/key-vault/general/rbac-guide
- MITRE ATT&CK T1555.006 — Cloud Secrets Management Stores | https://attack.mitre.org/techniques/T1555/006/
