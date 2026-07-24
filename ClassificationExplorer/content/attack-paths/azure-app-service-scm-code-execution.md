---
id: azure-app-service-scm-code-execution
name: Azure App Service/Functions SCM deployment credential abuse
source: Karl Fosaaen (NetSPI) | https://www.youtube.com/watch?v=CUTwkuiRgqg
severity: High
targetTier: ManagementPlane
---

## Summary
Retrieving an App Service or Function App publishing profile, usable publishing credential, or a deployment/code-write capability can allow an actor to access the Kudu (SCM) endpoint and deploy code. Reading configuration exposes sensitive application settings, but does not by itself guarantee SCM deployment credentials. Code execution can expose Managed Identity tokens or sensitive application secrets.

## Prerequisite
`Microsoft.Web/sites/publishxml/action`, configuration read access that exposes usable publishing credentials, or another deployment/code-write permission over a specific Azure App Service or Function App.

## Steps
1. Find an App Service or Function App with an attached, privileged Managed Identity.
2. Use the available permission to retrieve a publishing profile or usable publishing credential, or to deploy attacker-controlled code.
3. Authenticate to the Kudu SCM endpoint (`https://<app-name>.scm.azurewebsites.net`) when a publishing credential is available.
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
