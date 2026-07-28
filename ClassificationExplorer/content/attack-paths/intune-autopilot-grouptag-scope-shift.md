---
id: intune-autopilot-grouptag-scope-shift
name: Autopilot Group Tag manipulation causes Intune scope tag/tier shift
basedOn: Thomas Naunheim & Martin Sohn Christensen | https://www.troopers.de/troopers26/agenda/
severity: Critical
targetTier: ControlPlane
---

## Summary
An administrator with scoped, Tier2-level Intune enrollment permissions can change the Windows Autopilot "Group Tag" of a Tier0 Privileged Access Workstation (PAW). Because the Group Tag is written into the `[OrderID]` value of the Entra device object's `devicePhysicalIds` attribute, and dynamic security groups use that attribute to build their membership (e.g. `(device.devicePhysicalIds -any _ -contains "[OrderID]:Tier0.PAW")`), overwriting the tag silently moves the device out of its Tier0 dynamic scope group and into a lower-tier (Tier2) scope group. Because Intune Scope Tags and RBAC scope groups are enforced only for visibility/manageability and not as a hard security boundary, the PAW then falls under Tier2-scoped device configuration, compliance policies, and — critically — remote/remediation script execution rights, allowing a Tier2-scoped operator to run PowerShell scripts as SYSTEM or logged-on user on what was previously a Tier0-isolated device.

## Prerequisite
- Devices use **dynamic group membership** rules keyed on the `devicePhysicalIds` OrderID value, for example `ddg_Lab-Tier0.PAW.Devices` with rule `device.devicePhysicalIds -any _ -contains "[OrderID]:Tier0.PAW"` — the standard Microsoft-documented pattern for PAW scoping.
- Tier boundaries rely on **Intune Scope Tags / Scope Groups** for isolation rather than hard Entra-level access boundaries (e.g. Restricted Management Administrative Units are not consistently applied to the device, its dynamic group `ddg_Lab-Tier0.PAW.Devices`, or its Autopilot object).
- The attacking principal is a member of a Tier2-scoped assignment group, e.g. `pag_Lab-Tier2.Intune.EnrollmentProgramManager`. This is a custom role assignment whose Enrollment programs and Corporate device identifiers permissions are represented by the built-in **Policy and Profile manager** role, including:
  - `Microsoft.Intune/CorporateDeviceIdentifiers/Update`
  - Delegation over Windows Autopilot devices (via a Restricted Management AU or Intune scope group covering Tier2 devices — but Autopilot device object updates are **not scopeable** and act tenant-wide).
- A second Tier2-scoped custom assignment group, e.g. `pag_Lab-Tier2.Intune.RemoteActions`, carries the Remote Tasks / Run Remediation capability represented by the built-in **Help Desk Operator** role, targeting the Tier2 dynamic device group `ddg_Lab-Tier2.User.Devices`.
- No Conditional Access filter (device `PhysicalIds` filter) or additional compensating control restricts policy/script assignment strictly to devices whose OrderID still resolves to `Tier0.PAW`.

## Steps
1. As a Tier2-scoped admin (e.g. member of `pag_Lab-Tier2.Intune.EnrollmentProgramManager`), open **Devices > Enrollment > Windows Autopilot devices** in the Intune admin center.
2. Select a known Tier0 PAW device (e.g. `PAW1`, currently tagged `Tier0.PAW`) and edit its **Group Tag** field, changing it from `Tier0.PAW` to `Tier2.User`.
3. This update is written by the **Device Registration Service** as an `Update device` audit event on the Entra device object, overwriting the `[OrderId]` entry inside `devicePhysicalIds` from `[OrderId]:Tier0.PAW` to `[OrderID]:Tier2.User`.
4. Entra ID dynamic group evaluation re-processes membership: `PAW1` is automatically removed from `ddg_Lab-Tier0.PAW.Devices` (rule: `contains "[OrderID]:Tier0.PAW"`) and added to `ddg_Lab-Tier2.User.Devices` (rule: `contains "[OrderID]:Tier2.User"`).
5. If the Tier2 group is used as an Intune assignment target, its configuration and compliance policies can now apply to the former PAW. The attacking administrator must separately have RBAC visibility and management access to the relevant Intune objects through their scope groups and scope tags.
6. A Tier2-scoped Intune admin holding `pag_Lab-Tier2.Intune.RemoteActions` (Remote Tasks/Run Remediation permission) on `ddg_Lab-Tier2.User.Devices` assigns a remediation or platform script to `PAW1`.
7. The script executes on the (formerly Tier0-isolated) `PAW1` as the logged-in user or SYSTEM, achieving code execution on a Control Plane asset from a Tier2-privileged identity — a full tier breach.

## Actions
- DeviceManagement | Microsoft.Intune/CorporateDeviceIdentifiers/Update
- DeviceManagement | Microsoft.Intune/CorporateDeviceIdentifiers/Create
- DeviceManagement | Microsoft.Intune/CorporateDeviceIdentifiers/Read
- DeviceManagement | Microsoft.Intune/RemoteTasks/OnDemandProactiveRemediation

## Roles
- DeviceManagement | Policy and Profile manager
- DeviceManagement | Help Desk Operator

## Mitigations
- Prevent `[OrderID]` / Group Tag changes on already-provisioned Tier0 devices such as `PAW1` (restrict Autopilot device identifier update permissions; these are not scopeable, so avoid granting them to any non-Tier0 admin, e.g. `pag_Lab-Tier2.Intune.EnrollmentProgramManager`).
- Add a **Conditional Access / Assignment filter** on `PhysicalIds` to independently validate the intended tier of a device rather than relying solely on dynamic group membership (`ddg_Lab-Tier0.PAW.Devices` / `ddg_Lab-Tier2.User.Devices`) derived from a mutable attribute.
- Monitor Entra ID audit logs for `Update device` events changing `devicePhysicalIds`/`[OrderID]` values (e.g. `Tier0.PAW` → `Tier2.User`), and alert when a device transitions between tier-tagged dynamic groups.
- Use Multi Admin Approval for script/remediation assignment via role assignments such as `pag_Lab-Tier2.Intune.RemoteActions` — noting its current limitations (no target scoping, breaks automation, no notifications).
- Prefer EntraOps classification + BloodHound pathfinding to continuously identify devices/objects where Tier0/Tier1 dynamic groups (e.g. `ddg_Lab-Tier0.PAW.Devices`) are reachable by lower-tier Intune role assignments (e.g. `pag_Lab-Tier2.Intune.*`).
- Implement a **hard security boundary** for Tier0/Tier1 devices by introducing a Red Tenant Architecture to manage devices and their Autopilot objects in a separate tenant with fully isolated administrative plane, rather than relying on Intune scope tags and dynamic group membership for tier separation.

## References
- Thomas Naunheim & Martin Sohn Christensen — Tier Breakers: Blind Spots in Cloud-Managed PAWs (TROOPERS26) | https://www.troopers.de/troopers26/agenda/tier-breakers-blind-spots-in-cloud-managed-paws/
- Microsoft Learn - Microsoft Intune built-in roles reference | https://learn.microsoft.com/en-us/intune/fundamentals/role-based-access-control/ref-built-in-roles
- Microsoft Learn - Manually register devices with Windows Autopilot | https://learn.microsoft.com/en-us/autopilot/add-devices
- Microsoft Learn - Manage rules for dynamic membership groups in Microsoft Entra ID | https://learn.microsoft.com/en-us/entra/identity/users/groups-dynamic-membership
- Microsoft Learn - Use RBAC and scope tags for distributed IT | https://learn.microsoft.com/en-us/intune/fundamentals/role-based-access-control/scope-tags
- EntraOps — https://entraops.com | https://github.com/Cloud-Architekt/EntraOps
- SpecterOps — BloodHound OpenGraph | https://specterops.io/opengraph
