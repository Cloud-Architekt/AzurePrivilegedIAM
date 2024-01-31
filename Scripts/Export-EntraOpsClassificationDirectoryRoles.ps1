function Export-EntraOpsClassificationDirectoryRoles {

    [cmdletbinding()]
    param
    (
        [Parameter(Mandatory = $false)]
        $SingleClassification = $True
        ,
        [Parameter(Mandatory = $false)]
        $FilteredConditions = @('$ResourceIsSelf','$SubjectIsOwner')
        ,
        [Parameter(Mandatory = $false)]
        $IncludeCustomRoles = $False
    )

    # Get EntraOps Classification
    $Classification = Get-Content -Path ./EntraOps_Classification/Classification_AadResources.json | ConvertFrom-Json -Depth 10

    # Single classifcation (highest tier level only)
    Write-Output "Query directory role templates for mapping ID to name and further details"
    $DirectoryRoleDefinitions = (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/roleManagement/directory/roleDefinitions").value | select-object displayName, templateId, isBuiltin, isPrivileged, rolePermissions

    if ($IncludeCustomRoles -eq $False) {
        $DirectoryRoleDefinitions = $DirectoryRoleDefinitions | where-object {$_.isBuiltin -eq "True"}
    }

    $DirectoryRoles = $DirectoryRoleDefinitions | foreach-object {

        $DirectoryRolePermissions = ($_.RolePermissions | Where-Object {$_.condition -notin $FilteredConditions}).allowedResourceActions
        $ClassifiedDirectoryRolePermissions = foreach ($RolePermission in $DirectoryRolePermissions) {
            # Apply Classification
            $EntraRolePermissionTierLevelClassification = $Classification | where-object {$_.TierLevelDefinition.RoleDefinitionActions -contains $($RolePermission)} | select-object EAMTierLevelName, EAMTierLevelTagValue
            $EntraRolePermissionServiceClassification = $Classification | select-object -ExpandProperty TierLevelDefinition | where-object {$_.RoleDefinitionActions -contains $($RolePermission)} | select-object Service

            if ($EntraRolePermissionTierLevelClassification.Count -gt 1 -and $EntraRolePermissionServiceClassification.Count -gt 1) {
                Write-Warning "Multiple Tier Level Classification found for $($RolePermission)"
            }

            if ($null -eq $EntraRolePermissionTierLevelClassification) {
                $EntraRolePermissionTierLevelClassification = [PSCustomObject]@{
                    "EAMTierLevelName"      = "Unclassified"
                    "EAMTierLevelTagValue"  = "Unclassified"
                }
            }

            if ($null -eq $EntraRolePermissionServiceClassification) {
                $EntraRolePermissionServiceClassification = [PSCustomObject]@{
                    "Service"             = "Unclassified"
                }
            }

            [PSCustomObject]@{
                "AuthorizedResourceAction"  = $RolePermission
                "Category"                  = $EntraRolePermissionServiceClassification.Service
                "EAMTierLevelName"          = $EntraRolePermissionTierLevelClassification.EAMTierLevelName
                "EAMTierLevelTagValue"      = $EntraRolePermissionTierLevelClassification.EAMTierLevelTagValue
            }    
        }

        if ($SingleClassification -eq $True) {
            $RoleDefinitionClassification            = ($ClassifiedDirectoryRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction, Category -Unique | Sort-Object EAMTierLevelTagValue | select-object -First 1)
        }
        else {
            $FilteredRoleClassifications            = ($ClassifiedDirectoryRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction -Unique | Sort-Object EAMTierLevelTagValue )
            $RoleDefinitionClassification           = [System.Collections.Generic.List[object]]::new()
            $RoleDefinitionClassification.Add($FilteredRoleClassifications)        
        }

        [PSCustomObject]@{
            "RoleId"                = $_.templateId
            "RoleName"              = $_.displayName
            "isPrivileged"          = $_.isPrivileged
            "RolePermissions"       = $ClassifiedDirectoryRolePermissions
            "Classification"        = $RoleDefinitionClassification
        }    
    }

    $DirectoryRoles = $DirectoryRoles | sort-object RoleName
    $DirectoryRoles | ConvertTo-Json -Depth 10 | Out-File .\Classification\Classification_EntraIdDirectoryRoles.json -Force
}