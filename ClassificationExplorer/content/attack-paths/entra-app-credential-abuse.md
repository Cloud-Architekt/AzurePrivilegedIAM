---
id: entra-app-credential-abuse
name: Application & service principal credential abuse
source: Dirk-jan Mollema | https://dirkjanm.io/azure-ad-privilege-escalation-application-admin/
severity: Critical
targetTier: ControlPlane
---

## Summary
Adding a secret or certificate to a privileged application or service principal lets an actor authenticate as that workload identity and inherit its (often Control Plane) Microsoft Graph permissions.

## Prerequisite
A delegated role over application / service principal objects — no admin consent or Global Administrator required.

## Steps
1. Find a service principal or app registration holding high-privilege Microsoft Graph app roles (for example RoleManagement.ReadWrite.Directory or AppRoleAssignment.ReadWrite.All).
2. Use the role action to add a new client secret or certificate to that application / service principal.
3. Authenticate as the service principal with the new credential and request an app-only token.
4. Use the workload identity’s Graph permissions to assign Global Administrator or grant further app roles — full tenant compromise.

## Actions
- EntraID | microsoft.directory/applications/credentials/update
- EntraID | microsoft.directory/servicePrincipals/credentials/update

## Roles
- EntraID | Application Administrator
- EntraID | Cloud Application Administrator
- EntraID | Hybrid Identity Administrator

## References
- Dirk-jan Mollema — Entra ID privilege escalation: Application Admin | https://dirkjanm.io/azure-ad-privilege-escalation-application-admin/
- Andy Robbins (SpecterOps) — Azure Privilege Escalation via Azure API Permissions Abuse | https://posts.specterops.io/azure-privilege-escalation-via-azure-api-permissions-abuse-74aee1006f48
- MITRE ATT&CK T1098.001 — Additional Cloud Credentials | https://attack.mitre.org/techniques/T1098/001/
