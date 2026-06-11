function Export-EntraOpsClassificationApiPermissions {
    <#
    .SYNOPSIS
        Builds a unified API-permission classification file aligned to the OAuthAppInfo table schema.

    .DESCRIPTION
        Merges Classification/Classification_AppRoles.json (application permissions) and
        Classification/Classification_Scopes.json (delegated permissions) into a single flat
        lookup file: Classification/Classification_ApiPermissions.json.

        The output schema is intentionally aligned to the Microsoft Defender XDR
        OAuthAppInfo table so that KQL queries can enrich OAuth app permission data with
        EntraOps tier-level and category classifications using a straightforward lookup join:

            let ApiPermissions = externaldata(
                PermissionId: string,
                PermissionValue: string,
                PermissionType: string,
                TargetAppDisplayName: string,
                TargetAppId: string,
                Category: string,
                EAMTierLevelName: string,
                EAMTierLevelTagValue: string
            ) [@"https://raw.githubusercontent.com/Cloud-Architekt/AzurePrivilegedIAM/main/Classification/Classification_ApiPermissions.json"] with (format="multijson");

            OAuthAppInfo
            | join kind=leftouter (
                ApiPermissions
            ) on PermissionValue, PermissionType, TargetAppId

    .PARAMETER ResolveDisplayNames
        When specified, queries Microsoft Graph to resolve service principal display names for
        every unique AppId found in the source classification files.  Requires an active
        Microsoft Graph connection (Connect-MgGraph).  When omitted a static built-in display
        name map is used so the script can run without a live Graph connection.

    .EXAMPLE
        Export-EntraOpsClassificationApiPermissions

    .EXAMPLE
        Export-EntraOpsClassificationApiPermissions -ResolveDisplayNames

    .NOTES
        Designed as an external lookup for KQL queries using the OAuthAppInfo table in
        Microsoft Sentinel / Defender XDR Advanced Hunting.
        Source files must exist before running this script:
          - Classification/Classification_AppRoles.json  (produced by Export-EntraOpsClassificationAppRoles)
          - Classification/Classification_Scopes.json    (produced by Export-EntraOpsClassificationScopes)
    #>

    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $false)]
        [switch] $ResolveDisplayNames
    )

    # ── Static display-name fallback map (avoids Graph call when -ResolveDisplayNames is omitted) ──
    $StaticDisplayNameMap = @{
        "00000003-0000-0000-c000-000000000000" = "Microsoft Graph"
        "00000002-0000-0000-c000-000000000000" = "Windows Azure Active Directory"
        "fc780465-2017-40d4-a0c5-307022471b92" = "Microsoft Threat Protection"
        "c161e42e-d4df-4a3d-9b42-e7a3c31f59d4" = "Microsoft Intune"
        "797f4846-ba00-4fd7-ba43-dac1f8f63013" = "Azure Service Management"
        "00000012-0000-0000-c000-000000000000" = "Azure Rights Management Services"
        "73c2949e-da2d-457a-9607-fcc665198967" = "Microsoft Purview"
        "c5393580-f805-4401-95e8-94b7a6ef2fc2" = "Office 365 Management APIs"
        "499b84ac-1321-427f-aa17-267ca6975798" = "Azure DevOps"
        "688413c8-5319-43e1-9a0e-42f49da53686" = "Verified ID STS Controller"
        "58c746b0-a0b0-4647-a8f6-12dde5981638" = "Azure AD Identity Governance Insights"
        "7b7531ad-5926-4f2d-8a1d-38495ad33e17" = "Azure Advanced Threat Protection"
        "93625bc8-bfe2-437a-97e0-3d0060024faa" = "Microsoft password reset service"
        "6bf85cfa-ac8a-4be5-b5de-425a0d0dc016" = "Microsoft Entra AD Synchronization Service"
        "00000002-0000-0ff1-ce00-000000000000" = "Exchange Online"
        "00000003-0000-0ff1-ce00-000000000000" = "SharePoint Online"
        "cc15fd57-2c6c-4117-a88c-83b1d56b4bbe" = "Microsoft Teams"
        "00000009-0000-0000-c000-000000000000" = "Power BI Service"
        "00000007-0000-0000-c000-000000000000" = "Dynamics CRM"
        "ca7f3f0b-7d91-482c-8e09-c5d840d0eac5" = "Azure Log Analytics"
        "475226c6-020e-4fb2-8a90-7a972cbfc1d4" = "Power Platform / Power Apps Admin"
        "0af06dc6-e4b5-4f28-818e-e78e62d137a5" = "Windows 365"
        "b46c3ac5-9da6-418f-a849-0a07a10b3c6c" = "Microsoft Entra Permissions Management"
        "00000005-0000-0ff1-ce00-000000000000" = "Yammer / Viva Engage"
    }

    # ── Load source classification files ─────────────────────────────────────────
    $AppRolesPath = ".\Classification\Classification_AppRoles.json"
    $ScopesPath   = ".\Classification\Classification_Scopes.json"

    if (-not (Test-Path $AppRolesPath)) {
        throw "Source file not found: $AppRolesPath.  Run Export-EntraOpsClassificationAppRoles first."
    }
    if (-not (Test-Path $ScopesPath)) {
        throw "Source file not found: $ScopesPath.  Run Export-EntraOpsClassificationScopes first."
    }

    $ClassificationAppRoles = Get-Content -Path $AppRolesPath -Raw | ConvertFrom-Json -Depth 10
    $ClassificationScopes   = Get-Content -Path $ScopesPath   -Raw | ConvertFrom-Json -Depth 10

    # ── Resolve TargetAppDisplayName ─────────────────────────────────────────────
    $DisplayNameMap = $StaticDisplayNameMap.Clone()

    if ($ResolveDisplayNames) {
        Write-Verbose "Resolving service principal display names via Microsoft Graph..."
        $UniqueAppIds = @(
            $ClassificationAppRoles | Select-Object -ExpandProperty AppId
            $ClassificationScopes   | Select-Object -ExpandProperty AppId
        ) | Sort-Object -Unique

        foreach ($AppId in $UniqueAppIds) {
            if ($DisplayNameMap.ContainsKey($AppId)) { continue }   # already known

            try {
                $Sp = (Invoke-MgGraphRequest `
                    -Uri "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=appId eq '$AppId'&`$select=appId,displayName" `
                    -OutputType PSObject).value | Select-Object -First 1

                if ($Sp) {
                    $DisplayNameMap[$AppId] = $Sp.displayName
                } else {
                    Write-Warning "No service principal found for AppId '$AppId'."
                    $DisplayNameMap[$AppId] = $AppId   # fall back to AppId itself
                }
            } catch {
                Write-Warning "Failed to resolve display name for AppId '$AppId': $_"
                $DisplayNameMap[$AppId] = $AppId
            }
        }
    }

    # Helper: resolve display name with graceful fallback
    function Resolve-DisplayName ([string]$AppId) {
        if ($DisplayNameMap.ContainsKey($AppId)) { return $DisplayNameMap[$AppId] }
        return $AppId   # return AppId when display name is unknown
    }

    # ── Map Application permissions (Classification_AppRoles.json) ───────────────
    $ApplicationEntries = foreach ($Entry in $ClassificationAppRoles) {
        [PSCustomObject]@{
            PermissionId         = $Entry.AppRoleId
            PermissionValue      = $Entry.AppRoleDisplayName
            PermissionType       = "Application"
            TargetAppDisplayName = Resolve-DisplayName -AppId $Entry.AppId
            TargetAppId          = $Entry.AppId
            Category             = $Entry.Category
            EAMTierLevelName     = $Entry.EAMTierLevelName
            EAMTierLevelTagValue = $Entry.EAMTierLevelTagValue
        }
    }

    # ── Map Delegated permissions (Classification_Scopes.json) ───────────────────
    $DelegatedEntries = foreach ($Entry in $ClassificationScopes) {
        [PSCustomObject]@{
            PermissionId         = $Entry.ScopeId
            PermissionValue      = $Entry.ScopeDisplayName
            PermissionType       = "Delegated"
            TargetAppDisplayName = Resolve-DisplayName -AppId $Entry.AppId
            TargetAppId          = $Entry.AppId
            Category             = $Entry.Category
            EAMTierLevelName     = $Entry.EAMTierLevelName
            EAMTierLevelTagValue = $Entry.EAMTierLevelTagValue
        }
    }

    # ── Merge and deduplicate ────────────────────────────────────────────────────
    # A permission with the same value, type and target app is considered identical.
    $MergedOutput = @($ApplicationEntries) + @($DelegatedEntries) |
        Group-Object -Property PermissionId, PermissionValue, PermissionType, TargetAppId |
        ForEach-Object {
            if ($_.Count -gt 1) {
                Write-Warning "Duplicate entry for PermissionValue='$($_.Group[0].PermissionValue)', PermissionType='$($_.Group[0].PermissionType)', TargetAppId='$($_.Group[0].TargetAppId)' — keeping first occurrence."
            }
            $_.Group | Select-Object -First 1
        }

    # ── Sort final output ────────────────────────────────────────────────────────
    $MergedOutput = $MergedOutput | Sort-Object TargetAppDisplayName, PermissionValue, PermissionType

    # ── Write output ─────────────────────────────────────────────────────────────
    $OutputPath = ".\Classification\Classification_ApiPermissions.json"
    $MergedOutput | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputPath -Encoding utf8 -Force

    Write-Host "[$($ApplicationEntries.Count) application + $($DelegatedEntries.Count) delegated = $($MergedOutput.Count) total entries] written to $OutputPath"
}
