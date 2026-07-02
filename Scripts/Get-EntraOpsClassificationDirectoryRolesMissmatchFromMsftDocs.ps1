function Get-EntraOpsClassificationDirectoryRolesMissmatchFromMsftDocs {

    <#
    .SYNOPSIS
        Compare the directory role classification built from Microsoft Graph with the one built from Microsoft Docs.

    .DESCRIPTION
        Compares Classification_EntraIdDirectoryRoles.json (built from Microsoft Graph by
        Export-EntraOpsClassificationDirectoryRoles.ps1) with Classification_EntraIdDirectoryRolesFromMsftDocs.json
        (built from the public Microsoft Docs reference by Export-EntraOpsClassificationDirectoryRolesFromMsftDocs.ps1).

        The script highlights two things:
          1. Role action differences per role (actions that exist in only one of the two sources).
          2. All unclassified role actions (EAMTierLevelName = "Unclassified") as a distinct output, so they can be
             reviewed and, if needed, added to the EntraOps classification model (Classification_AadResources.json).

    .PARAMETER GraphClassificationFilePath
        Path to the Graph based classification file. Default is "./Classification/Classification_EntraIdDirectoryRoles.json".

    .PARAMETER DocsClassificationFilePath
        Path to the Docs based classification file. Default is "./Classification/Classification_EntraIdDirectoryRolesFromMsftDocs.json".

    .PARAMETER ShowSummaryOnly
        Only return the objects without writing the colored console summary. Default is $False.

    .EXAMPLE
        Get-EntraOpsClassificationDirectoryRolesMissmatchFromMsftDocs

    .EXAMPLE
        $result = Get-EntraOpsClassificationDirectoryRolesMissmatchFromMsftDocs -ShowSummaryOnly $true
        $result.ActionDifferences | Format-Table
        $result.UnclassifiedActions | Format-Table
    #>

    [cmdletbinding()]
    param
    (
        [Parameter(Mandatory = $false)]
        [string]$GraphClassificationFilePath = "./Classification/Classification_EntraIdDirectoryRoles.json"
        ,
        [Parameter(Mandatory = $false)]
        [string]$DocsClassificationFilePath = "./Classification/Classification_EntraIdDirectoryRolesFromMsftDocs.json"
        ,
        [Parameter(Mandatory = $false)]
        $ShowSummaryOnly = $False
    )

    #region Load classification files
    foreach ($FilePath in @($GraphClassificationFilePath, $DocsClassificationFilePath)) {
        if (-not (Test-Path -Path $FilePath)) {
            throw "Classification file '$FilePath' not found."
        }
    }

    $GraphRoles = Get-Content -Path $GraphClassificationFilePath -Raw | ConvertFrom-Json -Depth 10
    $DocsRoles = Get-Content -Path $DocsClassificationFilePath -Raw | ConvertFrom-Json -Depth 10
    #endregion

    #region Index roles by RoleId for fast lookup
    $GraphRolesById = @{}
    foreach ($Role in $GraphRoles) { $GraphRolesById[$Role.RoleId] = $Role }
    $DocsRolesById = @{}
    foreach ($Role in $DocsRoles) { $DocsRolesById[$Role.RoleId] = $Role }
    #endregion

    $AllRoleIds = ($GraphRolesById.Keys + $DocsRolesById.Keys | Sort-Object -Unique)

    $ActionDifferences = New-Object System.Collections.Generic.List[object]

    foreach ($RoleId in $AllRoleIds) {

        $GraphRole = $GraphRolesById[$RoleId]
        $DocsRole = $DocsRolesById[$RoleId]
        $RoleName = if ($GraphRole) { $GraphRole.RoleName } else { $DocsRole.RoleName }

        # Role only present in one of the sources
        if ($null -eq $GraphRole) {
            $ActionDifferences.Add([PSCustomObject]@{
                    RoleId     = $RoleId
                    RoleName   = $RoleName
                    Action     = "*"
                    Difference = "RoleOnlyInDocs"
                }) | Out-Null
            continue
        }
        if ($null -eq $DocsRole) {
            $ActionDifferences.Add([PSCustomObject]@{
                    RoleId     = $RoleId
                    RoleName   = $RoleName
                    Action     = "*"
                    Difference = "RoleOnlyInGraph"
                }) | Out-Null
            continue
        }

        $GraphActions = @($GraphRole.RolePermissions.AuthorizedResourceAction | Sort-Object -Unique)
        $DocsActions = @($DocsRole.RolePermissions.AuthorizedResourceAction | Sort-Object -Unique)

        foreach ($Action in ($GraphActions | Where-Object { $_ -notin $DocsActions })) {
            $ActionDifferences.Add([PSCustomObject]@{
                    RoleId     = $RoleId
                    RoleName   = $RoleName
                    Action     = $Action
                    Difference = "OnlyInGraph"
                }) | Out-Null
        }
        foreach ($Action in ($DocsActions | Where-Object { $_ -notin $GraphActions })) {
            $ActionDifferences.Add([PSCustomObject]@{
                    RoleId     = $RoleId
                    RoleName   = $RoleName
                    Action     = $Action
                    Difference = "OnlyInDocs"
                }) | Out-Null
        }
    }

    #region Collect distinct unclassified actions across both sources
    $UnclassifiedLookup = @{}
    $SourceDefinitions = @(
        [PSCustomObject]@{ Source = "Graph"; Roles = $GraphRoles },
        [PSCustomObject]@{ Source = "Docs"; Roles = $DocsRoles }
    )

    foreach ($SourceDefinition in $SourceDefinitions) {
        foreach ($Role in $SourceDefinition.Roles) {
            foreach ($Permission in ($Role.RolePermissions | Where-Object { $_.EAMTierLevelName -eq "Unclassified" })) {
                $Action = $Permission.AuthorizedResourceAction
                if (-not $UnclassifiedLookup.ContainsKey($Action)) {
                    $UnclassifiedLookup[$Action] = [PSCustomObject]@{
                        Action  = $Action
                        Sources = New-Object System.Collections.Generic.List[string]
                        Roles   = New-Object System.Collections.Generic.List[string]
                    }
                }
                if (-not $UnclassifiedLookup[$Action].Sources.Contains($SourceDefinition.Source)) {
                    $UnclassifiedLookup[$Action].Sources.Add($SourceDefinition.Source) | Out-Null
                }
                if (-not $UnclassifiedLookup[$Action].Roles.Contains($Role.RoleName)) {
                    $UnclassifiedLookup[$Action].Roles.Add($Role.RoleName) | Out-Null
                }
            }
        }
    }

    $UnclassifiedActions = $UnclassifiedLookup.Values | ForEach-Object {
        [PSCustomObject]@{
            Action    = $_.Action
            Sources   = ($_.Sources | Sort-Object) -join ", "
            RoleCount = $_.Roles.Count
            Roles     = ($_.Roles | Sort-Object) -join ", "
        }
    } | Sort-Object Action
    #endregion

    #region Console summary
    if ($ShowSummaryOnly -ne $True) {
        Write-Host ""
        Write-Host "=== Role action differences (Graph vs. Docs) ===" -ForegroundColor Cyan
        if ($ActionDifferences.Count -eq 0) {
            Write-Host "No role action differences found." -ForegroundColor Green
        } else {
            $ActionDifferences | Sort-Object RoleName, Difference, Action | ForEach-Object {
                $Color = switch ($_.Difference) {
                    "OnlyInGraph" { "Yellow" }
                    "OnlyInDocs" { "Magenta" }
                    "RoleOnlyInGraph" { "DarkYellow" }
                    "RoleOnlyInDocs" { "DarkMagenta" }
                    default { "Gray" }
                }
                Write-Host ("[{0,-15}] {1} :: {2}" -f $_.Difference, $_.RoleName, $_.Action) -ForegroundColor $Color
            }
            Write-Host ""
            Write-Host ("Total differences: {0}" -f $ActionDifferences.Count) -ForegroundColor Cyan
        }

        Write-Host ""
        Write-Host "=== Unclassified actions to review for the classification model ===" -ForegroundColor Cyan
        if ($UnclassifiedActions.Count -eq 0) {
            Write-Host "No unclassified actions found." -ForegroundColor Green
        } else {
            $UnclassifiedActions | ForEach-Object {
                Write-Host ("[{0,-12}] {1}" -f $_.Sources, $_.Action) -ForegroundColor Red
            }
            Write-Host ""
            Write-Host ("Total distinct unclassified actions: {0}" -f $UnclassifiedActions.Count) -ForegroundColor Cyan
        }
        Write-Host ""
    }
    #endregion

    return [PSCustomObject]@{
        ActionDifferences   = $ActionDifferences
        UnclassifiedActions = $UnclassifiedActions
    }
}
