function Export-EntraOpsClassificationDirectoryRoles {

    [cmdletbinding()]
    param
    (
        [Parameter(Mandatory = $false)]
        $SingleClassification = $True
        ,
        [Parameter(Mandatory = $false)]
        $FilteredConditions = @('$ResourceIsSelf', '$SubjectIsOwner')
        ,
        [Parameter(Mandatory = $false)]
        $IncludeCustomRoles = $False
    )

    # Define sensitive role definitions without actions to classify
    $ControlPlaneRolesWithoutRoleActions = @(
        'd29b2b05-8046-44ba-8758-1e26182fcf32', # Directory Synchronization Accounts
        'a92aed5d-d78a-4d16-b381-09adb37eb3b0', # On Premises Directory Sync Account
        '9f06204d-73c1-4d4c-880a-6edb90606fd8' # Azure AD Joined Device Local Administrator
    )

    # Get EntraOps Classification
    $Classification = Get-Content -Path ./EntraOps_Classification/Classification_AadResources.json | ConvertFrom-Json -Depth 10

    # Single classifcation (highest tier level only)
    Write-Output "Query directory role templates for mapping ID to name and further details"
    $DirectoryRoleDefinitions = (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/roleManagement/directory/roleDefinitions").value | select-object displayName, templateId, isBuiltin, isPrivileged, rolePermissions, categories, richDescription

    if ($IncludeCustomRoles -eq $False) {
        $DirectoryRoleDefinitions = $DirectoryRoleDefinitions | where-object { $_.isBuiltin -eq "True" }
    }

    $DirectoryRoles = $DirectoryRoleDefinitions | foreach-object {

        $DirectoryRolePermissions = ($_.RolePermissions | Where-Object { $_.condition -notin $FilteredConditions }).allowedResourceActions
        $ClassifiedDirectoryRolePermissions = foreach ($RolePermission in $DirectoryRolePermissions) {
            # Apply Classification
            $EntraRolePermissionTierLevelClassification = $Classification | where-object { $_.TierLevelDefinition.RoleDefinitionActions -contains $($RolePermission) } | select-object EAMTierLevelName, EAMTierLevelTagValue
            $EntraRolePermissionServiceClassification = $Classification | select-object -ExpandProperty TierLevelDefinition | where-object { $_.RoleDefinitionActions -contains $($RolePermission) } | select-object Service

            if ($EntraRolePermissionTierLevelClassification.Count -gt 1 -and $EntraRolePermissionServiceClassification.Count -gt 1) {
                Write-Warning "Multiple Tier Level Classification found for $($RolePermission)"
            }

            if ($null -eq $EntraRolePermissionTierLevelClassification) {
                $EntraRolePermissionTierLevelClassification = [PSCustomObject]@{
                    "EAMTierLevelName"     = "Unclassified"
                    "EAMTierLevelTagValue" = "Unclassified"
                }
            }

            if ($null -eq $EntraRolePermissionServiceClassification) {
                $EntraRolePermissionServiceClassification = [PSCustomObject]@{
                    "Service" = "Unclassified"
                }
            }

            [PSCustomObject]@{
                "AuthorizedResourceAction" = $RolePermission
                "Category"                 = $EntraRolePermissionServiceClassification.Service
                "EAMTierLevelName"         = $EntraRolePermissionTierLevelClassification.EAMTierLevelName
                "EAMTierLevelTagValue"     = $EntraRolePermissionTierLevelClassification.EAMTierLevelTagValue
            }    
        }
        $ClassifiedDirectoryRolePermissions = $ClassifiedDirectoryRolePermissions | sort-object EAMTierLevelTagValue, Category, AuthorizedResourceAction

        if ($SingleClassification -eq $True) {
            $RoleDefinitionClassification = ($ClassifiedDirectoryRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction, Category -Unique | Sort-Object EAMTierLevelTagValue | select-object -First 1)
        }
        else {
            $FilteredRoleClassifications = ($ClassifiedDirectoryRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction -Unique | Sort-Object EAMTierLevelTagValue )
            $RoleDefinitionClassification = [System.Collections.Generic.List[object]]::new()
            $RoleDefinitionClassification.Add($FilteredRoleClassifications)        
        }

        if ($ControlPlaneRolesWithoutRoleActions -contains $_.templateId) {
            $RoleDefinitionClassification = [PSCustomObject]@{
                "EAMTierLevelName"     = "ControlPlane"
                "EAMTierLevelTagValue" = "0"
            }
        }

        [PSCustomObject]@{
            "RoleId"          = $_.templateId
            "RoleName"        = $_.displayName
            "isPrivileged"    = $_.isPrivileged
            "Categories"      = $_.categories
            "RichDescription" = $_.richDescription
            "RolePermissions" = $ClassifiedDirectoryRolePermissions
            "Classification"  = $RoleDefinitionClassification
        }    
    }

    $DirectoryRoles = $DirectoryRoles | sort-object RoleName
    $DirectoryRoles | ConvertTo-Json -Depth 10 | Out-File .\Classification\Classification_EntraIdDirectoryRoles.json -Force
}