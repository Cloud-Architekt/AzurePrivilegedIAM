---
id: intune-device-configuration-system-execution
name: Intune device configuration / script SYSTEM execution
source: Andy Robbins (SpecterOps) | https://posts.specterops.io/death-from-above-lateral-movement-from-azure-to-on-prem-ad-d18cb3959d4d
severity: High
targetTier: ControlPlane
---

## Summary
A Policy and Profile manager (or School Administrator) can create and assign device configuration profiles and platform scripts that execute in the SYSTEM context on targeted devices. Aiming these at privileged or Tier 0 endpoints (admin workstations, servers that are Intune-managed) yields control-plane access to those hosts and the credentials and tokens they hold.

## Prerequisite
An Intune role that can create and assign device configuration / scripts (Policy and Profile manager) with scope over privileged devices.

## Steps
1. Identify device groups containing privileged or Tier 0 endpoints that are managed by Intune.
2. Create a malicious device configuration profile or platform / remediation script.
3. Assign it to the privileged device group — it runs as SYSTEM on those endpoints.
4. Collect credentials, certificates or primary refresh tokens from the compromised privileged endpoints.

## Actions
- DeviceManagement | Microsoft.Intune/DeviceConfigurations/Create
- DeviceManagement | Microsoft.Intune/DeviceConfigurations/Assign

## Roles
- DeviceManagement | Policy and Profile manager
- DeviceManagement | School Administrator

## References
- Andy Robbins (SpecterOps) — Death From Above: Lateral Movement from Azure to On-Prem AD | https://posts.specterops.io/death-from-above-lateral-movement-from-azure-to-on-prem-ad-d18cb3959d4d
- Microsoft Learn — Role-based access control for Microsoft Intune | https://learn.microsoft.com/mem/intune/fundamentals/role-based-access-control
- MITRE ATT&CK T1072 — Software Deployment Tools | https://attack.mitre.org/techniques/T1072/
