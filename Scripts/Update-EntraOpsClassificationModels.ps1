#Requires -Version 7.0

[CmdletBinding()]
param(
	[string]$RepoRoot,
	$IncludeCustomRoles = $false,
	[string[]]$Tier0IncludedResourceScope = @(),
	[string[]]$Tier1IncludedResourceScope = @(),
	[string]$AzureClassificationFile = './EntraOps_Classification/Classification_Azure.json',
	$AzureRoleDefinitionScope = $null,
	[switch]$ResolveApiPermissionDisplayNames,
	[switch]$SkipClassificationExplorerUpdate,
	[switch]$SkipEntraOpsRepoSync,
	[switch]$SkipHistoryUpdate,
	[switch]$Sequential
)

$moduleManifest = Join-Path $PSScriptRoot '../Modules/EntraOps.Classification/EntraOps.Classification.psd1'
Import-Module $moduleManifest -Force -ErrorAction Stop

$azContext = Get-AzContext -ErrorAction SilentlyContinue
if (-not $azContext -or -not $azContext.Account -or -not $azContext.Tenant -or -not $azContext.Tenant.Id) {
	Write-Host 'No Azure context detected. Signing in to Azure...'
	Disable-AzContextAutosave -Scope Process | Out-Null
	Connect-AzAccount -ErrorAction Stop | Out-Null
}

$requiredGraphScopes = @(
	'Application.Read.All'
	'RoleManagement.Read.Directory'
	'DeviceManagementRBAC.Read.All'
	'EntitlementManagement.Read.All'
)
$mgContext = Get-MgContext -ErrorAction SilentlyContinue
$missingGraphScopes = @($requiredGraphScopes | Where-Object { $_ -notin $mgContext.Scopes })
if (-not $mgContext -or -not $mgContext.Account -or $missingGraphScopes.Count -gt 0) {
	Write-Host 'Microsoft Graph is not connected with the required scopes. Signing in to Microsoft Graph...'
	Connect-MgGraph -Scopes $requiredGraphScopes -ContextScope Process -ErrorAction Stop | Out-Null
}

Update-EntraOpsClassificationModels @PSBoundParameters