---
id: graph-application-readwrite-all-impersonation
name: Microsoft Graph Application.ReadWrite.All credential injection
basedOn: Andy Robbins (SpecterOps) | https://posts.specterops.io/azure-privilege-escalation-via-azure-api-permissions-abuse-74aee1006f48
severity: Critical
targetTier: ControlPlane
---

## Summary
A workload identity holding the Microsoft Graph application permission Application.ReadWrite.All can add a credential (secret or certificate) to any application or service principal in the tenant — including ones with Control Plane Graph app roles — and then authenticate as that privileged workload identity. BloodHound models this as an MGApplication_ReadWrite_All / abusable credential edge; the enabling human actions are the application / service principal credential-update operations.

## Prerequisite
A service principal holding Application.ReadWrite.All, or a role that can add credentials to applications / service principals (Application Administrator, Cloud Application Administrator).

## Steps
1. Enumerate applications and service principals holding high-impact Microsoft Graph app roles (for example RoleManagement.ReadWrite.Directory).
2. Use Application.ReadWrite.All (or an equivalent credential-update role action) to add an attacker-controlled secret or certificate to that application.
3. Authenticate as the target application with the new credential and request an app-only Graph token.
4. Use the inherited Control Plane Graph permissions to assign privileged roles or grant further app roles.

## Actions
- EntraID | microsoft.directory/applications/credentials/update
- EntraID | microsoft.directory/servicePrincipals/credentials/update

## Roles
- EntraID | Application Administrator
- EntraID | Cloud Application Administrator

## References
- Andy Robbins (SpecterOps) — Azure Privilege Escalation via Azure API Permissions Abuse | https://posts.specterops.io/azure-privilege-escalation-via-azure-api-permissions-abuse-74aee1006f48
- Emilien Socchi — Microsoft Graph application permissions tiering | https://github.com/emiliensocchi/azure-tiering/tree/main/Microsoft%20Graph%20application%20permissions
- Microsoft Learn — Microsoft Graph permissions reference | https://learn.microsoft.com/graph/permissions-reference
- MITRE ATT&CK T1098.001 — Additional Cloud Credentials | https://attack.mitre.org/techniques/T1098/001/
