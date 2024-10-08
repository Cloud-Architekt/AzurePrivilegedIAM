# Privileged Identity & Access in Microsoft Entra
Docs, resources and samples to implement a secure privileged identity and access management in Microsoft Azure and Microsoft Entra.

## 📝 Classification of Roles and Permissions
I've created an approach to automate classification of role actions based on Microsoft's Enterprise Access Model. Samples of the classification file which I've created for the implementation in EntraOps can be found here:

* [EntraOps - Defined Classification of Entra ID Role Actions in JSON](https://github.com/Cloud-Architekt/AzurePrivilegedIAM/blob/main/EntraOps_Classification/Classification_AadResources.json)
* [EntraOps - Defined Classification of Microsoft Graph API Permissions in JSON](https://github.com/Cloud-Architekt/AzurePrivilegedIAM/blob/main/EntraOps_Classification/Classification_AppRoles.json)

The generated classification (based on the previous definition files) are also available and can be used as lookup in analytics rules (in Microsoft Sentinel) or to built your own automation and/or entity enrichment:

* [Classified Entra ID Roles in JSON](https://github.com/Cloud-Architekt/AzurePrivilegedIAM/blob/main/Classification/Classification_EntraIdDirectoryRoles.json)
* [Classified Microsoft Graph API Permissions in JSON](https://raw.githubusercontent.com/Cloud-Architekt/AzurePrivilegedIAM/main/Classification/Classification_AppRoles.json)

Sample queries to use classification in KQL queries in Microsoft Sentinel can be found here:

* [List of (active/permanent) Directory role member with enriched classification](https://github.com/Cloud-Architekt/AzureSentinel/blob/main/Hunting%20Queries/EID-PrivilegedIdentities/DirectoryRoleMemberWithClassification.kusto)
* [Report of privileged operations (sorted by count) from directory role members with enriched classification of roles](https://raw.githubusercontent.com/Cloud-Architekt/AzureSentinel/main/Hunting%20Queries/EID-PrivilegedIdentities/SummaryOfPrivilegedOperationsByDirectoryRoleMember.kusto)
* [Added API Permissions with enriched classification from EntraOps Privileged EAM](https://github.com/Cloud-Architekt/AzureSentinel/blob/main/Hunting%20Queries/EID-PrivilegedIdentities/AddedAppRolesWithClassification.kusto)
* [Sign-in to Cloud Application with sensitive delegated permission (classified by EntraOps Privileged EAM) to Microsoft Graph API](https://raw.githubusercontent.com/Cloud-Architekt/AzureSentinel/main/Hunting%20Queries/EID-PrivilegedIdentities/SensitiveMicrosoftGraphDelegatedPermissionAccess.kusto)

The helper script to create classification by using the definition of classification are available here:

* [Script for Classification of Entra ID Roles](./Scripts/Export-EntraOpsClassificationDirectoryRoles.ps1)
* [Script for Classification of Microsoft Graph API Permission](./Scripts/Export-EntraOpsClassificationAppRoles.ps1)

Side Note: The classification export of App Roles (`Export-EntraOpsClassificationAppRoles`) can also include a list of "Authorized Api Calls" by using the Parameter `IncludeAuthorizedApiCalls`. This information will be enriched from the GitHub project "[graphpermissions.github.io](https://github.com/merill/graphpermissions.github.io)" (created by [Merill Fernando](https://github.com/merill)). Kudos to Merill!

### 📢 Call for Community Contributors!
Mostly, role actions and permissions on Control Plane has been classified. There are still a high number of "unclassified" role actions and maybe also some classified roles which should be reviewed or may assessed differently. As already described, the source for all classification will be managed in the "[EntraOps_Classification](https://github.com/Cloud-Architekt/AzurePrivilegedIAM/tree/main/EntraOps_Classification)" files and should be the single point for modification to this project. I would be more than happy to see contributions by the community which helps to increase the coverage and quality of the classification for the Enterprise Access Model. Feel free to create PR, issues or contact me if you have any further questions or feedback.

### 💡 Community use cases and references
- [AzEntraIdApiPermissionsAdvertizer (Tool by Julian Hayward)](https://www.azadvertizer.net/azEntraIdAPIpermissionsAdvertizer.html) serves as a quick reference for 1st party Microsoft Entra Id applications and their respective API permissions (delegated and application permissions). My classification files has been used for enrichment of the API Permissions.
- [AzEntraIdRolesAdvertizer (Tool by Julian Hayward)](https://www.azadvertizer.net/azEntraIdRolesAdvertizer.html) serves as a reference, snapshot and detailed overview of all Entra ID Roles and their role action permissions. My classification files has been used for enrichment of Directory Roles and Role Actions.
- [EntraOps Explorer (Tool by Chris Dymond)](https://www.entraexplorer.com/service-principals/app-role-assignments) is a Single Page Application (SPA) hosted on GitHub Pages, developed using Next.js, to provide insights about applications in Microsoft Entra. Graph API permission classification of EntraOps will be used for estimation of permission level.
- [FalconFound (Tool by Falcon Force)](https://github.com/FalconForceTeam/FalconHound/releases/tag/v1.4.0) allows you to utilize and enhance the power of BloodHound in a more automated fashion. It is designed to be used in conjunction with a SIEM or other log aggregation tool. Tiering classification has been implemented from this project.
- [Generate Cypher for Bloodhoud (by Martin Sohn)](https://gist.github.com/martinsohn/3f6122c7486ca3ffcaa444772f1a35f2) offers a code sample for generating a cypher for searching high-privileged roles based on the EntraOps classification.
- [Detect threats using Microsoft Graph activity logs (Blog post by Fabian Bader)](https://cloudbrothers.info/detect-threats-microsoft-graph-logs-part-2/#find-missing-sign-in-logs) describes how to build advanced Microsoft Sentinel detections for this logs. Sample queries show how new sensitive role can be detected by using the classification files.

## 🔁 Lifecycle Workflows
On- and Offboarding of Privileged Accounts can be automated with the Entra ID Governance feature "Lifecycle workflows". Samples for the custom tasks can be found here and are described in the blog post "[Automated Lifecycle Workflows for Privileged Identities with Azure AD Identity Governance](https://www.cloud-architekt.net/manage-privileged-identities-with-azuread-identity-governance/)"

## 📄 Role Definition Matrix of Personas for Privileged Access in Microsoft Azure
Various articles on Microsoft Learn describes Roles and Personas for privileged access in Azure. I've created a role definition matrix to compare the descriptions of personas but also tiering levels from Enterprise Access Model. Check out the "[EAS_EAM_AzureRBAC_TabularSummary.pdf](https://github.com/Cloud-Architekt/AzurePrivilegedIAM/blob/main/EAS_EAM_AzureRBAC_TabularSummary.pdf)"

## 🤖 Scripts for Automation and Definition of Classification
Examples for PowerShell Scripts to export a list of privileged assignments in Azure (incl. Azure Billing/Enterprise Agreement) and also helper files for Classification can be found [here](https://github.com/Cloud-Architekt/AzurePrivilegedIAM/tree/main/Scripts).
