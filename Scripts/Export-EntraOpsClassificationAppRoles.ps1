function Export-EntraOpsClassificationAppRoles {

    [cmdletbinding()]
    param
    (
        [Parameter(Mandatory = $false)]
        $IncludeAuthorizedApiCalls = $False,

        [Parameter(Mandatory = $false)]
        [ValidateSet("All", "MicrosoftGraph")]
        [string] $AppRoleProvider = "All"
    )

    # Get EntraOps Classifications
    $ClassificationAppRoles = Get-Content -Path ./EntraOps_Classification/Classification_AppRoles.json | ConvertFrom-Json -Depth 10

    # Get Graph API actions
    if ($IncludeAuthorizedApiCalls -eq $true) {
        $AllAuthorizedApiCalls = Invoke-WebRequest -Method GET -Uri "https://raw.githubusercontent.com/merill/graphpermissions.github.io/main/permissions.csv" | ConvertFrom-Csv
    }

    # Get information about App Role Provider
    $AppRoleProviderIds = switch ($AppRoleProvider) {
        "MicrosoftGraph" {
            @("00000003-0000-0000-c000-000000000000") # Microsoft Graph
        }
        default {
            @(
                "00000003-0000-0000-c000-000000000000", # Microsoft Graph
                "00000002-0000-0000-c000-000000000000", # Windows Azure Active Directory
                "fc780465-2017-40d4-a0c5-307022471b92", # Microsoft Threat Protection (Defender ATP)
                "c161e42e-d4df-4a3d-9b42-e7a3c31f59d4", # Microsoft Intune
                "797f4846-ba00-4fd7-ba43-dac1f8f63013", # Azure Service Management
                "00000012-0000-0000-c000-000000000000", # Azure Rights Management Services
                "73c2949e-da2d-457a-9607-fcc665198967", # Microsoft Purview
                "c5393580-f805-4401-95e8-94b7a6ef2fc2", # Office 365 Management APIs
                "499b84ac-1321-427f-aa17-267ca6975798", # Azure DevOps
                "688413c8-5319-43e1-9a0e-42f49da53686", # Verified ID STS Controller
                "58c746b0-a0b0-4647-a8f6-12dde5981638", # Azure AD Identity Governance Insights
                "7b7531ad-5926-4f2d-8a1d-38495ad33e17", # Azure Advanced Threat Protection
                "93625bc8-bfe2-437a-97e0-3d0060024faa", # Microsoft password reset service
                "6bf85cfa-ac8a-4be5-b5de-425a0d0dc016"  # Microsoft Entra AD Synchronization Service
            )
        }
    }
    $AppRoleProviders = foreach ($AppRoleProviderId in $AppRoleProviderIds) {
        (Invoke-MgGraphRequest -Uri "https://graph.microsoft.com/beta/servicePrincipals?`$filter=appId eq '$AppRoleProviderId'" -OutputType PSObject).value | select-object appId, appRoles, publishedPermissionScopes
    }

    # Collect warnings during processing
    $UnclassifiedAppRoles = [System.Collections.Generic.List[PSCustomObject]]::new()

    # Process application permissions (appRoles) → Classification_AppRoles ('Application' or 'All')
    $AppRolesOutput = $AppRoleProviders | foreach-object {
        $CurrentAppId = $_.appId

        foreach ($AppRole in $_.AppRoles) {

            # Apply Classification (Application permissions match ResourceScope 'Application' or 'All')
            $AppRoleTierLevelClassification = $ClassificationAppRoles | where-object { ($_.TierLevelDefinition | where-object { $_.ResourceScope -in @("Application", "All") -and $_.ResourceAppId -eq $CurrentAppId }).RoleDefinitionActions -contains $($AppRole.value) } | select-object EAMTierLevelName, EAMTierLevelTagValue
            $AppRoleServiceClassification = $ClassificationAppRoles | select-object -ExpandProperty TierLevelDefinition | where-object { $_.ResourceScope -in @("Application", "All") -and $_.ResourceAppId -eq $CurrentAppId -and $_.RoleDefinitionActions -contains $($AppRole.value) } | select-object Service
            if ($IncludeAuthorizedApiCalls -eq $True -and $_.appId -eq "00000003-0000-0000-c000-000000000000") {
                # Apply Autorized Graph Calls if AppRoleProvider is Microsoft Graph
                $AppRoleAuthorizedApiCalls = $AllAuthorizedApiCalls | where-object { $_.PermissionName -contains $($AppRole.value) } | select-object -ExpandProperty API
            }

            if ($AppRoleTierLevelClassification.Count -gt 1 -and $AppRoleServiceClassification.Count -gt 1) {
                Write-Warning "Multiple Tier Level Classification found for $($AppRole.value)"
            }

            if ($null -eq $AppRoleTierLevelClassification) {
                $UnclassifiedAppRoles.Add([PSCustomObject]@{
                        AppId              = $_.appId
                        AppRoleDisplayName = $AppRole.value
                        PermissionType     = "Application"
                    })
                $AppRoleTierLevelClassification = [PSCustomObject]@{
                    "EAMTierLevelName"     = "Unclassified"
                    "EAMTierLevelTagValue" = "Unclassified"
                }
            }

            if ($null -eq $AppRoleServiceClassification) {
                $AppRoleServiceClassification = [PSCustomObject]@{
                    "Service" = "Unclassified"
                }
            }

            if ($IncludeAuthorizedApiCalls -eq $True) {
                [PSCustomObject]@{
                    "AppId"                = $_.appId
                    "AppRoleId"            = $AppRole.id
                    "AppRoleDisplayName"   = $AppRole.value
                    "AuthorizedApiCalls"   = $AppRoleAuthorizedApiCalls
                    "Category"             = $AppRoleServiceClassification.Service
                    "EAMTierLevelName"     = $AppRoleTierLevelClassification.EAMTierLevelName
                    "EAMTierLevelTagValue" = $AppRoleTierLevelClassification.EAMTierLevelTagValue
                }
            } else {
                [PSCustomObject]@{
                    "AppId"                = $_.appId
                    "AppRoleId"            = $AppRole.id
                    "AppRoleDisplayName"   = $AppRole.value
                    "Category"             = $AppRoleServiceClassification.Service
                    "EAMTierLevelName"     = $AppRoleTierLevelClassification.EAMTierLevelName
                    "EAMTierLevelTagValue" = $AppRoleTierLevelClassification.EAMTierLevelTagValue
                }
            }
        }
    }

    # Identify appRole permissions in Classification_AppRoles (Application/'All') not returned by API
    $ExistingAppRoleNames = $AppRolesOutput | Select-Object -ExpandProperty AppRoleDisplayName
    $MissingAppRolesInApi = [System.Collections.Generic.List[PSCustomObject]]::new()
    foreach ($TierLevel in $ClassificationAppRoles) {
        foreach ($TierDef in $TierLevel.TierLevelDefinition) {
            if ($TierDef.ResourceScope -in @("Application", "All") -and $TierDef.ResourceAppId -in $AppRoleProviderIds) {
                foreach ($Action in $TierDef.RoleDefinitionActions) {
                    if ($Action -notin $ExistingAppRoleNames) {
                        $MissingAppRolesInApi.Add([PSCustomObject]@{
                                AppId              = $TierDef.ResourceAppId
                                AppRoleDisplayName = $Action
                                ResourceScope      = $TierDef.ResourceScope
                                EAMTierLevelName   = $TierLevel.EAMTierLevelName
                                Category           = $TierDef.Service
                            })
                    }
                }
            }
        }
    }

    $AppRolesOutput = $AppRolesOutput | Sort-Object AppRoleDisplayName
    $AppRolesOutput | ConvertTo-Json -Depth 10 | Out-File .\Classification\Classification_AppRoles.json -Force

    # ── Warning Summary ───────────────────────────────────────────────────────────
    if ($MissingAppRolesInApi.Count -gt 0) {
        $missingTable = $MissingAppRolesInApi | Sort-Object ResourceScope, EAMTierLevelName, AppRoleDisplayName |
        Format-Table AppRoleDisplayName, ResourceScope, EAMTierLevelName, Category, AppId -AutoSize |
        Out-String -Width 220
        Write-Warning "[$($MissingAppRolesInApi.Count) appRoles] CLASSIFIED IN Classification_AppRoles BUT NOT FOUND IN API"
        Write-Warning "Entries defined in EntraOps_Classification/Classification_AppRoles.json (ResourceScope: Application or All) with no matching appRole on the queried service principals."
        Write-Warning $missingTable
    }

    if ($UnclassifiedAppRoles.Count -gt 0) {
        $unclassifiedTable = $UnclassifiedAppRoles | Sort-Object AppRoleDisplayName |
        Format-Table AppRoleDisplayName, PermissionType, AppId -AutoSize |
        Out-String -Width 220
        Write-Warning "[$($UnclassifiedAppRoles.Count) appRoles] IN API BUT NOT COVERED IN Classification_AppRoles"
        Write-Warning "appRoles returned by the API with no matching entry in EntraOps_Classification/Classification_AppRoles.json (or only defined under a different ResourceScope)."
        Write-Warning $unclassifiedTable
    }
}