---
id: uami-federated-credential-backdoor
name: User-assigned managed identity federated credential backdoor
source: Thomas Naunheim (cloud-architekt) | https://www.cloud-architekt.net/identify-prevent-abuse-uami-fedcreds/
severity: High
targetTier: ControlPlane
---

## Summary
Azure RBAC write access over a user-assigned managed identity (UAMI) lets an actor add a federated identity credential that trusts an attacker-controlled external OpenID Connect provider. They can then mint tokens as that managed identity from outside Azure — a stealthy backdoor that inherits the UAMI’s (often Control Plane) Azure RBAC, Microsoft Graph and Entra ID role assignments and survives credential resets.

## Prerequisite
A role with Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials/write on a privileged UAMI (Managed Identity Contributor, the dedicated FIC Contributor role, Contributor or Owner).

## Steps
1. Enumerate user-assigned managed identities and the Azure / Graph / Entra ID privileges assigned to them.
2. Stand up an attacker-controlled OIDC issuer (for example ROADtools roadoidc) reachable from the internet.
3. Add a federated identity credential to the target UAMI trusting that issuer and subject via an Azure Resource Manager write call.
4. Exchange an OIDC token from the controlled issuer for an Entra ID access token as the managed identity and operate with its privileges.

## Actions
- Azure | Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials/write

## Roles
- Azure | Managed Identity Contributor
- Azure | Managed Identity Federated Identity Credential Contributor
- Azure | Contributor
- Azure | Owner

## References
- Thomas Naunheim — Identify and prevent abuse of Managed Identities with Federated Credentials | https://www.cloud-architekt.net/identify-prevent-abuse-uami-fedcreds/
- Dirk-jan Mollema — Persisting on Entra ID applications and User Managed Identities with Federated Credentials | https://dirkjanm.io/persisting-with-federated-credentials-entra-apps-managed-identities/
- MITRE ATT&CK T1098.001 — Additional Cloud Credentials | https://attack.mitre.org/techniques/T1098/001/
