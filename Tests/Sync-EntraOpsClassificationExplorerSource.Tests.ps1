#Requires -Version 7.0

BeforeAll {
    $script:RepoRoot = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:RepoRoot 'Modules/EntraOps.Classification/EntraOps.Classification.psd1') -Force
}

Describe 'Sync-EntraOpsClassificationExplorerSource' {
    BeforeEach {
        $caseRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        $script:SafetySource = Join-Path $caseRoot 'Source'
        $script:SafetyTarget = Join-Path $caseRoot 'Target'
        New-Item -ItemType Directory -Force -Path "$script:SafetySource/ClassificationExplorer", "$script:SafetySource/EntraOps_Classification", "$script:SafetySource/Modules/EntraOps.Classification/Public", "$script:SafetyTarget/Reports/ClassificationExplorer" | Out-Null
        Set-Content -LiteralPath "$script:SafetySource/ClassificationExplorer/index.html" -Value 'source'
        Set-Content -LiteralPath "$script:SafetySource/Modules/EntraOps.Classification/Public/Update-EntraOpsClassificationExplorerData.ps1" -Value '# generator'
        Set-Content -LiteralPath "$script:SafetyTarget/Reports/ClassificationExplorer/index.html" -Value 'target'
        Set-Content -LiteralPath "$script:SafetyTarget/Reports/ClassificationExplorer/entraops-feature.spec.mjs" -Value '// preserve'
    }

    It 'stops before copying if EntraOps has a target-only regression test' {
        { Sync-EntraOpsClassificationExplorerSource -RepoRoot $script:SafetySource -EntraOpsRoot $script:SafetyTarget } | Should -Throw '*entraops-feature.spec.mjs*No files were synced*'
        (Get-Content "$script:SafetyTarget/Reports/ClassificationExplorer/index.html" -Raw).Trim() | Should -Be 'target'
        Test-Path "$script:SafetyTarget/Reports/ClassificationExplorer/entraops-feature.spec.mjs" | Should -BeTrue
    }

    It 'removes stale app files only when explicitly requested' {
        Sync-EntraOpsClassificationExplorerSource -RepoRoot $script:SafetySource -EntraOpsRoot $script:SafetyTarget -RemoveStaleAppFiles
        Test-Path "$script:SafetyTarget/Reports/ClassificationExplorer/entraops-feature.spec.mjs" | Should -BeFalse
        (Get-Content "$script:SafetyTarget/Reports/ClassificationExplorer/index.html" -Raw).Trim() | Should -Be 'source'
    }

    It 'leaves all files untouched with WhatIf even when stale removal is requested' {
        Sync-EntraOpsClassificationExplorerSource -RepoRoot $script:SafetySource -EntraOpsRoot $script:SafetyTarget -RemoveStaleAppFiles -WhatIf
        (Get-Content "$script:SafetyTarget/Reports/ClassificationExplorer/index.html" -Raw).Trim() | Should -Be 'target'
        Test-Path "$script:SafetyTarget/Reports/ClassificationExplorer/entraops-feature.spec.mjs" | Should -BeTrue
        Test-Path "$script:SafetyTarget/EntraOps/Public/Reportings/Update-EntraOpsClassificationExplorerData.ps1" | Should -BeFalse
    }

    It 'mirrors classification templates and preserves tenant-specific classification folders' {
        $tempRoot = Join-Path ([IO.Path]::GetTempPath()) "entraops-sync-$([guid]::NewGuid())"
        $sourceRoot = Join-Path $tempRoot 'AzurePrivilegedIAM'
        $entraOpsRoot = Join-Path $tempRoot 'EntraOps'

        try {
            $sourceApp = Join-Path $sourceRoot 'ClassificationExplorer'
            $sourceTemplates = Join-Path $sourceRoot 'EntraOps_Classification'
            $sourceGeneratorDir = Join-Path $sourceRoot 'Modules/EntraOps.Classification/Public'
            $targetApp = Join-Path $entraOpsRoot 'Reports/ClassificationExplorer'
            $targetTemplates = Join-Path $entraOpsRoot 'Classification/Templates'
            $tenantClassification = Join-Path $entraOpsRoot 'Classification/Contoso'

            New-Item -ItemType Directory -Path (Join-Path $sourceApp 'js') -Force | Out-Null
            New-Item -ItemType Directory -Path (Join-Path $sourceTemplates 'nested') -Force | Out-Null
            New-Item -ItemType Directory -Path $sourceGeneratorDir -Force | Out-Null
            New-Item -ItemType Directory -Path (Join-Path $targetApp 'js') -Force | Out-Null
            New-Item -ItemType Directory -Path $targetTemplates -Force | Out-Null
            New-Item -ItemType Directory -Path $tenantClassification -Force | Out-Null

            Set-Content -LiteralPath (Join-Path $sourceApp 'index.html') -Value '<html></html>' -NoNewline
            Set-Content -LiteralPath (Join-Path $sourceApp 'js/mode.js') -Value 'standalone' -NoNewline
            Set-Content -LiteralPath (Join-Path $sourceApp 'README.md') -Value 'Invoke-Pester ./Tests/ClassificationExplorer.Tests.ps1 -CI -Output Detailed' -NoNewline
            Set-Content -LiteralPath (Join-Path $sourceTemplates 'Classification_ApiPermissions.json') -Value '{"version":2}' -NoNewline
            Set-Content -LiteralPath (Join-Path $sourceTemplates 'nested/template.json') -Value '{"nested":true}' -NoNewline
            Set-Content -LiteralPath (Join-Path $sourceGeneratorDir 'Update-EntraOpsClassificationExplorerData.ps1') -Value '# generator' -NoNewline

            Set-Content -LiteralPath (Join-Path $targetApp 'js/mode.js') -Value 'entraops' -NoNewline
            Set-Content -LiteralPath (Join-Path $targetTemplates 'Classification_ApiPermissions.json') -Value '{"version":1}' -NoNewline
            Set-Content -LiteralPath (Join-Path $targetTemplates 'stale.json') -Value '{}' -NoNewline
            Set-Content -LiteralPath (Join-Path $tenantClassification 'custom.json') -Value '{"tenant":true}' -NoNewline

            Sync-EntraOpsClassificationExplorerSource -RepoRoot $sourceRoot -EntraOpsRoot $entraOpsRoot

            Get-Content -LiteralPath (Join-Path $targetTemplates 'Classification_ApiPermissions.json') -Raw |
                Should -Be '{"version":2}'
            Get-Content -LiteralPath (Join-Path $targetTemplates 'nested/template.json') -Raw |
                Should -Be '{"nested":true}'
            Test-Path -LiteralPath (Join-Path $targetTemplates 'stale.json') | Should -BeFalse
            Get-Content -LiteralPath (Join-Path $tenantClassification 'custom.json') -Raw |
                Should -Be '{"tenant":true}'
            Get-Content -LiteralPath (Join-Path $targetApp 'js/mode.js') -Raw | Should -Be 'entraops'
            (Get-Content -LiteralPath (Join-Path $targetApp 'README.md') -Raw).Trim() |
                Should -Be 'Invoke-Pester ./Tests/Reporting/New-EntraOpsClassificationExplorerData.Tests.ps1 -CI -Output Detailed'
        } finally {
            if (Test-Path -LiteralPath $tempRoot) {
                Remove-Item -LiteralPath $tempRoot -Recurse -Force
            }
        }
    }
}
