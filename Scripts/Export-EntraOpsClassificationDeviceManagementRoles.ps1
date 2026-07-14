function Export-EntraOpsClassificationDeviceManagementRoles {

    <#
    .SYNOPSIS
        Get a JSON file with all classified Device Management roles in Entra ID.

    .DESCRIPTION
        Read JSON classification file and match Device Management (Intune) role definitions in Entra ID tenant to export it as JSON.

    .PARAMETER SingleClassification
        Use the highest tier level classification only for each role definition. Default is $True.

    .PARAMETER IncludeCustomRoles
        Include custom role definitions in addition to built-in roles.

    .PARAMETER IncludeInheritedPermissions
        When a role definition has "inheritsPermissionsFrom" set (e.g. a custom role based on a built-in role
        template), also resolve and include all role actions of the referenced role definition(s) for classification
        and as role actions of the inheriting role. Resolution is recursive (inherited roles may themselves inherit
        from another role) and protected against circular references. Default is $True.

    .PARAMETER DefaultScope
        Default scope used for classification lookup. Default is "/".

    .PARAMETER Exportfile
        Path to the JSON file which should be exported. Default is ".\Classification\Classification_DeviceManagementRoles.json".

    .EXAMPLE
        Export all classified Device Management roles to the default export path.
        Export-EntraOpsClassificationDeviceManagementRoles

    .EXAMPLE
        Export all classified Device Management roles including custom roles.
        Export-EntraOpsClassificationDeviceManagementRoles -IncludeCustomRoles $true
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
        $IncludeInheritedPermissions = $True
        ,
        [Parameter(Mandatory = $false)]
        $DefaultScope = "/"
        ,
        [Parameter(Mandatory = $false)]
        $Exportfile = ".\Classification\Classification_DeviceManagementRoles.json"
    )

    # Resolve role actions inherited via "inheritsPermissionsFrom" (e.g. a custom role based on a built-in role
    # template). Recursively follows nested inheritance and guards against circular references.
    function Resolve-EntraOpsInheritedRoleActions {
        param
        (
            [Parameter(Mandatory = $true)] [string[]] $InheritedRoleIds,
            [Parameter(Mandatory = $true)] $RoleActionsLookup,
            [Parameter(Mandatory = $true)] [System.Collections.Generic.HashSet[string]] $VisitedRoleIds
        )

        $InheritedActions = New-Object System.Collections.Generic.List[string]
        foreach ($InheritedRoleId in $InheritedRoleIds) {
            if (-not $VisitedRoleIds.Add($InheritedRoleId)) {
                continue # already visited, avoid circular inheritance
            }

            if (-not $RoleActionsLookup.ContainsKey($InheritedRoleId)) {
                Write-Warning "inheritsPermissionsFrom references unknown role template ID '$InheritedRoleId'; unable to resolve inherited permissions."
                continue
            }

            $InheritedActions.AddRange([string[]]$RoleActionsLookup[$InheritedRoleId].Actions)

            if (@($RoleActionsLookup[$InheritedRoleId].InheritsFrom).Count -gt 0) {
                $NestedActions = Resolve-EntraOpsInheritedRoleActions -InheritedRoleIds $RoleActionsLookup[$InheritedRoleId].InheritsFrom -RoleActionsLookup $RoleActionsLookup -VisitedRoleIds $VisitedRoleIds
                $InheritedActions.AddRange($NestedActions)
            }
        }

        return $InheritedActions
    }

    # Get EntraOps Classification
    $Classification = Get-Content -Path ./EntraOps_Classification/Classification_DeviceManagement.json | ConvertFrom-Json -Depth 10

    # Single classifcation (highest tier level only)
    Write-Output "Query directory role templates for mapping ID to name and further details"
    $DeviceManagementRoleDefinitions = (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/roleManagement/deviceManagement/roleDefinitions").value | select-object displayName, templateId, isBuiltin, isPrivileged, rolePermissions, inheritsPermissionsFrom, assignmentMode

    # Build a lookup of role actions (and further inheritance) by templateId from the full, unfiltered role
    # definitions list so inherited permissions can be resolved even when IncludeCustomRoles is $False.
    $RoleActionsLookup = @{}
    foreach ($RoleDef in $DeviceManagementRoleDefinitions) {
        $RoleActionsLookup[$RoleDef.templateId] = [PSCustomObject]@{
            Actions      = @($RoleDef.RolePermissions.allowedResourceActions)
            InheritsFrom = @($RoleDef.inheritsPermissionsFrom | Select-Object -ExpandProperty id)
        }
    }

    if ($IncludeCustomRoles -eq $False) {
        $DeviceManagementRoleDefinitions = $DeviceManagementRoleDefinitions | where-object { $_.isBuiltin -eq "True" }
    }

    $DeviceManagementRoles = $DeviceManagementRoleDefinitions | foreach-object {

        $DeviceRolePermissions = @($_.RolePermissions.allowedResourceActions)

        # Include role actions inherited via inheritsPermissionsFrom (e.g. custom roles based on a built-in template)
        $InheritsPermissionsFromIds = @($_.inheritsPermissionsFrom | Select-Object -ExpandProperty id)
        if ($IncludeInheritedPermissions -eq $True -and $InheritsPermissionsFromIds.Count -gt 0) {
            $VisitedRoleIds = [System.Collections.Generic.HashSet[string]]::new()
            $VisitedRoleIds.Add($_.templateId) | Out-Null
            $InheritedActions = Resolve-EntraOpsInheritedRoleActions -InheritedRoleIds $InheritsPermissionsFromIds -RoleActionsLookup $RoleActionsLookup -VisitedRoleIds $VisitedRoleIds
            $DeviceRolePermissions = @($DeviceRolePermissions + $InheritedActions | Select-Object -Unique)
        }

        $ClassifiedDeviceRolePermissions = foreach ($RolePermission in $DeviceRolePermissions) {
            # Apply Classification
            $DeviceMgmtRolePermissionTierLevelClassification = $Classification | where-object { $_.TierLevelDefinition.RoleDefinitionActions -contains $($RolePermission) -and $_.TierLevelDefinition.RoleAssignmentScopeName -eq $DefaultScope } | select-object EAMTierLevelName, EAMTierLevelTagValue
            $DeviceMgmtRolePermissionServiceClassification = $Classification | select-object -ExpandProperty TierLevelDefinition | where-object { $_.RoleDefinitionActions -contains $($RolePermission) -and $_.RoleAssignmentScopeName -eq $DefaultScope } | select-object Service

            if ($DeviceMgmtRolePermissionTierLevelClassification.Count -gt 1 -and $DeviceMgmtRolePermissionServiceClassification.Count -gt 1) {
                Write-Warning "Multiple Tier Level Classification found for $($RolePermission)"
            }

            if ($null -eq $DeviceMgmtRolePermissionTierLevelClassification) {
                $DeviceMgmtRolePermissionTierLevelClassification = [PSCustomObject]@{
                    "EAMTierLevelName"     = "Unclassified"
                    "EAMTierLevelTagValue" = "Unclassified"
                }
            }

            if ($null -eq $DeviceMgmtRolePermissionServiceClassification) {
                $DeviceMgmtRolePermissionServiceClassification = [PSCustomObject]@{
                    "Service" = "Unclassified"
                }
            }

            [PSCustomObject]@{
                "AuthorizedResourceAction" = $RolePermission
                "Category"                 = $DeviceMgmtRolePermissionServiceClassification.Service
                "EAMTierLevelName"         = $DeviceMgmtRolePermissionTierLevelClassification.EAMTierLevelName
                "EAMTierLevelTagValue"     = $DeviceMgmtRolePermissionTierLevelClassification.EAMTierLevelTagValue
            }
        }

        if ($SingleClassification -eq $True) {
            $RoleDefinitionClassification = ($ClassifiedDeviceRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction, Category -Unique | Sort-Object EAMTierLevelTagValue | select-object -First 1)
        }
        else {
            $FilteredRoleClassifications = ($ClassifiedDeviceRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction -Unique | Sort-Object EAMTierLevelTagValue )
            $RoleDefinitionClassification = [System.Collections.Generic.List[object]]::new()
            $RoleDefinitionClassification.Add($FilteredRoleClassifications)
        }

        [PSCustomObject]@{
            "RoleId"                  = $_.templateId
            "RoleName"                = $_.displayName
            "isPrivileged"            = $_.isPrivileged
            "AssignmentMode"          = $_.assignmentMode
            "InheritsPermissionsFrom" = $InheritsPermissionsFromIds
            "RolePermissions"         = $ClassifiedDeviceRolePermissions
            "Classification"          = $RoleDefinitionClassification
        }
    }

    $DeviceManagementRoles = $DeviceManagementRoles | sort-object RoleName
    $DeviceManagementRoles | ConvertTo-Json -Depth 10 | Out-File $ExportFile -Force
}
