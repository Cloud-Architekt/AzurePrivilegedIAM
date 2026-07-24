---
id: entra-app-sp-owner-takeover
name: Application / service principal owner takeover
source: Andy Robbins (SpecterOps) | https://specterops.io/blog/2021/10/12/azure-privilege-escalation-via-service-principal-abuse/
severity: Critical
targetTier: ControlPlane
---

## Summary
An owner of an application or service principal can add their own credentials to it and then authenticate as that workload identity, inheriting all of its (often Control Plane) Microsoft Graph permissions.

## Prerequisite
Ownership of — or a role that can set owners on — a privileged application or service principal.

## Steps
1. Identify an application or service principal that holds high-impact Microsoft Graph app roles and add a controlled principal as an owner.
2. As owner, add a new client secret or certificate to the application / service principal.
3. Authenticate as the workload identity with the new credential and request an app-only token.
4. Use the inherited Graph permissions to escalate — for example grant Global Administrator or further app roles.

## Actions
- EntraID | microsoft.directory/applications/owners/update
- EntraID | microsoft.directory/servicePrincipals/owners/update

## Roles
- EntraID | Application Administrator
- EntraID | Cloud Application Administrator
- EntraID | Hybrid Identity Administrator

## References
- Andy Robbins (SpecterOps) — Azure Privilege Escalation via Service Principal Abuse | https://specterops.io/blog/2021/10/12/azure-privilege-escalation-via-service-principal-abuse/
- Dirk-jan Mollema — Taking over default application permissions as Application Admin | https://dirkjanm.io/azure-ad-privilege-escalation-application-admin/
- Fabian Bader (cloudbrothers) — Azure Attack Paths: API Permissions | https://cloudbrothers.info/en/azure-attack-paths/
