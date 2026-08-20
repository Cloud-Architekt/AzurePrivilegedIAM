function Resolve-EntraOpsClassificationRepoRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ModuleBase
    )

    $candidate = [IO.DirectoryInfo]$ModuleBase
    while ($candidate) {
        if (Test-Path -LiteralPath (Join-Path $candidate.FullName 'Classification') -PathType Container) {
            return $candidate.FullName
        }
        $candidate = $candidate.Parent
    }

    throw "Unable to locate the repository root from module base '$ModuleBase'."
}