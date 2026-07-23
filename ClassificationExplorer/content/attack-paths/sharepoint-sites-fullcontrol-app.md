---
id: sharepoint-sites-fullcontrol-app
name: Tenant-wide SharePoint & OneDrive control via Sites.FullControl.All
source: Martin Lingstuyl (blimped.nl) | https://www.blimped.nl/running-application-with-limited-sharepoint-permissions/
severity: High
targetTier: ManagementPlane
---

## Summary
Sites.FullControl.All (as an Office 365 SharePoint Online or Microsoft Graph application permission) grants an app full administrative control of every site collection in the tenant — content, lists and site-level permissions. A compromised app can read or alter any document across SharePoint and OneDrive, grant itself access to additional sites, and tamper with site security. Because it defaults to full-tenant scope rather than Sites.Selected, it is a classic over-privileged data-plane risk.

## Prerequisite
Control of a service principal granted Sites.FullControl.All (for example via a stolen certificate / secret on an over-privileged SharePoint app).

## Steps
1. Authenticate as the app to obtain an app-only token for SharePoint / Graph.
2. Enumerate site collections and OneDrive / document libraries across the tenant.
3. Read or exfiltrate sensitive documents, or modify content.
4. Alter site permissions to add controlled principals for persistence.

## Permissions
- Microsoft Graph | Sites.FullControl.All | Application

## Roles
- EntraID | SharePoint Administrator

## References
- Martin Lingstuyl — Running an application with limited SharePoint permissions | https://www.blimped.nl/running-application-with-limited-sharepoint-permissions/
- Practical365 — Controlling app access to SharePoint Online sites | https://practical365.com/restrict-app-access-to-sharepoint-sites/
- Leon Armston — Use Sites.Selected with FullControl rather than Write or Read | https://www.leonarmston.com/2022/02/use-sites-selected-permission-with-fullcontrol-rather-than-write-or-read/
- Microsoft Learn — Overview of Selected permissions in OneDrive and SharePoint | https://learn.microsoft.com/graph/permissions-selected-overview
