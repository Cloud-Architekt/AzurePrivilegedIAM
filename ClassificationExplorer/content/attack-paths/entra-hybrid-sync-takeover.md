---
id: entra-hybrid-sync-takeover
name: Hybrid identity / Entra Connect sync account abuse
basedOn: Dr. Nestori Syynimaa (o365blog) | https://aadinternals.com/post/on-prem_admin/
severity: Critical
targetTier: ControlPlane
---

## Summary
The Entra Connect sync identity (Directory Synchronization Accounts) and hybrid-sync configuration bridge on-premises Active Directory and the cloud. Compromising the sync server or its account provides a path from on-prem admin to tenant takeover.

## Prerequisite
Admin access to the Entra Connect / sync server, or a role holding the hybrid identity synchronization permissions.

## Steps
1. Compromise the Entra Connect (Azure AD Connect) server or the Directory Synchronization Accounts identity that holds hybrid sync permissions.
2. Abuse the sync account, password-hash-sync or pass-through-auth configuration to reset cloud passwords or authenticate seamlessly.
3. Sign in as a synced privileged account (or reset one) to gain Control Plane access in the tenant.

## Actions
- EntraID | microsoft.directory/onPremisesSynchronization/basic/update

## Roles
- EntraID | Hybrid Identity Administrator
- EntraID | Directory Synchronization Accounts
- EntraID | Partner Tier2 Support

## References
- Dr. Nestori Syynimaa — Unnoticed sidekick: Getting access to cloud as an on-prem admin | https://aadinternals.com/post/on-prem_admin/
- Fabian Bader (cloudbrothers) — From on-prem to Global Admin without password reset | https://cloudbrothers.info/en/prem-global-admin-password-reset/
- Sami Lamppu & Thomas Naunheim — Abuse of Entra Connect Sync Service Account | https://github.com/Cloud-Architekt/AzureAD-Attack-Defense/blob/main/AADCSyncServiceAccount.md
