---
id: azure-automation-runbook-identity
name: Azure Automation runbook & managed identity abuse
basedOn: Karl Fosaaen (NetSPI) | https://www.netspi.com/blog/technical/cloud-penetration-testing/abusing-azure-hybrid-workers-for-privilege-escalation/
severity: High
targetTier: ControlPlane
---

## Summary
Write access to an Azure Automation account lets an actor create or modify runbooks that execute as the automation account’s managed identity (or on a hybrid runbook worker). If that identity is privileged, the actor inherits its Azure / Graph access.

## Prerequisite
A role that can author or start runbooks / jobs on an Automation account with a privileged managed identity or hybrid worker.

## Steps
1. Find an Automation account whose managed identity (or legacy Run As account) holds privileged Azure or Graph roles.
2. Create or modify a runbook containing attacker-controlled code and publish it.
3. Start a job (optionally on a hybrid runbook worker) so the code runs in the identity’s context.
4. Request a managed-identity token from within the runbook and use it to act as the privileged identity.

## Actions
- Azure | Microsoft.Automation/automationAccounts/jobs/write
- Azure | Microsoft.Automation/automationAccounts/*

## Roles
- Azure | Contributor
- Azure | Automation Contributor


## References
- Karl Fosaaen (NetSPI) — Abusing Azure Hybrid Workers for Privilege Escalation | https://www.netspi.com/blog/technical/cloud-penetration-testing/abusing-azure-hybrid-workers-for-privilege-escalation/
- Fabian Bader (cloudbrothers) — Azure Attack Paths: Automation Hybrid Runbook Worker | https://cloudbrothers.info/en/azure-attack-paths/
- MITRE ATT&CK T1648 — Serverless Execution | https://attack.mitre.org/techniques/T1648/
