---
id: intune-endpoint-code-execution
name: Endpoint management code execution (Intune)
source: Microsoft Security | https://learn.microsoft.com/mem/intune/fundamentals/role-based-access-control
severity: High
targetTier: ControlPlane
---

## Summary
Deploying apps, scripts or configuration profiles through Intune runs code as SYSTEM on managed devices; targeting privileged / Tier 0 endpoints yields control-plane access to those hosts.

## Prerequisite
An Intune (or Entra) role that can create/assign apps, scripts or device configuration, with scope over privileged devices.

## Steps
1. Identify device groups that contain privileged or Tier 0 endpoints (for example admin workstations).
2. Create a malicious app, PowerShell script or configuration profile in Intune.
3. Assign it to the privileged device group — it executes as SYSTEM on those endpoints.
4. Harvest credentials / tokens from the compromised privileged endpoints.

## Actions
- DeviceManagement | Microsoft.Intune/MobileApps/Create
- DeviceManagement | Microsoft.Intune/MobileApps/Update
- DeviceManagement | Microsoft.Intune/MobileApps/Assign
- EntraID | microsoft.intune/allEntities/allTasks

## Roles
- DeviceManagement | Application Manager
- EntraID | Intune Administrator

## References
- Microsoft Learn — Intune role-based access control | https://learn.microsoft.com/mem/intune/fundamentals/role-based-access-control
- MITRE ATT&CK T1072 — Software Deployment Tools | https://attack.mitre.org/techniques/T1072/
