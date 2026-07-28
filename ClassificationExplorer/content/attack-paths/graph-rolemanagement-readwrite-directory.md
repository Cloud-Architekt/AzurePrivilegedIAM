---
id: graph-rolemanagement-readwrite-directory
name: Global Admin self-assignment via RoleManagement.ReadWrite.Directory
basedOn: Emilien Socchi (AzTier) | https://www.emiliensocchi.io/tiering-entra-roles-and-application-permissions-based-on-attack-paths/
severity: Critical
targetTier: ControlPlane
---

## Summary
The Microsoft Graph application permission RoleManagement.ReadWrite.Directory grants read/write over /roleManagement/directory/*, letting the holder add or remove members of any Entra directory role — including Global Administrator — and manage PIM role assignments. A service principal granted this application permission can assign itself or any principal full tenant-admin rights with a single role assignment and no further consent, which is why it is one of the most frequently cited Tier 0 application permissions.

## Prerequisite
Control of a service principal that has been consented RoleManagement.ReadWrite.Directory (for example via a stolen client secret / certificate, or a compromised application owner).

## Steps
1. Authenticate as the service principal using its credential to obtain an app-only Microsoft Graph token.
2. Enumerate directory role definitions to locate the Global Administrator role template.
3. Create a role assignment (active or through PIM) binding a controlled principal to Global Administrator.
4. Sign in as the now-privileged principal and operate with full Control Plane access.

## Permissions
- Microsoft Graph | RoleManagement.ReadWrite.Directory | Application

## References
- Emilien Socchi — Tiering Entra roles and application permissions based on attack paths | https://www.emiliensocchi.io/tiering-entra-roles-and-application-permissions-based-on-attack-paths/
- Semperis — Exploiting App-Only Graph Permissions in Entra ID | https://www.semperis.com/blog/exploiting-app-only-graph-permissions-in-entra-id/
- RoleManagement.ReadWrite.Directory — Graph permission reference | https://graphpermissions.merill.net/permission/RoleManagement.ReadWrite.Directory
- Microsoft Learn — Microsoft Graph permissions reference | https://learn.microsoft.com/graph/permissions-reference
