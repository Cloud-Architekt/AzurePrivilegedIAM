function Export-EntraOpsClassificationDirectoryRoles {

    <#
    .SYNOPSIS
        Get a JSON file with all classified Entra ID Directory roles.

    .DESCRIPTION
        Read JSON classification file and match Entra ID directory role definitions to export it as JSON.

    .PARAMETER SingleClassification
        Use the highest tier level classification only for each role definition. Default is $True.

    .PARAMETER FilteredConditions
        List of role permission conditions to exclude from classification. Default filters out '$ResourceIsSelf' and '$SubjectIsOwner'.

    .PARAMETER IncludeCustomRoles
        Include custom role definitions in addition to built-in roles.

    .PARAMETER IncludeInheritedPermissions
        When a role definition has "inheritsPermissionsFrom" set (e.g. a custom role based on a built-in role
        template), also resolve and include all role actions of the referenced role definition(s) for classification
        and as role actions of the inheriting role. Resolution is recursive (inherited roles may themselves inherit
        from another role) and protected against circular references. Default is $True.

    .EXAMPLE
        Export all classified Entra ID Directory roles to "Classification\Classification_EntraIdDirectoryRoles.json".
        Export-EntraOpsClassificationDirectoryRoles

    .EXAMPLE
        Export all classified Entra ID Directory roles including custom roles.
        Export-EntraOpsClassificationDirectoryRoles -IncludeCustomRoles $true
    #>

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
        ,
        [Parameter(Mandatory = $false)]
        $IncludeInheritedPermissions = $false
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

    # Define sensitive role definitions without actions to classify
    $ControlPlaneRolesWithoutRoleActions = @(
        'd29b2b05-8046-44ba-8758-1e26182fcf32', # Directory Synchronization Accounts
        'a92aed5d-d78a-4d16-b381-09adb37eb3b0', # On Premises Directory Sync Account
        '9f06204d-73c1-4d4c-880a-6edb90606fd8' # Azure AD Joined Device Local Administrator
        'db506228-d27e-4b7d-95e5-295956d6615f' # Agent ID Administrator is sensitive but has no corresponding role action
    )

    $ManagementPlaneRolesWithoutRoleActions = @(
        '3f04f91a-4ad7-4bd3-bcfa-49882ea1a88a', # Purview Workload Content Administrator
        'e07494ad-1654-4dd2-922e-6f81a71bf00f', # Purview Workload Content Reader
        '02d5655b-c1cf-4e5f-98da-5fb919085bf6'  # Purview Workload Content Writer
    )    

    # Get EntraOps Classification
    $Classification = Get-Content -Path ./EntraOps_Classification/Classification_AadResources.json -Encoding UTF8 | ConvertFrom-Json -Depth 10

    # Single classifcation (highest tier level only)
    Write-Output "Query directory role templates for mapping ID to name and further details"
    $DirectoryRoleDefinitions = (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/roleManagement/directory/roleDefinitions").value | select-object displayName, templateId, isBuiltin, isPrivileged, rolePermissions, categories, richDescription, inheritsPermissionsFrom, assignmentMode

    # Build a lookup of role actions (and further inheritance) by templateId from the full, unfiltered role
    # definitions list so inherited permissions can be resolved even when IncludeCustomRoles is $False.
    $RoleActionsLookup = @{}
    foreach ($RoleDef in $DirectoryRoleDefinitions) {
        $RoleActionsLookup[$RoleDef.templateId] = [PSCustomObject]@{
            Actions      = @(($RoleDef.RolePermissions | Where-Object { $_.condition -notin $FilteredConditions }).allowedResourceActions)
            InheritsFrom = @($RoleDef.inheritsPermissionsFrom | Select-Object -ExpandProperty id)
        }
    }

    if ($IncludeCustomRoles -eq $False) {
        $DirectoryRoleDefinitions = $DirectoryRoleDefinitions | where-object { $_.isBuiltin -eq "True" }
    }

    $DirectoryRoles = $DirectoryRoleDefinitions | foreach-object {

        $DirectoryRolePermissions = @(($_.RolePermissions | Where-Object { $_.condition -notin $FilteredConditions }).allowedResourceActions)

        # Include role actions inherited via inheritsPermissionsFrom (e.g. custom roles based on a built-in template)
        $InheritsPermissionsFromIds = @($_.inheritsPermissionsFrom | Select-Object -ExpandProperty id)
        if ($IncludeInheritedPermissions -eq $True -and $InheritsPermissionsFromIds.Count -gt 0) {
            $VisitedRoleIds = [System.Collections.Generic.HashSet[string]]::new()
            $VisitedRoleIds.Add($_.templateId) | Out-Null
            $InheritedActions = Resolve-EntraOpsInheritedRoleActions -InheritedRoleIds $InheritsPermissionsFromIds -RoleActionsLookup $RoleActionsLookup -VisitedRoleIds $VisitedRoleIds
            $DirectoryRolePermissions = @($DirectoryRolePermissions + $InheritedActions | Select-Object -Unique)
        }

        $ClassifiedDirectoryRolePermissions = New-Object System.Collections.ArrayList
        foreach ($RolePermission in $DirectoryRolePermissions) {
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

            $ClassifiedDirectoryRolePermission = (
                [PSCustomObject]@{
                    "AuthorizedResourceAction" = $RolePermission
                    "Category"                 = $EntraRolePermissionServiceClassification.Service
                    "EAMTierLevelName"         = $EntraRolePermissionTierLevelClassification.EAMTierLevelName
                    "EAMTierLevelTagValue"     = $EntraRolePermissionTierLevelClassification.EAMTierLevelTagValue
                }
            )
            $ClassifiedDirectoryRolePermissions.Add($ClassifiedDirectoryRolePermission) | Out-Null
        }
        $ClassifiedDirectoryRolePermissions = $ClassifiedDirectoryRolePermissions | sort-object EAMTierLevelTagValue, Category, AuthorizedResourceAction

        if ($SingleClassification -eq $True) {
            $RoleDefinitionClassification = ($ClassifiedDirectoryRolePermissions | select-object -ExcludeProperty AuthorizedResourceAction, Category -Unique | Sort-Object EAMTierLevelTagValue | select-object -First 1)
        } else {
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

        if ($ManagementPlaneRolesWithoutRoleActions -contains $_.templateId) {
            $RoleDefinitionClassification = [PSCustomObject]@{
                "EAMTierLevelName"     = "ManagementPlane"
                "EAMTierLevelTagValue" = "1"
            }
        }        

        [PSCustomObject]@{
            "RoleId"                  = $_.templateId
            "RoleName"                = $_.displayName
            "isPrivileged"            = $_.isPrivileged
            "AssignmentMode"          = $_.assignmentMode
            "InheritsPermissionsFrom" = $InheritsPermissionsFromIds
            "Categories"              = $_.categories
            "RichDescription"         = $_.richDescription
            "RolePermissions"         = @($ClassifiedDirectoryRolePermissions) 
            "Classification"          = $RoleDefinitionClassification
        }    
    }

    $DirectoryRoles = $DirectoryRoles | sort-object RoleName
    $DirectoryRoles | ConvertTo-Json -Depth 10 | Out-File .\Classification\Classification_EntraIdDirectoryRoles.json -Force
}