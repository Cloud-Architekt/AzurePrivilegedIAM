---
id: azure-managed-identity-abuse
name: Compute managed identity abuse (run command / extensions)
source: Andreas Happe (m365internals) | https://m365internals.com/2021/11/30/lateral-movement-with-managed-identities-of-azure-virtual-machines/
severity: High
targetTier: ControlPlane
---

## Summary
Running code on a VM via Run Command or a custom extension to impersonate and execute as the VM’s managed identity; if that identity is privileged, the actor inherits its Azure / Graph access.

## Prerequisite
A role that can run commands or write extensions on a VM that has an attached, privileged managed identity.

## Steps
1. Find a virtual machine with a system- or user-assigned managed identity that holds privileged Azure or Graph roles.
2. Execute code on the VM using Run Command or by deploying a custom script extension.
3. From that code, request a managed-identity token from the instance metadata endpoint.
4. Use the token to act as the privileged managed identity.

## Actions
- Azure | Microsoft.Compute/virtualMachines/runCommand/action
- Azure | Microsoft.Compute/virtualMachines/runCommands/write
- Azure | Microsoft.Compute/virtualMachines/extensions/write

## Roles
- Azure | Contributor
- Azure | Virtual Machine Contributor


## References
- Microsoft Learn — Run Command for Windows VMs | https://learn.microsoft.com/azure/virtual-machines/windows/run-command
- Andreas (m365internals) — Lateral Movement with Managed Identities of Azure VMs | https://m365internals.com/2021/11/30/lateral-movement-with-managed-identities-of-azure-virtual-machines/
- Fabian Bader (cloudbrothers) — Azure Attack Paths: Managed Identities | https://cloudbrothers.info/en/azure-attack-paths/
- MITRE ATT&CK T1078.004 — Valid Accounts: Cloud Accounts | https://attack.mitre.org/techniques/T1078/004/
