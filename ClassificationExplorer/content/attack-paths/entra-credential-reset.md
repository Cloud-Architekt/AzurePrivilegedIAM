---
id: entra-credential-reset
name: Privileged credential / MFA reset takeover
basedOn: Microsoft Security | https://learn.microsoft.com/entra/identity/role-based-access-control/privileged-roles-permissions
severity: Critical
targetTier: ControlPlane
---

## Summary
Resetting the password or strong authentication methods of a higher-privileged account outside of Microsoft Entra ID roles lets an actor sign in as that administrator.

## Prerequisite
A role that can reset passwords or manage authentication methods of users with privileges outside of Entra ID roles and not protected by Restricted Management Administrative Units or Role-Assignable Groups.

## Steps
1. Identify a target administrator (for example an Authentication Administrator) whose credentials you are allowed to reset.
2. Reset the target’s password and/or register a new authentication method (MFA) you control.
3. Sign in as the target administrator with the new credential.

## Actions
- EntraID | microsoft.directory/users/password/update
- EntraID | microsoft.directory/users/authenticationMethods/basic/update

## Roles
- EntraID | Privileged Authentication Administrator
- EntraID | Authentication Administrator
- EntraID | User Administrator
- EntraID | Helpdesk Administrator
- EntraID | Password Administrator

## References
- Microsoft Learn — Privileged roles and permissions | https://learn.microsoft.com/entra/identity/role-based-access-control/privileged-roles-permissions
- MITRE ATT&CK T1556.006 — Modify Authentication Process: MFA | https://attack.mitre.org/techniques/T1556/006/
