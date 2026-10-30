#Requires -Modules Pester

BeforeAll {
    . (Join-Path $PSScriptRoot '../Modules/EntraOps.Classification/Private/Invoke-EntraOpsMsGraphQuery.ps1')
    function Invoke-MgGraphRequest { param($Method, $Uri, $Body, $Headers, $OutputType) }
}

Describe 'Standalone Graph collection contract' {
    It 'unwraps and paginates <OutputType> results without modifying caller headers' -ForEach @(
        @{ OutputType = 'HashTable' }, @{ OutputType = 'PSObject' }
    ) {
        $script:RequestedHeaders = @()
        Mock Invoke-MgGraphRequest {
            $script:RequestedHeaders += ,$Headers
            $page = if ($Uri -eq 'https://graph.microsoft.com/beta/test') {
                @{ value = @(@{ id = 'first' }); '@odata.nextLink' = 'https://graph.microsoft.com/beta/next' }
            } else { @{ value = @(@{ id = 'second' }) } }
            if ($OutputType -eq 'PSObject') { return [pscustomobject]$page }
            return $page
        }
        $headers = @{ 'X-Test' = 'preserve' }
        $result = @(Invoke-EntraOpsMsGraphQuery -Uri 'https://graph.microsoft.com/beta/test' -OutputType $OutputType -Headers $headers -ConsistencyLevel eventual)
        $result.id | Should -Be @('first', 'second')
        $headers.ContainsKey('ConsistencyLevel') | Should -BeFalse
        $script:RequestedHeaders.Count | Should -Be 2
        $script:RequestedHeaders[1]['ConsistencyLevel'] | Should -Be 'eventual'
        Should -Invoke Invoke-MgGraphRequest -Times 2 -Exactly
    }

    It 'returns no items for an empty hashtable collection' {
        Mock Invoke-MgGraphRequest { @{ value = @() } }
        @(Invoke-EntraOpsMsGraphQuery -Uri '/beta/test').Count | Should -Be 0
    }

    It 'preserves a single-object response' {
        Mock Invoke-MgGraphRequest { @{ id = 'single' } }
        (Invoke-EntraOpsMsGraphQuery -Uri '/beta/test').id | Should -Be 'single'
    }

    It 'passes raw JSON responses through' {
        Mock Invoke-MgGraphRequest { '{"value":[],"@odata.nextLink":"next"}' }
        Invoke-EntraOpsMsGraphQuery -Uri '/beta/test' -OutputType Json | Should -Be '{"value":[],"@odata.nextLink":"next"}'
        Should -Invoke Invoke-MgGraphRequest -Times 1 -Exactly -ParameterFilter { $OutputType -eq 'Json' }
    }

    It 'propagates failures on later pages rather than returning a successful partial export' {
        Mock Invoke-MgGraphRequest {
            if ($Uri -eq 'next') { throw 'Graph failure' }
            @{ value = @(@{ id = 'first' }); '@odata.nextLink' = 'next' }
        }
        { Invoke-EntraOpsMsGraphQuery -Uri '/beta/test' -ErrorAction Stop } | Should -Throw '*Graph failure*'
    }
}
