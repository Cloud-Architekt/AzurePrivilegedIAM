---
id: entra-legacy-support-role-sp-takeover
name: Service principal takeover via legacy/hidden support roles
source: Andy Robbins (SpecterOps) | https://posts.specterops.io/azure-privilege-escalation-via-service-principal-abuse-210ae2be2a5
severity: Critical
targetTier: ControlPlane
---

## Summary
Beyond the well-known Application Administrator / Cloud Application Administrator / Hybrid Identity Administrator roles, several legacy or hidden directory roles can also manage service principal owners/credentials. If a service principal holds a privileged directory role (for example Privileged Role Administrator or Global Administrator), a principal holding one of these legacy roles can take it over and inherit its privileges.

## Prerequisite
Assignment of one of the legacy/hidden directory roles below, scoped to the tenant.

## Steps
1. Identify a service principal that holds a privileged directory role or high-impact Microsoft Graph app role.
2. Using a legacy/hidden role (Directory Synchronization Accounts, Partner Tier1 Support, or Partner Tier2 Support), add a controlled principal as an owner of that service principal, or add it a new client secret/certificate.
3. Authenticate as the service principal with the new owner rights/credential and request an app-only token.
4. Use the inherited privileges to escalate further — for example promote a controlled user to Global Administrator.

## Actions
- EntraID | microsoft.directory/servicePrincipals/owners/update
- EntraID | microsoft.directory/servicePrincipals/credentials/update

## Roles
- EntraID | Directory Synchronization Accounts
- EntraID | Partner Tier1 Support
- EntraID | Partner Tier2 Support

## References
- Andy Robbins (SpecterOps) — Azure Privilege Escalation via Service Principal Abuse | https://posts.specterops.io/azure-privilege-escalation-via-service-principal-abuse-210ae2be2a5
- Microsoft Learn — Microsoft Entra built-in roles | https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference
- MITRE ATT&CK T1098.001 — Additional Cloud Credentials | https://attack.mitre.org/techniques/T1098/001/
