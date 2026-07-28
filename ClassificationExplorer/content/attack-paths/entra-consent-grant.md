---
id: entra-consent-grant
name: Illicit application permission grant (consent abuse)
basedOn: Microsoft Security | https://learn.microsoft.com/entra/identity/enterprise-apps/protect-against-consent-phishing
severity: Critical
targetTier: ControlPlane
---

## Summary
Assigning Microsoft Graph app roles or OAuth2 permission grants to a controlled service principal escalates that workload identity to Control Plane Graph permissions.

## Prerequisite
A role that can manage app role assignments or OAuth2 permission grants on high privilege scopes to escalate a service principal to Control Plane permissions.

## Steps
1. Create or take control of a service principal in the tenant.
2. Grant the service principal a high-impact Microsoft Graph app role (for example RoleManagement.ReadWrite.Directory) or Non-Microsoft Graph Permission (for example, `Machine.LiveResponse` in `WindowsDefenderATP`) to escalate the service principal to permissions with direct/indirect access to Control Plane.
3. Authenticate as that service principal and use the newly granted permission to add privileged roles or further credentials.

## Actions
- EntraID | microsoft.directory/servicePrincipals/appRoleAssignedTo/update
- EntraID | microsoft.directory/oAuth2PermissionGrants/allProperties/allTasks

## Roles
- EntraID | Privileged Role Administrator
- EntraID | Application Administrator

## References
- Microsoft Learn — Protect against consent phishing | https://learn.microsoft.com/entra/identity/enterprise-apps/protect-against-consent-phishing
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
