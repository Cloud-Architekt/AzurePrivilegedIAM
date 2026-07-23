---
id: azure-runbook-webhook-abuse
name: Webhook trigger abuse on Automation Runbooks
source: Microsoft Learn | https://learn.microsoft.com/en-us/azure/automation/automation-webhooks
severity: Medium
targetTier: ManagementPlane
---

## Summary
Azure Automation runbooks can be triggered externally by webhooks. If an attacker gains a webhook URI, whose URL contains the bearer token, they can trigger the linked runbook without Azure RBAC access to the Automation Account. Request-body data reaches the runbook through `WebhookData`; it only becomes attacker-controlled execution or privileged action when the runbook processes that data unsafely and has an appropriately privileged identity or credentials.

## Prerequisite
Discovery or theft of a valid Webhook URL for an Azure Automation Runbook.

## Steps
1. Retrieve or intercept a Webhook URI associated with an Azure Automation runbook (e.g., from source code, exposed logs, or previously exported ARM templates).
2. Construct a POST request to the Webhook URI.
3. Supply input in the request body. Its impact depends on how the runbook validates and processes `$WebhookData`.
4. If the runbook performs sensitive operations with an Automation Account managed identity or stored credentials, the attacker can cause those permitted operations to execute.

## Actions
- Azure | Microsoft.Automation/automationAccounts/webhooks/read
- Azure | Microsoft.Automation/automationAccounts/webhooks/write

## Roles
- Azure | Automation Contributor
- Azure | Contributor

## References
- Microsoft Learn - Start an Azure Automation Runbook from a Webhook | https://learn.microsoft.com/en-us/azure/automation/automation-webhooks
- MITRE ATT&CK T1552.001 - Unsecured Credentials: Credentials In Files | https://attack.mitre.org/techniques/T1552/001/
