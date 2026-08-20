function ConvertTo-EntraOpsODataStringLiteral {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Value
    )

    return [uri]::EscapeDataString($Value.Replace("'", "''"))
}