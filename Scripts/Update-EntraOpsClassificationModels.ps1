function Update-EntraOpsClassificationModels {

    <#
    .SYNOPSIS
        Update all EntraOps classification models and the Classification Explorer in one orchestrated run.

    .DESCRIPTION
        Runs every classification export in dependency order while parallelizing the independent work:

          * Lane "ApiPermissions" (sequential):
                Export-EntraOpsClassificationAppRoles -> Export-EntraOpsClassificationScopes -> Export-EntraOpsClassificationApiPermissions
          * Lane "EntraIdRoles" (sequential):
                Export-EntraOpsClassificationDirectoryRoles -> Export-EntraOpsClassificationDirectoryRolesFromMsftDocs -> Get-EntraOpsClassificationDirectoryRolesMissmatchFromMsftDocs
          * Lane "IdentityGovernance":   Export-EntraOpsClassificationIdentityGovernanceRoles
          * Lane "DeviceManagement":     Export-EntraOpsClassificationDeviceManagementRoles
          * Lane "AzureRoles":           Export-EntraOpsClassificationAzureRoles

        All five lanes run in parallel (Start-ThreadJob); the two multi-step lanes keep their internal order.
        After every lane has finished, Update-ClassificationData regenerates the Classification Explorer bundle.

        A live progress bar and streamed per-lane output are shown during processing. At the end a clean summary is
        printed (and returned) that lists every unclassified action/permission per source and the Microsoft Docs
        mismatch, formatted so the lists can be copied straight into a classification JSON file or into an AI prompt.

    .PARAMETER RepoRoot
        Repository root containing the 'Scripts', 'Classification', 'EntraOps_Classification' and 'ClassificationExplorer'
        folders. Defaults to the parent of this script's folder, or the current location when run interactively.

    .PARAMETER IncludeCustomRoles
        Include custom role definitions for the role-based exports (Directory, Identity Governance, Device Management, Azure).

    .PARAMETER Tier0IncludedResourceScope
        Azure scopes treated as Control Plane (Tier 0). Passed to Export-EntraOpsClassificationAzureRoles.

    .PARAMETER Tier1IncludedResourceScope
        Azure scopes treated as Management Plane (Tier 1). Passed to Export-EntraOpsClassificationAzureRoles.

    .PARAMETER AzureClassificationFile
        Classification definition file used for Azure roles. Default "./EntraOps_Classification/Classification_Azure.json".

    .PARAMETER AzureRoleDefinitionScope
        Optional scope passed to Get-AzRoleDefinition (e.g. "/" for tenant-scoped built-in roles).

    .PARAMETER ResolveApiPermissionDisplayNames
        Resolve service principal display names from Microsoft Graph in the API permissions export.

    .PARAMETER SkipClassificationExplorerUpdate
        Do not run Update-ClassificationData at the end.

    .PARAMETER Sequential
        Run the lanes one after another instead of in parallel (useful for troubleshooting).

    .EXAMPLE
        Update-EntraOpsClassificationModels

    .EXAMPLE
        Update-EntraOpsClassificationModels -IncludeCustomRoles $true -Tier0IncludedResourceScope "/providers/Microsoft.Management/managementGroups/Tier0"
    #>

    [cmdletbinding()]
    param
    (
        [Parameter(Mandatory = $false)]
        [string]$RepoRoot
        ,
        [Parameter(Mandatory = $false)]
        $IncludeCustomRoles = $False
        ,
        [Parameter(Mandatory = $false)]
        [string[]]$Tier0IncludedResourceScope = @()
        ,
        [Parameter(Mandatory = $false)]
        [string[]]$Tier1IncludedResourceScope = @()
        ,
        [Parameter(Mandatory = $false)]
        [string]$AzureClassificationFile = "./EntraOps_Classification/Classification_Azure.json"
        ,
        [Parameter(Mandatory = $false)]
        $AzureRoleDefinitionScope = $null
        ,
        [Parameter(Mandatory = $false)]
        [switch]$ResolveApiPermissionDisplayNames
        ,
        [Parameter(Mandatory = $false)]
        [switch]$SkipClassificationExplorerUpdate
        ,
        [Parameter(Mandatory = $false)]
        [switch]$Sequential
    )

    #region Resolve paths
    if ([string]::IsNullOrEmpty($RepoRoot)) {
        if ($PSScriptRoot) {
            $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
        } else {
            $RepoRoot = (Get-Location).Path
        }
    }
    $RepoRoot = (Resolve-Path $RepoRoot).Path
    $ScriptsPath = Join-Path $RepoRoot "Scripts"
    $ClassificationPath = Join-Path $RepoRoot "Classification"
    $ExplorerScript = Join-Path $RepoRoot "ClassificationExplorer/Update-ClassificationData.ps1"

    if (-not (Test-Path $ScriptsPath)) { throw "Scripts folder not found at '$ScriptsPath'. Provide -RepoRoot." }
    #endregion

    #region Pre-flight connection hints (do not fail, just warn)
    if (-not (Get-Command Get-MgContext -ErrorAction SilentlyContinue) -or $null -eq (Get-MgContext -ErrorAction SilentlyContinue)) {
        Write-Warning "No Microsoft Graph context detected. Run Connect-MgGraph before this command for the Graph based exports."
    }
    if (-not (Get-Command Get-AzContext -ErrorAction SilentlyContinue) -or $null -eq (Get-AzContext -ErrorAction SilentlyContinue)) {
        Write-Warning "No Azure context detected. Run Connect-AzAccount before this command for the Azure roles export."
    }
    #endregion

    $MismatchTempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("EntraOpsDirectoryRolesMismatch_{0}.json" -f ([guid]::NewGuid()))

    $Options = @{
        IncludeCustomRoles               = [bool]$IncludeCustomRoles
        Tier0IncludedResourceScope       = $Tier0IncludedResourceScope
        Tier1IncludedResourceScope       = $Tier1IncludedResourceScope
        AzureClassificationFile          = $AzureClassificationFile
        AzureRoleDefinitionScope         = $AzureRoleDefinitionScope
        ResolveApiPermissionDisplayNames = [bool]$ResolveApiPermissionDisplayNames
        MismatchTempFile                 = $MismatchTempFile
    }

    #region Lane definitions
    $LaneApiPermissions = {
        param($RepoRoot, $ScriptsPath, $Options)
        Set-Location $RepoRoot
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationAppRoles.ps1")
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationScopes.ps1")
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationApiPermissions.ps1")

        try { Write-Output "Step 1/3 Export-EntraOpsClassificationAppRoles"; Export-EntraOpsClassificationAppRoles } catch { Write-Warning "AppRoles failed: $($_.Exception.Message)" }
        try { Write-Output "Step 2/3 Export-EntraOpsClassificationScopes"; Export-EntraOpsClassificationScopes } catch { Write-Warning "Scopes failed: $($_.Exception.Message)" }
        try {
            Write-Output "Step 3/3 Export-EntraOpsClassificationApiPermissions"
            if ($Options.ResolveApiPermissionDisplayNames) { Export-EntraOpsClassificationApiPermissions -ResolveDisplayNames }
            else { Export-EntraOpsClassificationApiPermissions }
        } catch { Write-Warning "ApiPermissions failed: $($_.Exception.Message)" }
        Write-Output "Lane complete"
    }

    $LaneEntraIdRoles = {
        param($RepoRoot, $ScriptsPath, $Options)
        Set-Location $RepoRoot
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationDirectoryRoles.ps1")
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationDirectoryRolesFromMsftDocs.ps1")
        . (Join-Path $ScriptsPath "Get-EntraOpsClassificationDirectoryRolesMissmatchFromMsftDocs.ps1")

        try { Write-Output "Step 1/3 Export-EntraOpsClassificationDirectoryRoles"; Export-EntraOpsClassificationDirectoryRoles -IncludeCustomRoles $Options.IncludeCustomRoles } catch { Write-Warning "DirectoryRoles failed: $($_.Exception.Message)" }
        try { Write-Output "Step 2/3 Export-EntraOpsClassificationDirectoryRolesFromMsftDocs"; Export-EntraOpsClassificationDirectoryRolesFromMsftDocs } catch { Write-Warning "DirectoryRolesFromMsftDocs failed: $($_.Exception.Message)" }
        try {
            Write-Output "Step 3/3 Get-EntraOpsClassificationDirectoryRolesMissmatchFromMsftDocs"
            $mm = Get-EntraOpsClassificationDirectoryRolesMissmatchFromMsftDocs -ShowSummaryOnly $true
            $mm | ConvertTo-Json -Depth 8 | Out-File -FilePath $Options.MismatchTempFile -Force
        } catch { Write-Warning "Mismatch comparison failed: $($_.Exception.Message)" }
        Write-Output "Lane complete"
    }

    $LaneIdentityGovernance = {
        param($RepoRoot, $ScriptsPath, $Options)
        Set-Location $RepoRoot
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationIdentityGovernanceRoles.ps1")
        try { Write-Output "Export-EntraOpsClassificationIdentityGovernanceRoles"; Export-EntraOpsClassificationIdentityGovernanceRoles -IncludeCustomRoles $Options.IncludeCustomRoles } catch { Write-Warning "IdentityGovernanceRoles failed: $($_.Exception.Message)" }
        Write-Output "Lane complete"
    }

    $LaneDeviceManagement = {
        param($RepoRoot, $ScriptsPath, $Options)
        Set-Location $RepoRoot
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationDeviceManagementRoles.ps1")
        try { Write-Output "Export-EntraOpsClassificationDeviceManagementRoles"; Export-EntraOpsClassificationDeviceManagementRoles -IncludeCustomRoles $Options.IncludeCustomRoles } catch { Write-Warning "DeviceManagementRoles failed: $($_.Exception.Message)" }
        Write-Output "Lane complete"
    }

    $LaneAzureRoles = {
        param($RepoRoot, $ScriptsPath, $Options)
        Set-Location $RepoRoot
        . (Join-Path $ScriptsPath "Export-EntraOpsClassificationAzureRoles.ps1")
        $azParams = @{ IncludeCustomRoles = $Options.IncludeCustomRoles }
        if ($Options.Tier0IncludedResourceScope.Count -gt 0) { $azParams.Tier0IncludedResourceScope = $Options.Tier0IncludedResourceScope }
        if ($Options.Tier1IncludedResourceScope.Count -gt 0) { $azParams.Tier1IncludedResourceScope = $Options.Tier1IncludedResourceScope }
        if ($Options.AzureClassificationFile) { $azParams.ClassificationFile = $Options.AzureClassificationFile }
        if ($Options.AzureRoleDefinitionScope) { $azParams.RoleDefinitionScope = $Options.AzureRoleDefinitionScope }
        try { Write-Output "Export-EntraOpsClassificationAzureRoles"; Export-EntraOpsClassificationAzureRoles @azParams } catch { Write-Warning "AzureRoles failed: $($_.Exception.Message)" }
        Write-Output "Lane complete"
    }

    $Lanes = @(
        [PSCustomObject]@{ Name = "ApiPermissions"; Script = $LaneApiPermissions }
        [PSCustomObject]@{ Name = "EntraIdRoles"; Script = $LaneEntraIdRoles }
        [PSCustomObject]@{ Name = "IdentityGovernance"; Script = $LaneIdentityGovernance }
        [PSCustomObject]@{ Name = "DeviceManagement"; Script = $LaneDeviceManagement }
        [PSCustomObject]@{ Name = "AzureRoles"; Script = $LaneAzureRoles }
    )
    #endregion

    $StartTime = Get-Date
    Write-Host ""
    Write-Host "=== Updating EntraOps classification models ===" -ForegroundColor Cyan
    Write-Host ("Repository root : {0}" -f $RepoRoot) -ForegroundColor DarkCyan
    Write-Host ("Execution mode  : {0}" -f $(if ($Sequential) { "Sequential" } else { "Parallel (Start-ThreadJob)" })) -ForegroundColor DarkCyan
    Write-Host ("Include custom  : {0}" -f $Options.IncludeCustomRoles) -ForegroundColor DarkCyan
    Write-Host ""

    #region Run lanes
    $UseParallel = (-not $Sequential) -and (Get-Command Start-ThreadJob -ErrorAction SilentlyContinue)
    if ((-not $Sequential) -and (-not $UseParallel)) {
        Write-Warning "Start-ThreadJob not available, falling back to sequential execution."
    }

    if ($UseParallel) {
        $Jobs = foreach ($Lane in $Lanes) {
            Start-ThreadJob -Name $Lane.Name -ScriptBlock $Lane.Script -ArgumentList $RepoRoot, $ScriptsPath, $Options
        }

        $TotalLanes = $Jobs.Count
        do {
            Start-Sleep -Milliseconds 750
            foreach ($Job in $Jobs) {
                $NewOutput = Receive-Job -Job $Job
                foreach ($Line in $NewOutput) {
                    Write-Host ("[{0,-18}] {1}" -f $Job.Name, $Line) -ForegroundColor DarkGray
                }
            }
            $Completed = @($Jobs | Where-Object { $_.State -in 'Completed', 'Failed', 'Stopped' }).Count
            $Running = (@($Jobs | Where-Object { $_.State -eq 'Running' }) | ForEach-Object { $_.Name }) -join ", "
            Write-Progress -Activity "Updating EntraOps classification models" -Status "$Completed of $TotalLanes lanes complete | running: $Running" -PercentComplete (($Completed / $TotalLanes) * 100)
        } while (@($Jobs | Where-Object { $_.State -eq 'Running' }).Count -gt 0)

        # Drain remaining output and report failures
        foreach ($Job in $Jobs) {
            $NewOutput = Receive-Job -Job $Job
            foreach ($Line in $NewOutput) {
                Write-Host ("[{0,-18}] {1}" -f $Job.Name, $Line) -ForegroundColor DarkGray
            }
            if ($Job.State -eq 'Failed') {
                Write-Warning ("Lane '{0}' failed: {1}" -f $Job.Name, $Job.ChildJobs[0].JobStateInfo.Reason.Message)
            }
        }
        $Jobs | Remove-Job -Force
        Write-Progress -Activity "Updating EntraOps classification models" -Completed
    } else {
        $TotalLanes = $Lanes.Count
        $Index = 0
        foreach ($Lane in $Lanes) {
            $Index++
            Write-Progress -Activity "Updating EntraOps classification models (sequential)" -Status "Lane $Index of $TotalLanes : $($Lane.Name)" -PercentComplete ((($Index - 1) / $TotalLanes) * 100)
            Write-Host ("--- Lane: {0} ---" -f $Lane.Name) -ForegroundColor Cyan
            & $Lane.Script $RepoRoot $ScriptsPath $Options | ForEach-Object { Write-Host ("[{0,-18}] {1}" -f $Lane.Name, $_) -ForegroundColor DarkGray }
        }
        Write-Progress -Activity "Updating EntraOps classification models (sequential)" -Completed
    }
    #endregion

    #region Update Classification Explorer
    if (-not $SkipClassificationExplorerUpdate) {
        if (Test-Path $ExplorerScript) {
            Write-Host ""
            Write-Host "=== Updating Classification Explorer (Update-ClassificationData) ===" -ForegroundColor Cyan
            Write-Progress -Activity "Updating EntraOps classification models" -Status "Refreshing Classification Explorer bundle" -PercentComplete 95
            try { & $ExplorerScript -RepoRoot $RepoRoot } catch { Write-Warning "Update-ClassificationData failed: $($_.Exception.Message)" }
            Write-Progress -Activity "Updating EntraOps classification models" -Completed
        } else {
            Write-Warning "Classification Explorer update script not found at '$ExplorerScript'."
        }
    }
    #endregion

    #region Build summary
    function Get-EntraOpsUnclassifiedFromFile {
        param([string]$Path)
        $items = New-Object System.Collections.Generic.List[string]
        if (-not (Test-Path $Path)) { return $items }
        try { $data = Get-Content -Path $Path -Raw | ConvertFrom-Json -Depth 20 } catch { return $items }
        foreach ($item in $data) {
            $props = $item.PSObject.Properties.Name
            if ($props -contains 'RolePermissions') {
                foreach ($perm in $item.RolePermissions) {
                    $permProps = $perm.PSObject.Properties.Name
                    if (($permProps -contains 'EAMTierLevelName') -and $perm.EAMTierLevelName -eq 'Unclassified' -and ($permProps -contains 'AuthorizedResourceAction') -and $perm.AuthorizedResourceAction) {
                        $items.Add([string]$perm.AuthorizedResourceAction) | Out-Null
                    }
                }
            } elseif (($props -contains 'EAMTierLevelName') -and $item.EAMTierLevelName -eq 'Unclassified') {
                $id = $null
                foreach ($candidate in 'AuthorizedResourceAction', 'PermissionValue', 'AppRoleDisplayName', 'ScopeDisplayName') {
                    if (($props -contains $candidate) -and $item.$candidate) { $id = [string]$item.$candidate; break }
                }
                if ($id) { $items.Add($id) | Out-Null }
            }
        }
        return ($items | Sort-Object -Unique)
    }

    $SummarySources = [ordered]@{
        "Classification_AppRoles.json"                          = (Join-Path $ClassificationPath "Classification_AppRoles.json")
        "Classification_Scopes.json"                            = (Join-Path $ClassificationPath "Classification_Scopes.json")
        "Classification_ApiPermissions.json"                    = (Join-Path $ClassificationPath "Classification_ApiPermissions.json")
        "Classification_EntraIdDirectoryRoles.json"             = (Join-Path $ClassificationPath "Classification_EntraIdDirectoryRoles.json")
        "Classification_EntraIdDirectoryRolesFromMsftDocs.json" = (Join-Path $ClassificationPath "Classification_EntraIdDirectoryRolesFromMsftDocs.json")
        "Classification_IdentityGovernance.json"                = (Join-Path $ClassificationPath "Classification_IdentityGovernance.json")
        "Classification_DeviceManagementRoles.json"             = (Join-Path $ClassificationPath "Classification_DeviceManagementRoles.json")
        "Classification_AzureResources.json"                    = (Join-Path $ClassificationPath "Classification_AzureResources.json")
    }

    $UnclassifiedBySource = [ordered]@{}
    foreach ($Source in $SummarySources.Keys) {
        $UnclassifiedBySource[$Source] = @(Get-EntraOpsUnclassifiedFromFile -Path $SummarySources[$Source])
    }

    # Microsoft Docs mismatch
    $Mismatch = $null
    if (Test-Path $MismatchTempFile) {
        try { $Mismatch = Get-Content -Path $MismatchTempFile -Raw | ConvertFrom-Json -Depth 10 } catch { $Mismatch = $null }
        Remove-Item -Path $MismatchTempFile -Force -ErrorAction SilentlyContinue
    }

    $OnlyInDocs = @()
    $OnlyInGraph = @()
    $DocsUnclassified = @()
    if ($Mismatch) {
        $OnlyInDocs = @($Mismatch.ActionDifferences | Where-Object { $_.Difference -eq 'OnlyInDocs' } | Select-Object -ExpandProperty Action -Unique | Sort-Object)
        $OnlyInGraph = @($Mismatch.ActionDifferences | Where-Object { $_.Difference -eq 'OnlyInGraph' } | Select-Object -ExpandProperty Action -Unique | Sort-Object)
        $DocsUnclassified = @($Mismatch.UnclassifiedActions | Select-Object -ExpandProperty Action -Unique | Sort-Object)
    }
    #endregion

    #region Print summary
    $Duration = (Get-Date) - $StartTime
    Write-Host ""
    Write-Host "================ CLASSIFICATION UPDATE SUMMARY ================" -ForegroundColor Cyan
    Write-Host ("Completed in {0:hh\:mm\:ss}" -f $Duration) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Unclassified items per source:" -ForegroundColor Yellow
    foreach ($Source in $UnclassifiedBySource.Keys) {
        $count = $UnclassifiedBySource[$Source].Count
        $color = if ($count -gt 0) { "Yellow" } else { "Green" }
        Write-Host ("  {0,-52} {1}" -f $Source, $count) -ForegroundColor $color
    }
    Write-Host ""
    Write-Host "Microsoft Docs comparison (Entra ID directory roles):" -ForegroundColor Yellow
    Write-Host ("  Actions only in Graph export : {0}" -f $OnlyInGraph.Count) -ForegroundColor Yellow
    Write-Host ("  Actions only in Docs export  : {0}" -f $OnlyInDocs.Count) -ForegroundColor Magenta
    Write-Host ("  Unclassified (Graph+Docs)    : {0}" -f $DocsUnclassified.Count) -ForegroundColor Red

    # Copy-friendly blocks (plain text, no markdown, safe to paste into JSON or an AI prompt)
    Write-Host ""
    Write-Host "----- COPY/PASTE: UNCLASSIFIED ACTIONS PER SOURCE -----" -ForegroundColor Green
    foreach ($Source in $UnclassifiedBySource.Keys) {
        $list = $UnclassifiedBySource[$Source]
        if ($list.Count -gt 0) {
            Write-Host ""
            Write-Host ("# {0} ({1} unclassified)" -f $Source, $list.Count) -ForegroundColor Green
            $list | ForEach-Object { Write-Host $_ }
        }
    }

    if ($DocsUnclassified.Count -gt 0) {
        Write-Host ""
        Write-Host "----- COPY/PASTE: UNCLASSIFIED DIRECTORY ROLE ACTIONS (Graph + Docs) -----" -ForegroundColor Green
        $DocsUnclassified | ForEach-Object { Write-Host $_ }
    }

    if ($OnlyInDocs.Count -gt 0) {
        Write-Host ""
        Write-Host "----- COPY/PASTE: ACTIONS PRESENT ONLY IN MICROSOFT DOCS (missing from Graph export) -----" -ForegroundColor Green
        $OnlyInDocs | ForEach-Object { Write-Host $_ }
    }
    Write-Host ""
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host ""
    #endregion

    # Return a structured object for further processing / AI prompting
    return [PSCustomObject]@{
        RepoRoot              = $RepoRoot
        DurationSeconds       = [math]::Round($Duration.TotalSeconds, 1)
        UnclassifiedBySource  = $UnclassifiedBySource
        TotalUnclassified     = (($UnclassifiedBySource.Values | ForEach-Object { $_.Count }) | Measure-Object -Sum).Sum
        DocsOnlyActions       = $OnlyInDocs
        GraphOnlyActions      = $OnlyInGraph
        DirectoryUnclassified = $DocsUnclassified
        ActionDifferenceCount = if ($Mismatch) { @($Mismatch.ActionDifferences).Count } else { 0 }
    }
}
