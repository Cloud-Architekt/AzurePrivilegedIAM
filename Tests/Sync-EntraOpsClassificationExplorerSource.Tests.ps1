#Requires -Version 7.0

BeforeAll {
    $script:RepoRoot = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:RepoRoot 'Modules/EntraOps.Classification/EntraOps.Classification.psd1') -Force
}

Describe 'Sync-EntraOpsClassificationExplorerSource' {
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
        } finally {
            if (Test-Path -LiteralPath $tempRoot) {
                Remove-Item -LiteralPath $tempRoot -Recurse -Force
            }
        }
    }
}
