---
id: azure-app-service-scm-code-execution
name: Azure App Service/Functions SCM deployment credential abuse
source: Karl Fosaaen (NetSPI) | https://www.netspi.com/blog/technical/cloud-penetration-testing/extracting-azure-managed-identity-tokens-from-app-services/
severity: High
targetTier: ControlPlane
---

## Summary
Retrieving the deployment profile or configuration for an App Service or Function App allows an actor to extract the Kudu (SCM) deployment credentials. Using these credentials, the actor can access the diagnostic SCM console, upload malicious code, and extract Managed Identity tokens or sensitive application secrets.

## Prerequisite
Write or action permissions over the specific Azure App Service or Function App.

## Steps
1. Find an App Service or Function App with an attached, privileged Managed Identity.
2. Exploit a role containing list-action permissions (e.g. `publishxml/action` or `config/list/action`) to retrieve the SCM deployment credentials.
3. Authenticate to the Kudu SCM endpoint (`https://<app-name>.scm.azurewebsites.net`).
4. Execute commands in the console to manually query the local identity endpoint or deploy a web shell.
5. Extract the Managed Identity token and use its privileges (e.g. Contributor or Owner) to escalate access.

## Actions
- Azure | Microsoft.Web/sites/publishxml/action
- Azure | Microsoft.Web/sites/config/list/action

## Roles
- Azure | Website Contributor
- Azure | Contributor

## References
- NetSPI (Karl Fosaaen) — Extracting Managed Identity Tokens from Azure App Services | https://www.netspi.com/blog/technical/cloud-penetration-testing/extracting-azure-managed-identity-tokens-from-app-services/
- MITRE ATT&CK T1648 — Serverless Execution | https://attack.mitre.org/techniques/T1648/
