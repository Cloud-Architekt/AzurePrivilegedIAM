---
id: graph-approleassignment-readwrite-escalation
name: Microsoft Graph AppRoleAssignment.ReadWrite.All self-grant
source: Andy Robbins (SpecterOps) | https://posts.specterops.io/azure-privilege-escalation-via-azure-api-permissions-abuse-74aee1006f48
severity: Critical
targetTier: ControlPlane
---

## Summary
A service principal granted the Microsoft Graph application permission AppRoleAssignment.ReadWrite.All can assign any other Graph app role to itself — including RoleManagement.ReadWrite.Directory — and then promote itself or any principal to Global Administrator. Granting this Tier 0 Graph permission to a workload identity is therefore equivalent to tenant takeover, which is why it is enabled by the same app-role-assignment action a Privileged Role Administrator controls.

## Prerequisite
A role or workload identity that can create Microsoft Graph app role assignments (microsoft.directory/servicePrincipals/appRoleAssignedTo/update), such as Privileged Role Administrator, or an already-compromised service principal holding AppRoleAssignment.ReadWrite.All.

## Steps
1. Identify or take control of a service principal that holds the Microsoft Graph app role AppRoleAssignment.ReadWrite.All.
2. Use that permission to grant the service principal a higher-impact Graph app role such as RoleManagement.ReadWrite.Directory.
3. With RoleManagement.ReadWrite.Directory, assign the Global Administrator role to a controlled principal via Microsoft Graph.
4. Operate as Global Administrator with full Control Plane access — no interactive admin consent required.

## Actions
- EntraID | microsoft.directory/servicePrincipals/appRoleAssignedTo/update

## Roles
- EntraID | Privileged Role Administrator

## References
- Andy Robbins (SpecterOps) — Azure Privilege Escalation via Azure API Permissions Abuse | https://posts.specterops.io/azure-privilege-escalation-via-azure-api-permissions-abuse-74aee1006f48
- Emilien Socchi (AzTier) — Microsoft Graph application permissions tiering | https://github.com/emiliensocchi/azure-tiering/tree/main/Microsoft%20Graph%20application%20permissions
- Dirk-jan Mollema — Entra ID privilege escalation: Application Admin | https://dirkjanm.io/azure-ad-privilege-escalation-application-admin/
- MITRE ATT&CK T1098.003 — Additional Cloud Roles | https://attack.mitre.org/techniques/T1098/003/
