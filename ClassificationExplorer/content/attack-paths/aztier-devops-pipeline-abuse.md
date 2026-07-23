---
id: aztier-devops-pipeline-abuse
name: Azure DevOps pipeline identity abuse
source: Emilien Socchi (AzTier) | https://github.com/emiliensocchi/azure-tiering
severity: High
targetTier: ControlPlane
---

## Summary
An Azure DevOps Administrator can manage organization policy and trigger or impersonate pipelines that authenticate with service principals or managed identities holding privileged Azure access. By triggering and impersonating such a pipeline, an actor can follow the same Azure-resource escalation path to Global Admin. AzTier tiers this role as Tier 0 for this indirect path.

## Prerequisite
The Azure DevOps Administrator role, with pipelines that use privileged Azure service connections / managed identities.

## Steps
1. Identify an Azure DevOps pipeline whose service connection or managed identity holds privileged Azure access (for example Contributor on a subscription).
2. Use Azure DevOps administrative control to trigger or modify the pipeline so it executes attacker-controlled steps.
3. Impersonate the pipeline identity and use its Azure access to reach a resource with a privileged managed identity.
4. Abuse the managed identity’s Microsoft Graph permissions to escalate to Global Admin.

## Actions


## Roles
- EntraID | Azure DevOps Administrator

## References
- Emilien Socchi (AzTier) — Entra roles tiering (Azure DevOps Administrator, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- Emilien Socchi — Tiering Entra roles and application permissions based on attack paths | https://www.emiliensocchi.io/tiering-entra-roles-and-application-permissions-based-on-attack-paths/
- MITRE ATT&CK T1078.004 — Valid Accounts: Cloud Accounts | https://attack.mitre.org/techniques/T1078/004/
