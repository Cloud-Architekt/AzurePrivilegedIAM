---
id: entra-connect-aba-credential-backdoor
name: Entra Connect application-based auth (ABA) credential backdoor
source: Sami Lamppu & Thomas Naunheim | https://github.com/Cloud-Architekt/AzureAD-Attack-Defense/blob/main/EntraSyncAba.md
severity: Critical
targetTier: ControlPlane
---

## Summary
Modern Entra Connect Sync authenticates with a single-tenant application identity (ABA) that holds ADSynchronization.ReadWrite.All and PasswordWriteback permissions — effectively Global-Administrator-equivalent. A role or owner that can add credentials to that application / service principal can attach a backdoor certificate, authenticate as the sync identity from anywhere and take over cloud-only accounts via directory synchronization and password writeback.

## Prerequisite
Ownership of — or a directory role / API permission that can add credentials to — the Entra Connect ABA application or service principal (Hybrid Identity Administrator, Application Administrator, Cloud Application Administrator, or Application.ReadWrite.All).

## Steps
1. Identify the Entra Connect ConnectSyncProvisioning_ application / service principal and confirm its sync and password-writeback permissions.
2. Add an attacker-controlled certificate (or secret) to that application or service principal via Microsoft Graph or an existing Entra Connect certificate.
3. Authenticate to the AD Synchronization Service API as the ABA identity using the backdoor credential from outside the Connect server.
4. Abuse synchronization and password writeback (for example AADInternals Set-AADIntUserPassword) to take over privileged cloud accounts.

## Actions
- EntraID | microsoft.directory/applications/credentials/update
- EntraID | microsoft.directory/servicePrincipals/credentials/update
- EntraID | microsoft.directory/applications/owners/update

## Roles
- EntraID | Hybrid Identity Administrator
- EntraID | Application Administrator
- EntraID | Cloud Application Administrator

## References
- Sami Lamppu & Thomas Naunheim — Abuse of Microsoft Entra Connect Application-based Authentication | https://github.com/Cloud-Architekt/AzureAD-Attack-Defense/blob/main/EntraSyncAba.md
- SpecterOps — Update: Dumping Entra Connect Sync Credentials | https://specterops.io/blog/2025/06/09/update-dumping-entra-connect-sync-credentials/
- Microsoft Learn — Authenticate to Microsoft Entra ID by using application identity | https://learn.microsoft.com/entra/identity/hybrid/connect/authenticate-application-id
- MITRE ATT&CK T1098.001 — Additional Cloud Credentials | https://attack.mitre.org/techniques/T1098/001/
