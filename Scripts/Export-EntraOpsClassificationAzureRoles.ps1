function Export-EntraOpsClassificationAzureRoles {

    <#
    .SYNOPSIS
        Get a JSON file with all classified Azure RBAC roles.

    .DESCRIPTION
        Read JSON classification file and match Azure RBAC role definitions (Control/Management plane Actions and Data plane DataActions) to export it as JSON.

    .PARAMETER SingleClassification
        Use the highest tier level classification only for each role definition. Default is $True.

    .PARAMETER IncludeCustomRoles
        Include custom role definitions in addition to built-in roles. Default is $False.

    .PARAMETER DefaultScope
        Default role assignment scope used for classification lookup. Default is "/*" (applies to any scope).

    .PARAMETER ClassificationFile
        Path to the JSON classification definition file. Default is "./EntraOps_Classification/Classification_Azure.json".
        When the parameterized file (Classification_Azure.Param.json) is used, the scope placeholders are substituted with the values from Tier0IncludedResourceScope and Tier1IncludedResourceScope.

    .PARAMETER Tier0IncludedResourceScope
        List of Azure scopes (management groups, subscriptions, resource groups) which are treated as Control Plane (Tier 0). Used to substitute the <Tier0IncludedResourceScope> placeholder in the parameterized classification file. The tenant root scope ("/") is always included as Control Plane in addition to the scopes provided here.

    .PARAMETER Tier1IncludedResourceScope
        List of Azure scopes (management groups, subscriptions, resource groups) which are treated as Management Plane (Tier 1). Used to substitute the <Tier1IncludedResourceScope> placeholder in the parameterized classification file.

    .PARAMETER RoleDefinitionScope
        Optional scope passed to Get-AzRoleDefinition. Set this to the tenant root ("/") to also include tenant-scoped built-in roles (e.g. Reservations Administrator) which are not returned by the default subscription-scoped query. Default is $null (current Az context default).

    .PARAMETER Exportfile
        Path to the JSON file which should be exported. Default is ".\Classification\Classification_AzureResources.json".

    .EXAMPLE
        Export all classified Azure RBAC roles to the default export path.
        Export-EntraOpsClassificationAzureRoles

    .EXAMPLE
        Export all classified Azure RBAC roles including custom roles.
        Export-EntraOpsClassificationAzureRoles -IncludeCustomRoles $true
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
        $DefaultScope = "/*"
        ,
        [Parameter(Mandatory = $false)]
        $ClassificationFile = "./EntraOps_Classification/Classification_Azure.json"
        ,
        [Parameter(Mandatory = $false)]
        [string[]] $Tier0IncludedResourceScope = @()
        ,
        [Parameter(Mandatory = $false)]
        [string[]] $Tier1IncludedResourceScope = @()
        ,
        [Parameter(Mandatory = $false)]
        $RoleDefinitionScope = $null
        ,
        [Parameter(Mandatory = $false)]
        $Exportfile = ".\Classification\Classification_AzureResources.json"
    )

    # Wildcard-aware matching between an Azure role action and a classified action (both directions, case-insensitive)
    function Test-EntraOpsAzureActionMatch {
        param
        (
            [Parameter(Mandatory = $true)] [AllowEmptyString()] [string] $RoleAction,
            [Parameter(Mandatory = $true)] [AllowEmptyString()] [string] $ClassifiedAction
        )

        if ([string]::IsNullOrEmpty($RoleAction) -or [string]::IsNullOrEmpty($ClassifiedAction)) {
            return $false
        }

        if ($RoleAction -eq $ClassifiedAction) {
            return $true
        }

        $RolePattern = '^' + [Regex]::Escape($RoleAction).Replace('\*', '.*') + '$'
        $ClassifiedPattern = '^' + [Regex]::Escape($ClassifiedAction).Replace('\*', '.*') + '$'

        # Classified definition contains a wildcard which covers the role action (e.g. "Microsoft.Authorization/*/write")
        if ($ClassifiedAction.Contains('*') -and $RoleAction -imatch $ClassifiedPattern) {
            return $true
        }

        # Role action contains a wildcard which covers the classified action (e.g. role grants "Microsoft.Compute/*")
        if ($RoleAction.Contains('*') -and $ClassifiedAction -imatch $RolePattern) {
            return $true
        }

        return $false
    }

    # Determine whether a classified action is removed by a role's NotActions/NotDataActions. Only a NotAction
    # which is equal to or broader than the classified action cancels it (one-directional coverage), so a narrow
    # NotAction (e.g. "Microsoft.Authorization/roleAssignments/write") does not cancel a broad classified wildcard
    # (e.g. "Microsoft.Authorization/*/write").
    function Test-EntraOpsAzureActionExcluded {
        param
        (
            [Parameter(Mandatory = $true)] [AllowEmptyString()] [string] $ClassifiedAction,
            [Parameter(Mandatory = $false)] [string[]] $ExcludedActions = @()
        )

        if ([string]::IsNullOrEmpty($ClassifiedAction)) {
            return $false
        }

        foreach ($ExcludedAction in $ExcludedActions) {
            if ([string]::IsNullOrEmpty($ExcludedAction)) {
                continue
            }
            if ($ExcludedAction -eq $ClassifiedAction) {
                return $true
            }
            $ExcludedPattern = '^' + [Regex]::Escape($ExcludedAction).Replace('\*', '.*') + '$'
            if ($ClassifiedAction -imatch $ExcludedPattern) {
                return $true
            }
        }

        return $false
    }

    # Resolve the tier level and service classification for a single Azure role action
    function Get-EntraOpsAzureActionClassification {
        param
        (
            [Parameter(Mandatory = $true)] [string] $RoleAction,
            [Parameter(Mandatory = $true)] $Classification,
            [Parameter(Mandatory = $true)] [string] $Scope,
            [Parameter(Mandatory = $false)] [string[]] $ExcludedActions = @()
        )

        foreach ($TierLevel in $Classification) {
            foreach ($TierDefinition in $TierLevel.TierLevelDefinition) {

                $ScopeMatch = ($TierDefinition.RoleAssignmentScopeName -contains $Scope) -or ($TierDefinition.RoleAssignmentScopeName -contains "/*")
                if (-not $ScopeMatch) {
                    continue
                }

                # Honor excluded role assignment scopes (e.g. Management Plane definitions which defer to Control Plane on Tier 0 scopes)
                if ($null -ne $TierDefinition.ExcludedRoleAssignmentScopeName -and ($TierDefinition.ExcludedRoleAssignmentScopeName -contains $Scope)) {
                    continue
                }

                $ExcludedMatch = $false
                foreach ($ExcludedAction in $TierDefinition.ExcludedRoleDefinitionActions) {
                    if (Test-EntraOpsAzureActionMatch -RoleAction $RoleAction -ClassifiedAction $ExcludedAction) {
                        $ExcludedMatch = $true
                        break
                    }
                }
                if ($ExcludedMatch) {
                    continue
                }

                foreach ($ClassifiedAction in $TierDefinition.RoleDefinitionActions) {
                    if (Test-EntraOpsAzureActionMatch -RoleAction $RoleAction -ClassifiedAction $ClassifiedAction) {
                        # Skip when the role explicitly removes this capability via NotActions/NotDataActions
                        if (Test-EntraOpsAzureActionExcluded -ClassifiedAction $ClassifiedAction -ExcludedActions $ExcludedActions) {
                            continue
                        }
                        return [PSCustomObject]@{
                            "Service"              = $TierDefinition.Service
                            "EAMTierLevelName"     = $TierLevel.EAMTierLevelName
                            "EAMTierLevelTagValue" = $TierLevel.EAMTierLevelTagValue
                        }
                    }
                }
            }
        }

        return $null
    }

    # Read permission arrays from a role definition, supporting both the legacy flattened properties
    # (Actions/NotActions/DataActions/NotDataActions) and the new Permissions[] structure which replaces
    # them (breaking change announced for Get-AzRoleDefinition / PSRoleDefinition).
    function Get-EntraOpsRolePermission {
        param
        (
            [Parameter(Mandatory = $true)] $RoleDefinition,
            [Parameter(Mandatory = $true)] [ValidateSet("Actions", "NotActions", "DataActions", "NotDataActions")] [string] $PermissionType
        )

        if ($null -ne $RoleDefinition.Permissions -and @($RoleDefinition.Permissions).Count -gt 0) {
            return @($RoleDefinition.Permissions | ForEach-Object { $_.$PermissionType } | Where-Object { $null -ne $_ })
        }

        return @($RoleDefinition.$PermissionType)
    }

    # Get EntraOps Classification (substitute scope placeholders when a parameterized classification file is used)
    # The tenant root scope ("/") is always treated as Control Plane (Tier 0), regardless of the caller-provided
    # Tier0IncludedResourceScope, since it is used both to include it on Control Plane definitions and to exclude
    # it from Management Plane definitions (via <Tier0IncludedResourceScope> in ExcludedRoleAssignmentScopeName).
    $ClassificationContent = Get-Content -Path $ClassificationFile -Raw
    $EffectiveTier0IncludedResourceScope = @("/") + @($Tier0IncludedResourceScope | Where-Object { $_ -ne "/" })
    $Tier0ScopeReplacement = (($EffectiveTier0IncludedResourceScope | ForEach-Object { '"' + $_ + '"' }) -join ", ")
    $Tier1ScopeReplacement = (($Tier1IncludedResourceScope | ForEach-Object { '"' + $_ + '"' }) -join ", ")
    $ClassificationContent = $ClassificationContent.Replace("<Tier0IncludedResourceScope>", $Tier0ScopeReplacement)
    $ClassificationContent = $ClassificationContent.Replace("<Tier1IncludedResourceScope>", $Tier1ScopeReplacement)
    $Classification = $ClassificationContent | ConvertFrom-Json -Depth 10

    # Query Azure RBAC role definitions for mapping ID to name and further details
    Write-Output "Query Azure RBAC role definitions for mapping ID to name and further details"
    if ($null -ne $RoleDefinitionScope -and -not [string]::IsNullOrEmpty($RoleDefinitionScope)) {
        # Query at a specific scope (e.g. the tenant root "/") to also include tenant-scoped built-in roles such as Reservations Administrator
        $AzureRoleDefinitions = Get-AzRoleDefinition -Scope $RoleDefinitionScope
    } else {
        $AzureRoleDefinitions = Get-AzRoleDefinition
    }
    $AzureRoleDefinitions = $AzureRoleDefinitions | Select-Object Id, Name, IsCustom, Description, Actions, NotActions, DataActions, NotDataActions, Permissions

    if ($IncludeCustomRoles -eq $False) {
        $AzureRoleDefinitions = $AzureRoleDefinitions | Where-Object { $_.IsCustom -eq $False }
    }

    $AzureRoles = $AzureRoleDefinitions | ForEach-Object {

        # Combine control/management plane Actions and data plane DataActions for classification
        $RoleActions = Get-EntraOpsRolePermission -RoleDefinition $_ -PermissionType "Actions"
        $RoleNotActions = Get-EntraOpsRolePermission -RoleDefinition $_ -PermissionType "NotActions"
        $RoleDataActions = Get-EntraOpsRolePermission -RoleDefinition $_ -PermissionType "DataActions"
        $RoleNotDataActions = Get-EntraOpsRolePermission -RoleDefinition $_ -PermissionType "NotDataActions"

        $RolePermissionEntries = New-Object System.Collections.ArrayList
        foreach ($Action in $RoleActions) {
            $RolePermissionEntries.Add([PSCustomObject]@{ "Action" = $Action; "ActionType" = "Action"; "ExcludedActions" = $RoleNotActions }) | Out-Null
        }
        foreach ($DataAction in $RoleDataActions) {
            $RolePermissionEntries.Add([PSCustomObject]@{ "Action" = $DataAction; "ActionType" = "DataAction"; "ExcludedActions" = $RoleNotDataActions }) | Out-Null
        }

        $ClassifiedAzureRolePermissions = New-Object System.Collections.ArrayList
        foreach ($RolePermissionEntry in $RolePermissionEntries) {

            $RolePermission = $RolePermissionEntry.Action

            # Apply Classification
            $AzureRolePermissionClassification = Get-EntraOpsAzureActionClassification -RoleAction $RolePermission -Classification $Classification -Scope $DefaultScope -ExcludedActions $RolePermissionEntry.ExcludedActions

            if ($null -eq $AzureRolePermissionClassification) {
                $AzureRolePermissionClassification = [PSCustomObject]@{
                    "Service"              = "Unclassified"
                    "EAMTierLevelName"     = "Unclassified"
                    "EAMTierLevelTagValue" = "Unclassified"
                }
            }

            $ClassifiedAzureRolePermission = (
                [PSCustomObject]@{
                    "AuthorizedResourceAction" = $RolePermission
                    "ActionType"               = $RolePermissionEntry.ActionType
                    "Category"                 = $AzureRolePermissionClassification.Service
                    "EAMTierLevelName"         = $AzureRolePermissionClassification.EAMTierLevelName
                    "EAMTierLevelTagValue"     = $AzureRolePermissionClassification.EAMTierLevelTagValue
                }
            )
            $ClassifiedAzureRolePermissions.Add($ClassifiedAzureRolePermission) | Out-Null
        }
        $ClassifiedAzureRolePermissions = $ClassifiedAzureRolePermissions | Sort-Object EAMTierLevelTagValue, Category, AuthorizedResourceAction

        if ($SingleClassification -eq $True) {
            $RoleDefinitionClassification = ($ClassifiedAzureRolePermissions | Select-Object -ExcludeProperty AuthorizedResourceAction, ActionType, Category -Unique | Sort-Object EAMTierLevelTagValue | Select-Object -First 1)
        } else {
            $FilteredRoleClassifications = ($ClassifiedAzureRolePermissions | Select-Object -ExcludeProperty AuthorizedResourceAction, ActionType -Unique | Sort-Object EAMTierLevelTagValue )
            $RoleDefinitionClassification = [System.Collections.Generic.List[object]]::new()
            $RoleDefinitionClassification.Add($FilteredRoleClassifications)
        }

        # Mark roles with privilege escalation potential as privileged. Besides direct RBAC write access on
        # Microsoft.Authorization (role/deny assignments, elevateAccess, and Azure Policy assignments/exemptions
        # whose DeployIfNotExists/Modify effects run with a managed identity), this also covers indirect escalation
        # paths (control plane AND data plane): abusing managed identities, running code on / logging in to compute
        # that may carry a managed identity, deploying role assignments via blueprint assignments, taking over AKS
        # clusters (cluster credentials, Kubernetes RBAC data actions, or cluster reconfiguration), delegating access
        # to an external tenant via Azure Lighthouse, executing SYSTEM-context code through Azure Policy Guest
        # Configuration, and abusing Azure Automation (runbooks, DSC node configurations, and hybrid runbook workers).
        $PrivilegeEscalationActionPatterns = @(
            '^\*$'
            '^Microsoft\.Authorization/.*(\*|write|delete)$'
            '^Microsoft\.Authorization/elevateAccess/action$'
            '^Microsoft\.ManagedServices/registrationAssignments/(\*|write)$'
            '^Microsoft\.Blueprint/blueprintAssignments/(\*|write|delete)$'
            '^Microsoft\.ManagedIdentity/userAssignedIdentities/.*(write|assign/action|federatedIdentityCredentials/write)$'
            '^Microsoft\.Compute/virtualMachines/(\*|runCommand/action|extensions/write|login/action|loginAsAdmin/action)$'
            '^Microsoft\.Compute/virtualMachineScaleSets/.*(runCommand/action|extensions/write|\*)$'
            '^Microsoft\.HybridCompute/machines/(login/action|loginAsAdmin/action|runCommand/.*)$'
            '^Microsoft\.GuestConfiguration/guestConfigurationAssignments/(\*|write)$'
            '^Microsoft\.ContainerService/managedClusters/(\*|.*Credential/action|.*\*)$'
            '^Microsoft\.ContainerService/fleets/(\*|listCredentials?/action|.*\*)$'
            '^Microsoft\.App/containerApps/(exec|debug)/action$'
            '^Microsoft\.Web/sites/(\*|write)$'
            '^Microsoft\.Logic/(\*|workflows/(\*|write))$'
            '^Microsoft\.Automation/automationAccounts/(\*|runbooks/.*write|jobs/write|nodeConfigurations/write|compilationjobs/write|hybridRunbookWorkerGroups/.*)$'
        )
        # Evaluate control plane Actions (honoring NotActions) and data plane DataActions (honoring NotDataActions)
        $PrivilegeEscalationCandidates = @()
        $PrivilegeEscalationCandidates += $RoleActions | Where-Object { -not (Test-EntraOpsAzureActionExcluded -ClassifiedAction $_ -ExcludedActions $RoleNotActions) }
        $PrivilegeEscalationCandidates += $RoleDataActions | Where-Object { -not (Test-EntraOpsAzureActionExcluded -ClassifiedAction $_ -ExcludedActions $RoleNotDataActions) }
        $isPrivileged = [bool]($PrivilegeEscalationCandidates | Where-Object {
                $Action = $_
                @($PrivilegeEscalationActionPatterns | Where-Object { $Action -imatch $_ }).Count -gt 0
            })

        [PSCustomObject]@{
            "RoleId"          = $_.Id
            "RoleName"        = $_.Name
            "IsCustom"        = $_.IsCustom
            "isPrivileged"    = $isPrivileged
            "RichDescription" = $_.Description
            "RolePermissions" = @($ClassifiedAzureRolePermissions)
            "Classification"  = $RoleDefinitionClassification
        }
    }

    $AzureRoles = $AzureRoles | Sort-Object RoleName
    $AzureRoles | ConvertTo-Json -Depth 10 | Out-File $Exportfile -Force
}
