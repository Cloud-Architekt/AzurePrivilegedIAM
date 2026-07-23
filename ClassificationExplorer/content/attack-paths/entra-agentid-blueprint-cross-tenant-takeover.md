---
id: entra-agentid-blueprint-cross-tenant-takeover
name: Agent ID blueprint credential cross-tenant takeover
source: Katie Knowles (Datadog Security Labs) | https://securitylabs.datadoghq.com/articles/agent-id-inside-agent-compromise/
severity: Critical
targetTier: ControlPlane
---

## Summary
Every Entra Agent ID agent is created from an agent identity blueprint (often published by a third-party "agent factory"). Any credential added to a blueprint's application object can authenticate as the blueprint principal and, through a Federated Managed Identity (`fmi_path`) token exchange, impersonate every agent identity ever created from that blueprint — in any Entra tenant the blueprint has been deployed to, with no tenant-to-tenant trust required. If one of those agents holds a privileged Microsoft Graph permission (for example `UserAuthMethod-TAP.ReadWrite.All`), the attacker can issue a Temporary Access Pass for a Global Administrator account and sign in, bypassing the user's password and MFA entirely.

## Prerequisite
Control over an account holding the Agent ID Administrator role (or another role granting `agentIdentityBlueprints/credentials/update`) in a tenant that has installed a third-party agent blueprint, or existing control over the blueprint publisher/app itself.

## Steps
1. From the compromised tenant, locate an agent identity blueprint (for example a third-party "agent factory" solution) using the Agent ID Administrator role.
2. Call the Microsoft Graph `addPassword` API against the blueprint's application object to add a new client secret, valid for use as the blueprint principal.
3. Identify other Entra tenants where the same blueprint may be deployed — for example via a guest user's UPN domain found in the compromised tenant's directory — and resolve that domain to a tenant ID via its `/.well-known/openid-configuration` endpoint.
4. Authenticate as the blueprint principal in the target tenant with a client-credentials grant using the stolen secret; the resulting token carries `AgentIdentity.CreateAsManager`.
5. Enumerate agent identities created from the blueprint in that tenant via `GET /beta/servicePrincipals/microsoft.graph.agentIdentity?$filter=agentAppId eq '<blueprint-app-id>'` to find a privileged agent (for example a "Temporary Access Agent" with `User.Read.All` / `UserAuthMethod-TAP.ReadWrite.All`).
6. Perform a two-step `fmi_path` token exchange — first requesting a token as the blueprint with `scope=api://AzureADTokenExchange/.default` and the target agent's ID as `fmi_path`, then presenting that token as a `client_assertion` for the agent identity's own `client_id` — to obtain an app-only token as the privileged agent.
7. Use the agent's `UserAuthMethod-TAP.ReadWrite.All` permission to set a Temporary Access Pass on a Global Administrator account and sign in to the Azure/Entra portal with it, bypassing the account's password and MFA.

## Actions
- EntraID | microsoft.directory/agentIdentityBlueprints/credentials/update
- EntraID | microsoft.directory/agentIdentities/authentication/update

## Roles
- EntraID | Agent ID Administrator

## References
- Katie Knowles (Datadog Security Labs) — Entra Agent ID: Inside a cross-tenant agent compromise | https://securitylabs.datadoghq.com/articles/agent-id-inside-agent-compromise/
- Datadog Security Labs — Entra Agent ID: Blueprint blast radius (part 1) | https://securitylabs.datadoghq.com/articles/agent-id-blueprint-blast-radius/
- Microsoft Learn — Agent identity blueprints | https://learn.microsoft.com/en-us/entra/agent-id/agent-blueprint
- Microsoft — Midnight Blizzard: Guidance for responders on nation-state attack | https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/
- MITRE ATT&CK T1098.001 — Additional Cloud Credentials | https://attack.mitre.org/techniques/T1098/001/
