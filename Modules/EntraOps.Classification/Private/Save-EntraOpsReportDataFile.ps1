function Save-EntraOpsReportDataFile {
    <#
    .SYNOPSIS
        Writes a generated EntraOps Reporting JS data file safely (escaped and atomically).
    .DESCRIPTION
        Shared helper for the reporting data generators (New-EntraOps*Data). The content is a
        JS payload of the shape "window.X = {json};". Before writing, angle brackets are
        escaped as backslash-u003c / backslash-u003e JSON string escapes so a stray
        '</script>' inside any JSON value can never break out of a surrounding <script> tag,
        and the line separator characters U+2028/U+2029 (plain whitespace inside JSON strings,
        but line terminators in JavaScript) are escaped the same way so they cannot produce a
        syntax error in the payload.

        The content is written to "<LiteralPath>.tmp" first and then swapped into place with
        Move-Item -Force, so a crashed or interrupted generator run never leaves a truncated
        data file behind for the static web apps (or for generators that read their previous
        output back as a baseline). The parent directory is created when missing.
    .PARAMETER Content
        The full JS file content to write (header comment plus "window.X = {json};" payload).
    .PARAMETER LiteralPath
        The target data file path (for example <AppRoot>/data/eam-dashboard-data.js).
    #>
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content,

        [Parameter(Mandatory = $true)]
        [string]$LiteralPath
    )

    # Escape angle brackets so a stray '</script>' in any value can never break out of the
    # surrounding <script> tag (same escaping as Update-EntraOpsClassificationExplorerData),
    # and U+2028/U+2029 which are line terminators in JavaScript but not in JSON.
    $Backslash = [string][char]0x5C
    $Content = $Content.Replace('<', $Backslash + 'u003c').Replace('>', $Backslash + 'u003e')
    $Content = $Content.Replace([string][char]0x2028, $Backslash + 'u2028').Replace([string][char]0x2029, $Backslash + 'u2029')

    $ParentDir = Split-Path -Parent $LiteralPath
    if ($ParentDir -and -not (Test-Path -LiteralPath $ParentDir)) {
        New-Item -ItemType Directory -Path $ParentDir -Force | Out-Null
    }

    # Atomic swap: write to a temp file next to the target, then move it into place.
    $TempPath = "$LiteralPath.tmp"
    Set-Content -LiteralPath $TempPath -Value $Content -Encoding UTF8
    Move-Item -LiteralPath $TempPath -Destination $LiteralPath -Force
}
