---
id: azure-logicapp-managed-identity-abuse
name: Logic App workflow managed identity token theft
source: Andy Robbins (SpecterOps) | https://specterops.io/blog/2022/06/07/managed-identity-attack-paths-part-2-logic-apps/
severity: High
targetTier: ControlPlane
---

## Summary
Azure RBAC control over a Logic App (Owner, Contributor or Logic App Contributor) lets an actor edit its workflow definition to add an HTTP action that authenticates to a target resource using the Logic App's managed identity, then exfiltrates the resulting bearer token to an attacker-controlled endpoint. If the identity holds privileged Azure or Microsoft Graph permissions, the actor inherits them entirely outside the workflow — the same managed-identity token-theft pattern documented for Automation Account runbooks, but reachable via Logic Apps' lower-friction visual designer.

## Prerequisite
The Owner, Contributor or Logic App Contributor Azure role (or User Access Administrator to self-grant one of these — see the RBAC role assignment escalation path) over a Logic App with an enabled system- or user-assigned managed identity that holds privileged Azure or Graph permissions.

## Steps
1. Enumerate Logic Apps with an enabled managed identity and check the identity's assigned Azure roles / Microsoft Graph app roles for privilege.
2. Edit the workflow (via the Azure Portal designer or `Microsoft.Logic/workflows/*` write access) to add an HTTP action configured to authenticate using the Logic App's managed identity against a target audience (for example Microsoft Graph or Azure Resource Manager).
3. Point that HTTP action at an attacker-controlled endpoint so the outbound request's `Authorization` bearer token for the managed identity is captured.
4. Trigger the workflow run, harvest the leaked token, and use it to authenticate as the managed identity outside the Logic App — inheriting its Azure / Graph privileges.

## Actions
- Azure | Microsoft.Logic/*
- Azure | Microsoft.Logic/workflows/triggers/listCallbackUrl/action

## Roles
- Azure | Owner
- Azure | Contributor
- Azure | Logic App Contributor

## References
- Andy Robbins (SpecterOps) — Managed Identity Attack Paths, Part 2: Logic Apps | https://specterops.io/blog/2022/06/07/managed-identity-attack-paths-part-2-logic-apps/
- Josh Magri (NetSPI) — Illogical Apps: Exploring & Exploiting Azure Logic Apps | https://www.netspi.com/blog/technical/cloud-penetration-testing/illogical-apps-exploring-exploiting-azure-logic-apps/
- Christopher Brumm — Logic Apps and Azure Active Directory | https://chris-brumm.medium.com/logic-apps-and-azure-active-directory-a3857c9e3951
- MITRE ATT&CK T1550.001 — Application Access Token | https://attack.mitre.org/techniques/T1550/001/
