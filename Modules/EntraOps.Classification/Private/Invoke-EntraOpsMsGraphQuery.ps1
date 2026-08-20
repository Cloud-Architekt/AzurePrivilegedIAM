function Invoke-EntraOpsMsGraphQuery {
    [CmdletBinding()]
    param(
        [string]$Method = 'GET',

        [Parameter(Mandatory)]
        [string]$Uri,

        [object]$Body,

        [hashtable]$Headers,

        [string]$ConsistencyLevel,

        [ValidateSet('HashTable', 'PSObject', 'HttpResponseMessage', 'Json')]
        [string]$OutputType = 'HashTable',

        [switch]$DisableCache
    )

    $requestParameters = @{ Method = $Method; Uri = $Uri }
    foreach ($parameterName in 'Body', 'Headers', 'OutputType') {
        if ($PSBoundParameters.ContainsKey($parameterName)) {
            $requestParameters[$parameterName] = $PSBoundParameters[$parameterName]
        }
    }
    if ($ConsistencyLevel) {
        if (-not $requestParameters.Headers) { $requestParameters.Headers = @{} }
        $requestParameters.Headers['ConsistencyLevel'] = $ConsistencyLevel
    }

    $result = Invoke-MgGraphRequest @requestParameters
    if ($OutputType -ne 'HttpResponseMessage' -and $result.PSObject.Properties['value']) {
        return $result.value
    }
    return $result
}