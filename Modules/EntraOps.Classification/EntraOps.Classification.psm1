foreach ($folder in 'Private', 'Public') {
    $functionFiles = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot $folder) -Filter '*.ps1' -File |
        Sort-Object Name

    foreach ($functionFile in $functionFiles) {
        . $functionFile.FullName
    }
}

Export-ModuleMember -Function @(
    'Export-EntraOpsClassificationApiPermissions',
    'Export-EntraOpsClassificationAppRoles',
    'Export-EntraOpsClassificationAzureRoles',
    'Export-EntraOpsClassificationDeviceManagementRoles',
    'Export-EntraOpsClassificationDirectoryRoles',
    'Export-EntraOpsClassificationDirectoryRolesFromMsftDocs',
    'Export-EntraOpsClassificationIdentityGovernanceRoles',
    'Export-EntraOpsClassificationScopes',
    'Get-EntraOpsAadHighPrivilegedRolesAndAssignments',
    'Get-EntraOpsAadObjectsFromAzureRBAC',
    'Get-EntraOpsAzEARoleMembers',
    'Get-EntraOpsClassificationDirectoryRolesMismatchFromMsftDocs',
    'Sync-EntraOpsClassificationExplorerSource',
    'Update-EntraOpsClassificationExplorerData',
    'Update-EntraOpsClassificationModels'
)