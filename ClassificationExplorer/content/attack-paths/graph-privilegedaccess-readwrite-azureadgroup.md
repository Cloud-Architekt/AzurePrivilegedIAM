---
id: graph-privilegedaccess-readwrite-azureadgroup
name: Escalation through PIM for Groups (PrivilegedAccess.ReadWrite.AzureADGroup)
source: Emilien Socchi (AzTier) | https://www.emiliensocchi.io/abusing-pim-related-application-permissions-in-microsoft-graph-part-1/
severity: Critical
targetTier: ControlPlane
---

## Summary
This permission and the related PrivilegedEligibilitySchedule / PrivilegedAssignmentSchedule.ReadWrite.AzureADGroup permissions let the holder manage the PIM-controlled membership of role-assignable security groups. When such a group is actively assigned a privileged directory role, an attacker can add or make eligible a controlled account and then activate it, inheriting the group's role. It turns any privileged role-assignable group into an escalation vector and bypasses the expectation that group membership is tightly controlled.

## Prerequisite
A compromised service principal holding a PIM-for-Groups application permission, plus a controlled unprivileged user and the existence of a role-assignable group that carries a privileged role.

## Steps
1. Authenticate as the service principal and enumerate role-assignable groups that hold privileged roles (for example Global Administrator).
2. Add or make the controlled user an active / eligible member of that group via the PIM group API.
3. Activate the group membership if it was configured as eligible.
4. Use the inherited directory role for tenant control.

## Permissions
- Microsoft Graph | PrivilegedAccess.ReadWrite.AzureADGroup | Application
- Microsoft Graph | PrivilegedAssignmentSchedule.ReadWrite.AzureADGroup | Application
- Microsoft Graph | PrivilegedEligibilitySchedule.ReadWrite.AzureADGroup | Application

## References
- Emilien Socchi — Abusing PIM-related application permissions, Part 1 | https://www.emiliensocchi.io/abusing-pim-related-application-permissions-in-microsoft-graph-part-1/
- Emilien Socchi — Abusing PIM-related application permissions, Part 2 | https://www.emiliensocchi.io/abusing-pim-related-application-permissions-in-microsoft-graph-part-2/
- Compass Security — Common Entra ID Assessment Findings: Privileged Unprotected Groups | https://blog.compass-security.com/2026/03/common-entra-id-security-assessment-findings-part-2-privileged-unprotected-groups/
- Emilien Socchi — azure-tiering (Tier 0 Graph app permissions) | https://github.com/emiliensocchi/azure-tiering
