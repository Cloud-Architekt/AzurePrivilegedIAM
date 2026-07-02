function Export-EntraOpsClassificationIdentityGovernanceRoles {

    <#
    .SYNOPSIS
        Get a JSON file with all classified Identity Governance (Entitlement Management) roles in Entra ID.

    .DESCRIPTION
        Read JSON classification file and match Identity Governance (Entitlement Management) role definitions in Entra ID tenant to export it as JSON.

    .PARAMETER SingleClassification
        Use the highest tier level classification only for each role definition. Default is $True.

    .PARAMETER IncludeCustomRoles
        Include custom role definitions in addition to built-in roles.

    .PARAMETER DefaultScope
        Default scope used for classification lookup. Default is "/AccessPackageCatalog/*".

    .PARAMETER Exportfile
        Path to the JSON file which should be exported. Default is ".\Classification\Classification_IdentityGovernance.json".

    .EXAMPLE
        Export all classified Identity Governance roles to the default export path.
        Export-EntraOpsClassificationIdentityGovernanceRoles

    .EXAMPLE
        Export all classified Identity Governance roles including custom roles.
        Export-EntraOpsClassificationIdentityGovernanceRoles -IncludeCustomRoles $true
    #>

    [cmdletbinding()]
    param
    (
        [Parameter(Mandatory = $false)]
        $SingleClassification = $True
        ,
        [Parameter(Mandatory = $false)]
        $IncludeCustomRoles = $False
        ,
        [Parameter(Mandatory = $false)]
        $DefaultScope = "/AccessPackageCatalog/*"
        ,
        [Parameter(Mandatory = $false)]
        $Exportfile = ".\Classification\Classification_IdentityGovernance.json"
    )

    # Get EntraOps Classification
    $Classification = Get-Content -Path ./EntraOps_Classification/Classification_IdentityGovernance.json | ConvertFrom-Json -Depth 10

    # Single classifcation (highest tier level only)
    Write-Output "Query Identity Governance (Entitlement Management) role templates for mapping ID to name and further details"
    $IdentityGovernanceRoleDefinitions = (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/roleManagement/entitlementManagement/roleDefinitions").value | select-object displayName, templateId, isBuiltin, isPrivileged, description, rolePermissions

    if ($IncludeCustomRoles -eq $False) {
        $IdentityGovernanceRoleDefinitions = $IdentityGovernanceRoleDefinitions | where-object { $_.isBuiltin -eq "True" }
    }

    $IdentityGovernanceRoles = $IdentityGovernanceRoleDefinitions | foreach-object {

        $IdentityGovernanceRolePermissions = $_.RolePermissions.allowedResourceActions
        $ClassifiedIdentityGovernanceRolePermissions = foreach ($RolePermission in $IdentityGovernanceRolePermissions) {
            # Apply Classification
            $IdentityGovernanceRolePermissionTierLevelClassification = $Classification | where-object { $_.TierLevelDefinition.RoleDefinitionActions -contains $($RolePermission) -and $_.TierLevelDefinition.RoleAssignmentScopeName -eq $DefaultScope } | select-object EAMTierLevelName, EAMTierLevelTagValue
            $IdentityGovernanceRolePermissionServiceClassification = $Classification | select-object -ExpandProperty TierLevelDefinition | where-object { $_.RoleDefinitionActions -contains $($RolePermission) -and $_.RoleAssignmentScopeName -eq $DefaultScope } | select-object Service

            if ($IdentityGovernanceRolePermissionTierLevelClassification.Count -gt 1 -and $IdentityGovernanceRolePermissionServiceClassification.Count -gt 1) {
                Write-Warning "Multiple Tier Level Classification found for $($RolePermission)"
            }

            if ($null -eq $IdentityGovernanceRolePermissionTierLevelClassification) {
                $IdentityGovernanceRolePermissionTierLevelClassification = [PSCustomObject]@{
                    "EAMTierLevelName"     = "Unclassified"
                    "EAMTierLevelTagValue" = "Unclassified"
                }
            }

            if ($null -eq $IdentityGovernanceRolePermissionServiceClassification) {
                $IdentityGovernanceRolePermissionServiceClassification = [PSCustomObject]@{
                    "Service" = "Unclassified"
                }
            }

            [PSCustomObject]@{
                "AuthorizedResourceAction" = $RolePermission
                "Category"                 = $IdentityGovernanceRolePermissionServiceClassification.Service
                "EAMTierLevelName"         = $IdentityGovernanceRolePermissionTierLevelClassification.EAMTierLevelName
                "EAMTierLevelTagValue"     = $IdentityGovernanceRolePermissionTierLevelClassification.EAMTierLevelTagValue
            }
        }

        if ($SingleClassification -eq $True) {
            $RoleDefinitionClassification = ($ClassifiedIdentityGovernanceRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction, Category -Unique | Sort-Object EAMTierLevelTagValue | select-object -First 1)
        } else {
            $FilteredRoleClassifications = ($ClassifiedIdentityGovernanceRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction -Unique | Sort-Object EAMTierLevelTagValue )
            $RoleDefinitionClassification = [System.Collections.Generic.List[object]]::new()
            $RoleDefinitionClassification.Add($FilteredRoleClassifications)
        }

        [PSCustomObject]@{
            "RoleId"          = $_.templateId
            "RoleName"        = $_.displayName
            "isPrivileged"    = $_.isPrivileged
            "RichDescription" = $_.description
            "RolePermissions" = $ClassifiedIdentityGovernanceRolePermissions
            "Classification"  = $RoleDefinitionClassification
        }
    }

    $IdentityGovernanceRoles = $IdentityGovernanceRoles | sort-object RoleName
    $IdentityGovernanceRoles | ConvertTo-Json -Depth 10 | Out-File $ExportFile -Force
}
