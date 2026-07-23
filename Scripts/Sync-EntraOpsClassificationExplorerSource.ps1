#Requires -Version 5.1
function Sync-EntraOpsClassificationExplorerSource {

    <#
    .SYNOPSIS
        Syncs the canonical Classification Explorer app source (and its generator script) from the
        AzurePrivilegedIAM repository into the EntraOps repository, so both deployments run from a
        single maintained copy of the code.

    .DESCRIPTION
        ClassificationExplorer app source (HTML/CSS/JS/content/assets) is edited once, in this
        repository (AzurePrivilegedIAM/ClassificationExplorer), and copied verbatim into
        <EntraOpsRoot>/Reports/ClassificationExplorer. The two deployments differ only by:

            * js/mode.js        - one small file per repo (window.EOCE_MODE = 'standalone' | 'entraops'),
                                   NEVER copied by this script.
            * data/, data-manifest.json - generated locally in each repo by
                                   Update-EntraOpsClassificationExplorerData (-Mode Standalone|EntraOps),
                                   NEVER copied by this script.

        The shared generator function's source file (Scripts/Update-EntraOpsClassificationExplorerData.ps1)
        is also copied into <EntraOpsRoot>/EntraOps/Public/Reportings/, so it is dot-sourced and exported
        directly as a public function of the EntraOps module (same as every Export-EntraOps* cmdlet here) -
        no separate wrapper/path-resolution step is needed.

        Run this after making any change to the app source (HTML/CSS/JS/content) or to the generator
        function, then run Update-EntraOpsClassificationExplorerData in each repository to regenerate the
        embedded data bundle for that deployment.

    .PARAMETER RepoRoot
        Path to the AzurePrivilegedIAM repository root (source of truth). Defaults to the parent of
        this script's folder.

    .PARAMETER EntraOpsRoot
        Path to the EntraOps repository root (sync target). Auto-detected as a sibling folder of
        -RepoRoot named 'entraops*' (case-insensitive) when omitted.

    .EXAMPLE
        . ./Scripts/Sync-EntraOpsClassificationExplorerSource.ps1
        Sync-EntraOpsClassificationExplorerSource -WhatIf

        Shows what would be copied without changing any files.

    .EXAMPLE
        . ./Scripts/Sync-EntraOpsClassificationExplorerSource.ps1
        Sync-EntraOpsClassificationExplorerSource -EntraOpsRoot ../EntraOps
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
        [string]$EntraOpsRoot
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = 'Stop'

    function Resolve-FullPath {
        param([string]$Path)
        return [System.IO.Path]::GetFullPath($Path)
    }

    $RepoRoot = Resolve-FullPath $RepoRoot
    $SourceAppRoot = Join-Path $RepoRoot 'ClassificationExplorer'
    $SourceGenerator = Join-Path $RepoRoot 'Scripts/Update-EntraOpsClassificationExplorerData.ps1'

    if (-not (Test-Path -LiteralPath $SourceAppRoot -PathType Container)) {
        throw "Source app folder not found: $SourceAppRoot"
    }
    if (-not (Test-Path -LiteralPath $SourceGenerator -PathType Leaf)) {
        throw "Source generator script not found: $SourceGenerator"
    }

    if ([string]::IsNullOrWhiteSpace($EntraOpsRoot)) {
        $CodingRoot = Split-Path -Parent $RepoRoot
        $Candidates = @()
        if ($CodingRoot -and (Test-Path -LiteralPath $CodingRoot -PathType Container)) {
            $Candidates = @(Get-ChildItem -LiteralPath $CodingRoot -Directory | Where-Object { $_.Name -match '(?i)entraops' } | ForEach-Object { $_.FullName })
        }
        $EntraOpsRoot = $Candidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'Reports/ClassificationExplorer') -PathType Container } | Select-Object -First 1
        if (-not $EntraOpsRoot) {
            throw "Could not auto-detect the EntraOps repository (looked for 'Reports/ClassificationExplorer' under: $($Candidates -join ', ')). Pass -EntraOpsRoot pointing at your EntraOps clone."
        }
        Write-Verbose "Auto-detected EntraOpsRoot: $EntraOpsRoot"
    }
    $EntraOpsRoot = Resolve-FullPath $EntraOpsRoot
    $TargetAppRoot = Join-Path $EntraOpsRoot 'Reports/ClassificationExplorer'
    $TargetGeneratorDir = Join-Path $EntraOpsRoot 'EntraOps/Public/Reportings'

    if (-not (Test-Path -LiteralPath $TargetAppRoot -PathType Container)) {
        throw "Target app folder not found: $TargetAppRoot. Pass -EntraOpsRoot pointing at your EntraOps clone."
    }

    # Files/folders never touched at the destination - deployment-specific, not part of the
    # shared app source.
    $ExcludeRelative = @(
        'js/mode.js',
        'data',
        'data-manifest.json'
    )

    function Test-Excluded {
        param([string]$RelativePath)
        $norm = $RelativePath -replace '\\', '/'
        foreach ($ex in $ExcludeRelative) {
            if ($norm -eq $ex -or $norm.StartsWith("$ex/")) { return $true }
        }
        return $false
    }

    $copied = New-Object System.Collections.Generic.List[string]
    $skipped = New-Object System.Collections.Generic.List[string]

    Get-ChildItem -LiteralPath $SourceAppRoot -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($SourceAppRoot.Length + 1) -replace '\\', '/'
        if ($rel -eq '.DS_Store' -or $rel.EndsWith('/.DS_Store')) { return }
        if (Test-Excluded $rel) {
            $skipped.Add($rel) | Out-Null
            return
        }
        $destPath = Join-Path $TargetAppRoot $rel
        $destDir = Split-Path -Parent $destPath
        if (-not (Test-Path -LiteralPath $destDir)) {
            if ($PSCmdlet.ShouldProcess($destDir, 'Create directory')) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
        }
        if ($PSCmdlet.ShouldProcess($destPath, 'Copy file')) {
            Copy-Item -LiteralPath $_.FullName -Destination $destPath -Force
        }
        $copied.Add($rel) | Out-Null
    }

    # Remove stale destination files that no longer exist in the source (keeps the two copies
    # byte-identical over time), except the always-excluded deployment-specific files.
    Get-ChildItem -LiteralPath $TargetAppRoot -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($TargetAppRoot.Length + 1) -replace '\\', '/'
        if ($rel -eq '.DS_Store' -or $rel.EndsWith('/.DS_Store')) { return }
        if (Test-Excluded $rel) { return }
        $srcPath = Join-Path $SourceAppRoot $rel
        if (-not (Test-Path -LiteralPath $srcPath -PathType Leaf)) {
            if ($PSCmdlet.ShouldProcess($_.FullName, 'Remove stale file (no longer in source)')) {
                Remove-Item -LiteralPath $_.FullName -Force
            }
        }
    }

    # --- Shared generator function ------------------------------------------------------------
    if (-not (Test-Path -LiteralPath $TargetGeneratorDir)) {
        if ($PSCmdlet.ShouldProcess($TargetGeneratorDir, 'Create directory')) {
            New-Item -ItemType Directory -Path $TargetGeneratorDir -Force | Out-Null
        }
    }
    $TargetGenerator = Join-Path $TargetGeneratorDir 'Update-EntraOpsClassificationExplorerData.ps1'
    if ($PSCmdlet.ShouldProcess($TargetGenerator, 'Copy generator function')) {
        Copy-Item -LiteralPath $SourceGenerator -Destination $TargetGenerator -Force
    }

    # Clean up the legacy standalone-script location from before this function was moved into
    # the EntraOps module's Public/Reportings folder.
    $LegacyTargetGenerator = Join-Path $EntraOpsRoot 'Scripts/Update-ClassificationExplorerData.ps1'
    if (Test-Path -LiteralPath $LegacyTargetGenerator -PathType Leaf) {
        if ($PSCmdlet.ShouldProcess($LegacyTargetGenerator, 'Remove legacy generator script')) {
            Remove-Item -LiteralPath $LegacyTargetGenerator -Force
        }
    }

    Write-Host "Classification Explorer source sync complete." -ForegroundColor Green
    Write-Host ("  Source        : {0}" -f $SourceAppRoot)
    Write-Host ("  Target        : {0}" -f $TargetAppRoot)
    Write-Host ("  Files synced  : {0}" -f $copied.Count)
    Write-Host ("  Files skipped : {0} ({1})" -f $skipped.Count, ($skipped -join ', '))
    Write-Host ("  Generator     : {0}" -f $TargetGenerator)
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Ensure <EntraOpsRoot>/Reports/ClassificationExplorer/js/mode.js exists and sets window.EOCE_MODE = 'entraops'."
    Write-Host "  2. Run Update-EntraOpsClassificationExplorerData -Mode EntraOps in the EntraOps repo (or via New-EntraOpsClassificationExplorerData) to refresh its embedded data bundle."
    Write-Host "  3. Run Update-EntraOpsClassificationExplorerData -Mode Standalone here to refresh this repo's embedded data bundle."
}
