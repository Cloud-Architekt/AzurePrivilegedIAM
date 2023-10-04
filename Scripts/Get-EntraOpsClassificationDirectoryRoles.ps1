# Get EntraOps Classification
$Classification = Get-Content -Path ./EntraOps_Classification/Classification_AadResources.json | ConvertFrom-Json -Depth 10

Write-Output "Query directory role templates for mapping ID to name and further details"
$DirectoryRoleDefinitions = (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/roleManagement/directory/roleDefinitions").value | where-object {$_.isBuiltin -eq "True"} | select-object displayName, templateId, isPrivileged, rolePermissions

$DirectoryRoles = $DirectoryRoleDefinitions | foreach-object {

    $DirectoryRolePermissions = $_.RolePermissions.allowedResourceActions
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

    $RoleDefinitionClassification         = $ClassifiedDirectoryRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction -Unique | Sort-Object TierLevelTagValue, Category

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