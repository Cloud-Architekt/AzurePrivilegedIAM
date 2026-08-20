function Get-EntraOpsAadHighPrivilegedRolesAndAssignments {

    <#
    .SYNOPSIS
        Get all Microsoft Entra ID directory roles flagged as "high" privileged and their assignments.

    .DESCRIPTION
        Reads all directory role definitions with "IsPrivileged" set to true from Microsoft Graph and returns
        every direct (active) and eligible role assignment (including PIM eligibility schedules) for those roles.

    .EXAMPLE
        Get-EntraOpsAadHighPrivilegedRolesAndAssignments
    #>

    [cmdletbinding()]
    param ()

    # List of privileged roles based on "IsPrivileged" from Azure AD role definition
    $HiPORoles = Invoke-EntraOpsMsGraphQuery -Method Get -Uri "https://graph.microsoft.com/beta/roleManagement/directory/roleDefinitions" -OutputType PSObject | Where-Object { $_.IsPrivileged -eq $True }
    $HiPORoles | Sort-Object DisplayName | Format-Table DisplayName, isPrivileged, isBuiltin, description

    # List of direct assignment and eligibles for "high" privileged roles
    $HiPORoleMembers = @()
    foreach ($HiPORole in $HiPORoles) {
        Write-Host "$($HiPORole.displayName)"
        $HiPORoleMembers += Invoke-EntraOpsMsGraphQuery -Uri ('https://graph.microsoft.com/beta/roleManagement/directory/roleAssignments?$filter=roleDefinitionId eq ' + "'$($HiPORole.id)'" + '&$expand=principal') -ConsistencyLevel eventual -OutputType PSObject
        $HiPORoleMembers += Invoke-EntraOpsMsGraphQuery -Uri ('https://graph.microsoft.com/beta/roleManagement/directory/roleEligibilitySchedules?$filter=roleDefinitionId eq ' + "'$($HiPORole.id)'" + '&$expand=principal') -ConsistencyLevel eventual -OutputType PSObject
    }

    $HiPORoleMembers | Select-Object principalid, principal, directoryScopeId, roleDefinitionId, status, memberType, scheduleInfo | ConvertTo-Json -Depth 10
}