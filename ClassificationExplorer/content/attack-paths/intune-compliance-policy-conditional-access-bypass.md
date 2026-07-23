---
id: intune-compliance-policy-conditional-access-bypass
name: Intune compliance policy tampering (Conditional Access bypass)
source: Dr. Nestori Syynimaa (AADInternals) | https://aadinternals.com/post/mdm/
severity: High
targetTier: UserAccess
---

## Summary
Modifying Intune device compliance policies allows an actor to mark rogue or non-compliant devices as "Compliant" within Entra ID, completely bypassing Conditional Access boundary controls that rely on device compliance.

## Prerequisite
Administrative access to manage Intune Endpoint Security rules or device compliance policies.

## Steps
1. Identify a critical Entra ID Conditional Access policy secured by the "Require device to be marked as compliant" grant control.
2. Edit an existing Intune compliance policy or deploy a new permissive, overlapping compliance policy targeted at an attacker-controlled device.
3. Enroll the rogue device into Intune; it immediately passes the weakened compliance checks.
4. Access the protected resources, successfully bypassing the Conditional Access restrictions.

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
