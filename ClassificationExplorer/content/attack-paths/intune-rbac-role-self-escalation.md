---
id: intune-rbac-role-self-escalation
name: Intune RBAC role assignment self-escalation
source: Microsoft Security | https://learn.microsoft.com/mem/intune/fundamentals/role-based-access-control
severity: High
targetTier: ControlPlane
---

## Summary
An Intune Role Administrator can create and assign Intune RBAC roles. By assigning a controlled principal a role that can deploy apps, scripts or configuration profiles, the actor reaches SYSTEM code execution on managed (including privileged) endpoints — an Intune-internal privilege-escalation primitive that mirrors directory role-assignment abuse.

## Prerequisite
The Intune Role Administrator role (Microsoft.Intune/Roles/Assign and Roles/Update).

## Steps
1. Enumerate the Intune custom and built-in roles and find one that can create/assign apps, scripts or device configuration.
2. Create or modify an Intune role assignment granting a controlled principal that role over a scope that includes privileged devices.
3. Use the newly granted role to deploy a SYSTEM-context payload to those endpoints.
4. Harvest credentials, tokens or primary refresh tokens from the compromised privileged endpoints.

## Actions
- DeviceManagement | Microsoft.Intune/Roles/Assign
- DeviceManagement | Microsoft.Intune/Roles/Update

## Roles
- DeviceManagement | Intune Role Administrator

## References
- Microsoft Learn — Role-based access control for Microsoft Intune | https://learn.microsoft.com/mem/intune/fundamentals/role-based-access-control
- Andy Robbins (SpecterOps) — Death From Above: Lateral Movement from Azure to On-Prem AD | https://posts.specterops.io/death-from-above-lateral-movement-from-azure-to-on-prem-ad-d18cb3959d4d
- MITRE ATT&CK T1098 — Account Manipulation | https://attack.mitre.org/techniques/T1098/
