---
id: graph-userauthenticationmethod-readwrite-all
name: Account takeover via Temporary Access Pass (UserAuthenticationMethod.ReadWrite.All)
source: Dirk-jan Mollema (dirkjanm.io) | https://dirkjanm.io/lateral-movement-and-hash-dumping-with-temporary-access-passes-microsoft-entra/
severity: Critical
targetTier: ControlPlane
---

## Summary
This permission allows creating and modifying any user's authentication methods, including issuing a Temporary Access Pass (TAP) that counts as MFA. An attacker can non-destructively provision a TAP for a privileged user, sign in as them (satisfying MFA), and then register durable methods such as a passkey or Windows Hello for persistence. Because MFA reset and TAP management are bundled into one indivisible permission, holding it enables silent takeover of arbitrary accounts up to Global Administrator.

## Prerequisite
A compromised principal with UserAuthenticationMethod.ReadWrite.All (plus Policy.ReadWrite.AuthenticationMethod if TAP is not already enabled tenant-wide).

## Steps
1. Authenticate with the permission and, if needed, enable the TAP authentication-method policy.
2. Create a TAP for a targeted privileged user via the authentication-methods API.
3. Sign in as the user with the TAP, satisfying MFA without notifying them.
4. Register a persistent passwordless method (passkey / Windows Hello) to retain access after the TAP expires.

## Permissions
- Microsoft Graph | UserAuthenticationMethod.ReadWrite.All | Application
- Microsoft Graph | Policy.ReadWrite.AuthenticationMethod | Application

## Roles
- EntraID | Privileged Authentication Administrator
- EntraID | Authentication Administrator

## References
- Dirk-jan Mollema — Lateral movement and hash dumping with Temporary Access Passes | https://dirkjanm.io/lateral-movement-and-hash-dumping-with-temporary-access-passes-microsoft-entra/
- Emilien Socchi — Tiering Entra roles and application permissions based on attack paths | https://www.emiliensocchi.io/tiering-entra-roles-and-application-permissions-based-on-attack-paths/
- UserAuthenticationMethod.ReadWrite.All — Graph permission reference | https://graphpermissions.merill.net/permission/UserAuthenticationMethod.ReadWrite.All
- Microsoft Learn — Configure a Temporary Access Pass in Microsoft Entra ID | https://learn.microsoft.com/entra/identity/authentication/howto-authentication-temporary-access-pass
