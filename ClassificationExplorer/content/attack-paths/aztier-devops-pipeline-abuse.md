---
id: aztier-devops-pipeline-abuse
name: Azure DevOps pipeline identity abuse
basedOn: Emilien Socchi | https://github.com/emiliensocchi/azure-tiering
severity: High
targetTier: ControlPlane
---

## Summary
An Azure DevOps Administrator can manage organization policy and trigger or impersonate pipelines that authenticate with service principals or managed identities holding privileged Azure access. The role is an indirect Control Plane path only when a pipeline identity can reach a resource or workload identity with Control Plane privileges.

## Prerequisite
The Azure DevOps Administrator role, plus a pipeline using a service connection or managed identity with Azure access that can reach a resource or workload identity holding Control Plane privileges.

## Steps
1. Identify an Azure DevOps pipeline whose service connection or managed identity holds high-privileged Azure access (for example Terraform automation).
2. Use Azure DevOps administrative control to trigger or modify the pipeline so it executes attacker-controlled steps.
3. Impersonate the pipeline identity and use its Azure access to reach a resource or workload identity with Control Plane privileges.
4. Use the inherited permissions to operate on the Control Plane.

## Actions


## Roles
- EntraID | Azure DevOps Administrator

## References
- Emilien Socchi — Entra roles tiering (Azure DevOps Administrator, Tier 0) | https://github.com/emiliensocchi/azure-tiering/blob/main/Entra%20roles/tiered-entra-roles.json
- Emilien Socchi — Tiering Entra roles and application permissions based on attack paths | https://www.emiliensocchi.io/tiering-entra-roles-and-application-permissions-based-on-attack-paths/
- MITRE ATT&CK T1078.004 — Valid Accounts: Cloud Accounts | https://attack.mitre.org/techniques/T1078/004/
