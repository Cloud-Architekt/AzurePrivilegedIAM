---
id: intune-compliance-policy-conditional-access-bypass
name: Intune compliance policy tampering (Conditional Access bypass)
basedOn: Dr. Nestori Syynimaa (AADInternals) | https://aadinternals.com/post/mdm/
severity: High
targetTier: UserAccess
---

## Summary
Modifying Intune device compliance policies can weaken the device-compliance signal used by Entra Conditional Access. The effect depends on the effective policies assigned to the device, the tenant's compliance configuration, and the device's next policy and compliance evaluation.

## Prerequisite
Administrative access to manage Intune Endpoint Security rules or device compliance policies.

## Steps
1. Identify a critical Entra ID Conditional Access policy secured by the "Require device to be marked as compliant" grant control.
2. Modify or remove the restrictive compliance policy, exclude the target device from it, or exploit a configuration where devices with no assigned compliance policy are treated as compliant.
3. Enroll the rogue device into Intune and wait for policy delivery and compliance evaluation.
4. Access the protected resources if the device now satisfies the Conditional Access grant control.

## Actions

## Permissions
- Microsoft Graph | DeviceManagementConfiguration.ReadWrite.All | Application

## Roles
- EntraID | Intune Administrator
- DeviceManagement | Endpoint Security Manager
- DeviceManagement | Intune Role Administrator

## References
- Dr. Nestori Syynimaa (AADInternals) — Bypassing Conditional Access device compliance | https://aadinternals.com/post/mdm/
- cloudbrothers — Azure Attack Paths: Intune | https://cloudbrothers.info/en/azure-attack-paths/
- MITRE ATT&CK T1562.001 — Impair Defenses: Disable or Modify Tools | https://attack.mitre.org/techniques/T1562/001/
