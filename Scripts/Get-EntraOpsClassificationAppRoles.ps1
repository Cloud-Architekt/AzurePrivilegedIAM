# Get EntraOps Classification
$Classification = Get-Content -Path .\EntraOps_Classification/Classification_AppRoles.json | ConvertFrom-Json -Depth 10

# Get Graph API actions 
$GraphPermissions = Invoke-WebRequest -Method GET -Uri "https://raw.githubusercontent.com/merill/graphpermissions.github.io/main/permissions.csv" | ConvertFrom-Csv

# Get information about App Role Provider
$AppRoleProviderIds = @("00000003-0000-0000-c000-000000000000")
$AppRoleProviders = foreach ($AppRoleProviderId in $AppRoleProviderIds) {
    (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/servicePrincipals?`$filter=appId eq '$FirstPartyAppRoleProvider'" -OutputType PSObject).value | select-object appId, appRoles
}

$AppRoles = $AppRoleProviders | foreach-object {

    foreach ($AppRole in $_.AppRoles) {

        # Apply Classification
        $AppRoleTierLevelClassification = $Classification | where-object {$_.TierLevelDefinition.RoleDefinitionActions -contains $($AppRole.value)} | select-object EAMTierLevelName, EAMTierLevelTagValue
        $AppRoleServiceClassification = $Classification | select-object -ExpandProperty TierLevelDefinition | where-object {$_.RoleDefinitionActions -contains $($AppRole.value)} | select-object Service

        # Apply Autorized Graph Calls if AppRoleProvider is Microsoft Graph
        if ($_.appId -eq "00000003-0000-0000-c000-000000000000") {
            $AppRoleAuthorizedApiCalls = $GraphPermissions | where-object {$_.PermissionName -contains $($AppRole.value)} | select-object -ExpandProperty API
        }
        else {
            $AppRoleAuthorizedApiCalls = $null
        }

        if ($AppRoleTierLevelClassification.Count -gt 1 -and $AppRoleServiceClassification.Count -gt 1) {
            Write-Warning "Multiple Tier Level Classification found for $($AppRole.value)"
        }

        if ($null -eq $AppRoleTierLevelClassification) {
            $AppRoleTierLevelClassification = [PSCustomObject]@{
                "EAMTierLevelName"      = "Unclassified"
                "EAMTierLevelTagValue"  = "Unclassified"
            }
        }

        if ($null -eq $AppRoleServiceClassification) {
            $AppRoleServiceClassification = [PSCustomObject]@{
                "Service"             = "Unclassified"
            }
        }

        [PSCustomObject]@{
            "AppId"                 = $_.appId
            "AppRoleId"             = $AppRole.id
            "AppRoleDisplayName"    = $AppRole.value
            "AuthorizedApiCalls"    = $AppRoleAuthorizedApiCalls
            "Category"              = $AppRoleServiceClassification.Service
            "EAMTierLevelName"      = $AppRoleTierLevelClassification.EAMTierLevelName
            "EAMTierLevelTagValue"  = $AppRoleTierLevelClassification.EAMTierLevelTagValue
        }
    }
}

$AppRoles = $AppRoles | sort-object AppRoleDisplayName
$AppRoles | ConvertTo-Json -Depth 10 | Out-File .\Classification\Classification_AppRoles.json -Force