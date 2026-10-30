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

    # This standalone adapter deliberately has no dependency on the EntraOps session/cache.
    # Match the shared exporters' collection contract, including Graph continuation pages.
    $requestParameters = @{ Method = $Method; Uri = $Uri; OutputType = $OutputType }
    foreach ($parameterName in 'Body', 'Headers', 'OutputType') {
        if ($PSBoundParameters.ContainsKey($parameterName)) {
            $requestParameters[$parameterName] = $PSBoundParameters[$parameterName]
        }
    }
    if ($ConsistencyLevel) {
        $requestParameters.Headers = if ($Headers) { $Headers.Clone() } else { @{} }
        $requestParameters.Headers['ConsistencyLevel'] = $ConsistencyLevel
    }

    do {
        $result = Invoke-MgGraphRequest @requestParameters -ErrorAction Stop
        if ($OutputType -in 'HttpResponseMessage', 'Json') { return $result }

        $isDictionary = $result -is [System.Collections.IDictionary]
        $isCollection = if ($isDictionary) { $result.Contains('value') } else {
            $null -ne $result -and $null -ne $result.PSObject.Properties['value']
        }
        if (-not $isCollection) { return $result }

        $result.value
        $nextLink = if ($isDictionary) { $result['@odata.nextLink'] } elseif ($result.PSObject.Properties['@odata.nextLink']) {
            $result.'@odata.nextLink'
        } else { $null }
        if ($nextLink -and $Method -eq 'GET') { $requestParameters.Uri = $nextLink } else { break }
    } while ($true)
}
