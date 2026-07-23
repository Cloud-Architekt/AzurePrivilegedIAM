---
id: exchange-full-access-as-app
name: Tenant-wide mailbox access via Exchange Online full_access_as_app
source: AppGovScore | https://www.appgovscore.com/blog/insecure-app-registrations-breached-microsoft
severity: High
targetTier: ManagementPlane
---

## Summary
The Office 365 Exchange Online full_access_as_app application permission grants an app the ability to access and act on every mailbox in the tenant by default, reading and sending mail as any user unless constrained by an Application Access Policy or RBAC for Applications. This is a data-plane "read all email" primitive heavily used in real intrusions (for example the Midnight Blizzard / Nobelium compromise of Microsoft executive mailboxes). Because it defaults to unscoped tenant-wide access, an over-privileged or compromised app becomes a mass email-exfiltration channel.

## Prerequisite
Control of a service principal granted full_access_as_app (for example a stolen credential on a legacy / test OAuth app), with admin consent already in place.

## Steps
1. Authenticate as the app with its credential to obtain an app-only token for Exchange / EWS.
2. Enumerate target mailboxes (executives, security, finance).
3. Read, search and export mail content, or send mail as those users.
4. Optionally stage inbox rules or forwarding for persistence and continued exfiltration.

## Permissions
- Exchange Online | full_access_as_app | Application

## Roles
- EntraID | Application Administrator

## References
- AppGovScore — Insecure app registrations behind the Microsoft breach | https://www.appgovscore.com/blog/insecure-app-registrations-breached-microsoft
- Splunk Security Content — O365 FullAccessAsApp Permission Assigned (detection) | https://research.splunk.com/cloud/01a510b3-a6ac-4d50-8812-7e8a3cde3d79/
- Practical365 — Application access policies in Exchange Online | https://practical365.com/application-access-policies-in-exchange-online/
- Microsoft Learn — Role Based Access Control for Applications in Exchange Online | https://learn.microsoft.com/exchange/permissions-exo/application-rbac
