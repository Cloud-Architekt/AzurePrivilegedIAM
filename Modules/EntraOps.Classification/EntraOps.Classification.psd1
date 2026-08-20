@{
    RootModule        = 'EntraOps.Classification.psm1'
    ModuleVersion     = '1.0.0'
    GUID              = 'f0d8c0a8-f4d9-4a59-a926-f3d3de593c90'
    Author            = 'Thomas Naunheim'
    PowerShellVersion = '7.0'
    FunctionsToExport = @(
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
    CmdletsToExport   = @()
    VariablesToExport = @()
    AliasesToExport   = @()
}