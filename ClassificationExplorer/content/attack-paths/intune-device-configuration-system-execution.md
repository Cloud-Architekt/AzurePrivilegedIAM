---
id: intune-device-configuration-system-execution
name: Intune device configuration / script SYSTEM execution
basedOn: Andy Robbins (SpecterOps) | https://posts.specterops.io/death-from-above-lateral-movement-from-azure-to-on-prem-ad-d18cb3959d4d
severity: High
targetTier: ControlPlane
---

## Summary
A Policy and Profile manager (or School Administrator) can create and assign Intune platform or remediation scripts that run in the SYSTEM context when configured accordingly. Device configuration profiles can change device settings but do not themselves provide arbitrary code execution. Targeting privileged or Tier 0 endpoints can yield access to those hosts and the credentials and tokens they hold.

## Prerequisite
An Intune role that can create and assign device configuration / scripts (Policy and Profile manager) with scope over privileged devices.

## Steps
1. Identify device groups containing privileged or Tier 0 endpoints that are managed by Intune.
2. Create a malicious platform or remediation script configured to run in the SYSTEM context.
3. Assign it to the privileged device group.
4. Collect credentials, certificates or primary refresh tokens from the compromised privileged endpoints.

## Actions
- DeviceManagement | Microsoft.Intune/DeviceConfigurations/Create
- DeviceManagement | Microsoft.Intune/DeviceConfigurations/Assign
- DeviceManagement | Microsoft.Intune/RemoteTasks/OnDemandProactiveRemediation

## Roles
- DeviceManagement | Policy and Profile manager
- DeviceManagement | School Administrator

## References
- Andy Robbins (SpecterOps) — Death From Above: Lateral Movement from Azure to On-Prem AD | https://posts.specterops.io/death-from-above-lateral-movement-from-azure-to-on-prem-ad-d18cb3959d4d
- Microsoft Learn — Role-based access control for Microsoft Intune | https://learn.microsoft.com/mem/intune/fundamentals/role-based-access-control
- MITRE ATT&CK T1072 — Software Deployment Tools | https://attack.mitre.org/techniques/T1072/
