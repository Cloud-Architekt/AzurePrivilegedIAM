#Requires -Version 7.3
#Requires -Modules Pester

<#
Prerequisites:
  - Pester 5
  - Microsoft.Playwright for .NET plus its Chromium browser
  - Set PLAYWRIGHT_DOTNET_DLL when Microsoft.Playwright.dll is not in the
    standard per-user NuGet package cache.

Run:
    Invoke-Pester ./Tests/ClassificationExplorer.Tests.ps1 -Output Detailed
#>

BeforeAll {
    $script:RepoRoot = if ($env:EOCE_REPO_ROOT) {
        [IO.Path]::GetFullPath($env:EOCE_REPO_ROOT)
    } elseif (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'ClassificationExplorer') -PathType Container) {
        # Also supports keeping the test directly in the repository root.
        $PSScriptRoot
    } else {
        # Normal location: <repo>/Tests/ClassificationExplorer.Tests.ps1.
        Split-Path -Parent $PSScriptRoot
    }
    $script:AppRoot = Join-Path $script:RepoRoot 'ClassificationExplorer'
    $script:ModuleManifest = Join-Path $script:RepoRoot 'Modules/EntraOps.Classification/EntraOps.Classification.psd1'
    Import-Module $script:ModuleManifest -Force -ErrorAction Stop
    $script:Routes = @(
        'dashboard', 'model', 'overview', 'roles', 'actions', 'permissions',
        'attackpaths', 'scoped', 'overwrites', 'history'
    )

    function Complete-Task {
        param([Parameter(Mandatory)] $Task)
        $Task.GetAwaiter().GetResult()
    }

    function Find-PlaywrightAssembly {
        if ($env:PLAYWRIGHT_DOTNET_DLL) {
            return Get-Item -LiteralPath $env:PLAYWRIGHT_DOTNET_DLL -ErrorAction Stop
        }
        $packageRoot = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.nuget/packages/microsoft.playwright'
        $assembly = Get-ChildItem -LiteralPath $packageRoot -Filter Microsoft.Playwright.dll -File -Recurse -ErrorAction SilentlyContinue |
        Sort-Object { [version]$_.Directory.Parent.Parent.Name } -Descending |
        Select-Object -First 1
        if (-not $assembly) {
            throw 'Microsoft.Playwright.dll was not found. Install Microsoft.Playwright or set PLAYWRIGHT_DOTNET_DLL.'
        }
        $assembly
    }

    function Get-FreeTcpPort {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
        $listener.Start()
        try { $listener.LocalEndpoint.Port } finally { $listener.Stop() }
    }

    function Start-StaticServer {
        param([Parameter(Mandatory)][string] $Directory)

        $python = Get-Command python3, python -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $python) { throw 'Python is required to host the static test application.' }
        $port = Get-FreeTcpPort
        $stdout = Join-Path ([IO.Path]::GetTempPath()) "eoce-http-$PID-$port.out"
        $stderr = Join-Path ([IO.Path]::GetTempPath()) "eoce-http-$PID-$port.err"
        $process = Start-Process -FilePath $python.Source -ArgumentList @(
            '-m', 'http.server', [string]$port, '--bind', '127.0.0.1', '--directory', $Directory
        ) -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr

        $baseUrl = "http://127.0.0.1:$port"
        $client = [Net.Http.HttpClient]::new()
        try {
            $ready = $false
            foreach ($attempt in 1..50) {
                if ($process.HasExited) {
                    $details = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { '' }
                    throw "Static server exited before becoming ready. $details"
                }
                try {
                    $response = Complete-Task ($client.GetAsync($baseUrl))
                    $response.Dispose()
                    $ready = $true
                    break
                } catch {
                    Start-Sleep -Milliseconds 100
                }
            }
            if (-not $ready) { throw "Static server did not become ready at $baseUrl." }
        } finally {
            $client.Dispose()
        }
        [pscustomobject]@{ Process = $process; BaseUrl = $baseUrl; Logs = @($stdout, $stderr) }
    }

    function New-TestPage {
        param([Microsoft.Playwright.BrowserNewPageOptions] $Options)
        $page = if ($Options) {
            Complete-Task ($script:Browser.NewPageAsync($Options))
        } else {
            Complete-Task ($script:Browser.NewPageAsync())
        }
        Complete-Task ($page.AddInitScriptAsync(@'
window.__pesterBrowserErrors = [];
window.addEventListener('error', e => window.__pesterBrowserErrors.push(String(e.error || e.message)));
window.addEventListener('unhandledrejection', e => window.__pesterBrowserErrors.push(String(e.reason)));
'@, $null)) | Out-Null
        $page
    }

    function Open-Route {
        param([Parameter(Mandatory)] $Page, [Parameter(Mandatory)][string] $Route)
        Complete-Task ($Page.GotoAsync("$($script:Server.BaseUrl)/#$Route")) | Out-Null
        Complete-Task ($Page.WaitForSelectorAsync('#app h1')) | Out-Null
        (Complete-Task ($Page.Locator('#app .error-box').CountAsync())) | Should -Be 0
    }

    function Invoke-JavaScript {
        param([Parameter(Mandatory)] $Page, [Parameter(Mandatory)][string] $Expression)
        Complete-Task ($Page.EvaluateAsync[object]($Expression, $null))
    }

    function Invoke-JavaScriptObject {
        param([Parameter(Mandatory)] $Page, [Parameter(Mandatory)][string] $Expression)
        $json = Complete-Task ($Page.EvaluateAsync[string]("() => JSON.stringify(($Expression)())", $null))
        $json | ConvertFrom-Json
    }

    function Assert-NoBrowserErrors {
        param([Parameter(Mandatory)] $Page)
        @(Invoke-JavaScriptObject $Page '() => window.__pesterBrowserErrors') | Should -BeNullOrEmpty
    }

    if (-not (Test-Path -LiteralPath $script:AppRoot -PathType Container)) {
        throw "ClassificationExplorer was not found at '$script:AppRoot'. Set EOCE_REPO_ROOT if needed."
    }
    Add-Type -Path (Find-PlaywrightAssembly).FullName
    $script:Server = Start-StaticServer $script:AppRoot
    $script:Playwright = Complete-Task ([Microsoft.Playwright.Playwright]::CreateAsync())
    $launchOptions = [Microsoft.Playwright.BrowserTypeLaunchOptions]::new()
    $launchOptions.Headless = $true
    $script:Browser = Complete-Task ($script:Playwright.Chromium.LaunchAsync($launchOptions))
}

AfterAll {
    if ($script:Browser) { Complete-Task ($script:Browser.CloseAsync()) }
    if ($script:Playwright) { $script:Playwright.Dispose() }
    if ($script:Server.Process -and -not $script:Server.Process.HasExited) {
        Stop-Process -Id $script:Server.Process.Id -Force
        $script:Server.Process.WaitForExit()
    }
    foreach ($log in @($script:Server.Logs)) {
        if ($log -and (Test-Path $log)) { Remove-Item -LiteralPath $log -Force }
    }
}

Describe 'Classification Explorer' {
    BeforeEach { $script:Page = New-TestPage }
    AfterEach {
        if ($script:Page) { Complete-Task ($script:Page.CloseAsync()) }
    }

    It 'renders every route without browser errors' {
        foreach ($route in $script:Routes) {
            Open-Route $script:Page $route
            (Complete-Task ($script:Page.Locator('#app h1').InnerTextAsync())).Trim() |
            Should -Not -BeNullOrEmpty
        }
        Assert-NoBrowserErrors $script:Page
    }

    It 'loads secondary bundles only on demand' {
        Open-Route $script:Page 'dashboard'
        $getResources = {
            Invoke-JavaScriptObject $script:Page "() => performance.getEntriesByType('resource').map(x => x.name)"
        }
        @(& $getResources | Where-Object { $_ -like '*/assets/vendor/d3.min.js' }).Count | Should -Be 0
        @(& $getResources | Where-Object { $_ -like '*/assets/vendor/d3-sankey.min.js' }).Count | Should -Be 0

        Invoke-JavaScript $script:Page "() => EOCE.app.go('overview')" | Out-Null
        Complete-Task ($script:Page.WaitForSelectorAsync('#tmSankey')) | Out-Null
        @(& $getResources | Where-Object { $_ -like '*/assets/vendor/d3.min.js' }).Count | Should -Be 1
        @(& $getResources | Where-Object { $_ -like '*/assets/vendor/d3-sankey.min.js' }).Count | Should -Be 1
        $bundleState = Invoke-JavaScriptObject $script:Page "() => [typeof window.EOCE_ATTACK_PATHS_MD, typeof window.EOCE_HISTORY, typeof window.EOCE_NOTIFICATION_DATA]"
        ($bundleState | ConvertTo-Json -Compress) | Should -Be '["undefined","undefined","object"]'

        Invoke-JavaScript $script:Page "() => EOCE.app.go('roles')" | Out-Null
        Complete-Task ($script:Page.WaitForFunctionAsync("() => typeof window.EOCE_ATTACK_PATHS_MD === 'object'")) | Out-Null
        (Invoke-JavaScript $script:Page '() => typeof window.EOCE_HISTORY') | Should -Be 'undefined'

        Invoke-JavaScript $script:Page "() => document.getElementById('notificationButton').click()" | Out-Null
        Complete-Task ($script:Page.WaitForSelectorAsync('.eo-notification-panel.open')) | Out-Null
        (Invoke-JavaScript $script:Page '() => typeof window.EOCE_HISTORY') | Should -Be 'undefined'

        Invoke-JavaScript $script:Page "() => EOCE.app.go('history')" | Out-Null
        Complete-Task ($script:Page.WaitForFunctionAsync("() => typeof window.EOCE_HISTORY === 'object'")) | Out-Null
        @(& $getResources | Where-Object { $_ -like '*/data/attack-paths.js' }).Count | Should -Be 1
        @(& $getResources | Where-Object { $_ -like '*/data/history-data.js' }).Count | Should -Be 1
    }

    It 'renders large tables incrementally' {
        Open-Route $script:Page 'roles'
        $rows = $script:Page.Locator('#rolesTable tbody tr[data-idx]')
        (Complete-Task ($rows.CountAsync())) | Should -Be 100
        Complete-Task ($script:Page.Locator('#rolesPager [data-show-more]').ClickAsync())
        (Complete-Task ($rows.CountAsync())) | Should -Be 200
        Complete-Task ($script:Page.Locator('#rolesSearch').FillAsync('Global Administrator'))
        Complete-Task ($script:Page.WaitForFunctionAsync(
                "() => document.querySelectorAll('#rolesTable tbody tr[data-idx]').length < 100"
            )) | Out-Null
        (Complete-Task ($rows.CountAsync())) | Should -BeLessThan 100
    }

    It 'supports the mobile layout and attack graph' {
        Complete-Task ($script:Page.SetViewportSizeAsync(390, 844))
        Open-Route $script:Page 'roles'
        $layout = Invoke-JavaScriptObject $script:Page @'
() => ({
    bodyOverflow: document.body.scrollWidth - innerWidth,
    navToggleVisible: getComputedStyle(document.getElementById('navToggle')).display !== 'none',
    tableOverflow: getComputedStyle(document.querySelector('.table-wrap')).overflowX
})
'@
        $layout.bodyOverflow | Should -BeLessOrEqual 0
        $layout.navToggleVisible | Should -BeTrue
        $layout.tableOverflow | Should -Be 'auto'

        Open-Route $script:Page 'attackpaths'
        Complete-Task ($script:Page.WaitForSelectorAsync('#apGraph svg')) | Out-Null
        $graph = Invoke-JavaScriptObject $script:Page @'
() => {
    const rect = document.querySelector('#apGraph svg').getBoundingClientRect();
    return { width: rect.width, height: rect.height, nodes: document.querySelectorAll('#apGraph circle').length };
}
'@
        $graph.width | Should -BeGreaterThan 0
        $graph.height | Should -BeGreaterThan 0
        $graph.nodes | Should -BeGreaterThan 0
    }

    It 'meets accessibility and reduced-motion checks' {
        Open-Route $script:Page 'roles'
        $unnamed = Invoke-JavaScript $script:Page @'
() => [...document.querySelectorAll('#app input, #app select, #app button')]
    .filter(el => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') &&
        !(el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) &&
        !el.closest('label') && !el.textContent.trim()).length
'@
        $unnamed | Should -Be 0
        Complete-Task ($script:Page.Locator('#rolesTable tbody tr[data-idx]').First.ClickAsync())
        (Complete-Task ($script:Page.Locator('#drawer').GetAttributeAsync('role'))) | Should -Be 'dialog'
        (Invoke-JavaScript $script:Page "() => document.getElementById('drawer').contains(document.activeElement)") |
        Should -BeTrue

        $options = [Microsoft.Playwright.BrowserNewPageOptions]::new()
        $options.ReducedMotion = [Microsoft.Playwright.ReducedMotion]::Reduce
        $reducedPage = New-TestPage $options
        try {
            Complete-Task ($reducedPage.GotoAsync("$($script:Server.BaseUrl)/#roles")) | Out-Null
            Complete-Task ($reducedPage.WaitForSelectorAsync('#app h1')) | Out-Null
            $duration = Complete-Task (
                $reducedPage.Locator('.drawer').EvaluateAsync[string]('el => getComputedStyle(el).transitionDuration', $null, $null)
            )
            $duration | Should -BeIn @('0s', '1e-05s')
        } finally {
            Complete-Task ($reducedPage.CloseAsync())
        }
    }

    It 'shows a correctly linked legal footer' {
        Open-Route $script:Page 'dashboard'
        $footer = $script:Page.Locator('#nav .app-footer')
        (Complete-Task ($footer.IsVisibleAsync())) | Should -BeTrue
        $footerDisclosureLink = $script:Page.Locator('#nav .app-footer #footerDisclosureLink')
        (Complete-Task ($footerDisclosureLink.CountAsync())) | Should -Be 1
        (Complete-Task ($footerDisclosureLink.GetAttributeAsync('href'))) |
        Should -Be 'https://www.cloud-architekt.net/disclosure/'
        (Complete-Task ($footerDisclosureLink.GetAttributeAsync('rel'))) |
        Should -Be 'noopener noreferrer'
        Assert-NoBrowserErrors $script:Page
    }

    It 'opens directly from the file protocol' {
        $uri = ([uri]::new((Join-Path $script:AppRoot 'index.html'))).AbsoluteUri + '#overview'
        Complete-Task ($script:Page.GotoAsync($uri, $null)) | Out-Null
        Complete-Task ($script:Page.WaitForSelectorAsync('#app h1')) | Out-Null
        (Complete-Task ($script:Page.Locator('#app .error-box').CountAsync())) | Should -Be 0
        (Invoke-JavaScript $script:Page '() => location.protocol') | Should -Be 'file:'
    }

    It 'normalizes standalone generator theme paths' {
        $tempRoot = Join-Path ([IO.Path]::GetTempPath()) "eoce-standalone-$([guid]::NewGuid())"
        $appCopy = Join-Path $tempRoot 'ClassificationExplorer'
        try {
            New-Item -ItemType Directory -Path $tempRoot | Out-Null
            Copy-Item -LiteralPath $script:AppRoot -Destination $appCopy -Recurse
            $indexPath = Join-Path $appCopy 'index.html'
            (Get-Content $indexPath -Raw -Encoding utf8).Replace('</head>', @'
    <script src="../shared/theme.js"></script>
    <link rel="stylesheet" href="../shared/theme.css" />
</head>
'@) |
            Set-Content $indexPath -Encoding utf8 -NoNewline
            $arguments = @{
                RepoRoot = $script:RepoRoot; AppRoot = $appCopy
                SkipEmbed = $true; SkipManifest = $true; SkipHistory = $true
            }
            Update-EntraOpsClassificationExplorerData @arguments
            $indexText = Get-Content $indexPath -Raw -Encoding utf8
            $indexText | Should -Not -Match ([regex]::Escape('../shared/'))
            $indexText | Should -Match ([regex]::Escape('src="./theme/theme.js"'))
            $indexText | Should -Match ([regex]::Escape('href="./theme/theme.css"'))
        } finally {
            if (Test-Path $tempRoot) { Remove-Item $tempRoot -Recurse -Force }
        }
    }

    It 'normalizes EntraOps generator theme paths' {
        $tempRoot = Join-Path ([IO.Path]::GetTempPath()) "eoce-entraops-$([guid]::NewGuid())"
        $entraOpsRoot = Join-Path $tempRoot 'entraops'
        $appCopy = Join-Path $entraOpsRoot 'Reports/ClassificationExplorer'
        $templateCopy = Join-Path $entraOpsRoot 'Classification/Templates'
        try {
            New-Item -ItemType Directory -Path (Split-Path $appCopy -Parent) -Force | Out-Null
            New-Item -ItemType Directory -Path (Split-Path $templateCopy -Parent) -Force | Out-Null
            Copy-Item -LiteralPath $script:AppRoot -Destination $appCopy -Recurse
            Copy-Item -LiteralPath (Join-Path $script:RepoRoot 'EntraOps_Classification') -Destination $templateCopy -Recurse
            $modePath = Join-Path $appCopy 'js/mode.js'
            (Get-Content $modePath -Raw -Encoding utf8).Replace("'standalone'", "'entraops'") |
            Set-Content $modePath -Encoding utf8 -NoNewline
            $indexPath = Join-Path $appCopy 'index.html'
            (Get-Content $indexPath -Raw -Encoding utf8).Replace('</head>', @'
    <script src="./theme/theme.js"></script>
    <link rel="stylesheet" href="./theme/theme.css" />
</head>
'@) |
            Set-Content $indexPath -Encoding utf8 -NoNewline
            $arguments = @{
                Mode = 'EntraOps'; RepoRoot = $script:RepoRoot; EntraOpsRoot = $entraOpsRoot
                AppRoot = $appCopy; SkipEmbed = $true; SkipManifest = $true; SkipHistory = $true
            }
            Update-EntraOpsClassificationExplorerData @arguments
            $indexText = Get-Content $indexPath -Raw -Encoding utf8
            $indexText | Should -Not -Match ([regex]::Escape('./theme/'))
            $indexText | Should -Match ([regex]::Escape('src="../shared/theme.js"'))
            $indexText | Should -Match ([regex]::Escape('href="../shared/theme.css"'))
        } finally {
            if (Test-Path $tempRoot) { Remove-Item $tempRoot -Recurse -Force }
        }
    }

    It 'keeps security utilities safe' {
        Open-Route $script:Page 'overview'
        $values = Invoke-JavaScriptObject $script:Page @'
() => ({
    escaped: EOCE.util.escapeHtml('<script>"&'),
    safeHttps: EOCE.util.safeUrl('https://example.test/a?x="y'),
    rejectedJavascript: EOCE.util.safeUrl('javascript:alert(1)'),
    highlight: EOCE.util.highlight('A &amp; B', 'amp')
})
'@
        $values.escaped | Should -Be '&lt;script&gt;&quot;&amp;'
        $values.safeHttps | Should -Be 'https://example.test/a?x=&quot;y'
        $values.rejectedJavascript | Should -Be '#'
        $values.highlight | Should -Be 'A &amp; B'
    }

    It 'keeps the generated manifest synchronized with sources and bundles' {
        $manifest = Get-Content (Join-Path $script:AppRoot 'data-manifest.json') -Raw -Encoding utf8 |
        ConvertFrom-Json
        $manifest.fileCount | Should -Be $manifest.files.Count
        foreach ($entry in $manifest.files) {
            $source = Join-Path $script:RepoRoot $entry.path
            (Get-Item $source).Length | Should -Be $entry.bytes -Because $entry.path
            (Get-FileHash $source -Algorithm SHA256).Hash.ToLowerInvariant() |
            Should -Be $entry.sha256 -Because $entry.path
        }

        $bundle = Get-Content (Join-Path $script:AppRoot 'data/classification-data.js') -Raw -Encoding utf8
        $match = [regex]::Match($bundle, 'window\.EOCE_DATA_MANIFEST\s*=\s*(\{.*?\});', 'Singleline')
        $match.Success | Should -BeTrue
        $embedded = $match.Groups[1].Value | ConvertFrom-Json
        $embedded.mode | Should -Be $manifest.mode
        $embedded.fileCount | Should -Be $manifest.fileCount
        $separator = [char]31
        $expected = @($manifest.files | ForEach-Object {
                "$($_.path)$separator$($_.items)$separator$($_.sha256)"
            } | Sort-Object)
        $actual = @($embedded.files | ForEach-Object {
                "$($_.path)$separator$($_.items)$separator$($_.sha256)"
            } | Sort-Object)
        @(Compare-Object -ReferenceObject $expected -DifferenceObject $actual) | Should -BeNullOrEmpty

        $historyText = Get-Content (Join-Path $script:AppRoot 'data/history-data.js') -Raw -Encoding utf8
        $historyMatch = [regex]::Match($historyText, 'window\.EOCE_HISTORY\s*=\s*(\{.*\});', 'Singleline')
        $historyMatch.Success | Should -BeTrue
        $history = $historyMatch.Groups[1].Value | ConvertFrom-Json
        $notificationText = Get-Content (Join-Path $script:AppRoot 'data/notification-data.js') -Raw -Encoding utf8
        $notificationMatch = [regex]::Match(
            $notificationText, 'window\.EOCE_NOTIFICATION_DATA\s*=\s*(\{.*\});', 'Singleline'
        )
        $notificationMatch.Success | Should -BeTrue
        $notification = $notificationMatch.Groups[1].Value | ConvertFrom-Json
        ($history.notification | ConvertTo-Json -Depth 100 -Compress) |
        Should -Be ($notification.notification | ConvertTo-Json -Depth 100 -Compress)
        @($notification.notification.sourceKeys) | Should -Not -BeNullOrEmpty
        foreach ($sourceKey in $notification.notification.sourceKeys) {
            $commits = @($history.sources.$sourceKey.commits)
            ($commits[-1] | ConvertTo-Json -Depth 100 -Compress) |
            Should -Be ($notification.sources.$sourceKey.commits[0] | ConvertTo-Json -Depth 100 -Compress)
        }
    }
}
