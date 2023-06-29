# List of privileged roles based on "IsPrivileged" from Azure AD role definition
$HiPORoles = (Invoke-MgGraphRequest -Method Get -Uri ("https://graph.microsoft.com/beta/roleManagement/directory/roleDefinitions") -OutputType PSObject).value | Where-Object {$_.IsPrivileged -eq $True}
$HiPORoles | Sort-Object DisplayName | Format-Table DisplayName, isPrivileged, isBuiltin, description

# List of direct assignment and eligibles for "high" privileged roles
foreach ($HiPORole in $HiPORoles) {
    Write-Host "$($HiPORole.displayName)"
    $HiPORoleMembers += (Invoke-MgGraphRequest -Uri ('https://graph.microsoft.com/beta/roleManagement/directory/roleAssignments?$filter=roleDefinitionId eq ' + "'$($HiPORole.id)'" + '&$expand=principal') -Headers @{'ConsistencyLevel' = 'eventual' } -OutputType PSObject).Value
    $HiPORoleMembers += (Invoke-MgGraphRequest -Uri ('https://graph.microsoft.com/beta/roleManagement/directory/roleEligibilitySchedules?$filter=roleDefinitionId eq ' + "'$($HiPORole.id)'" + '&$expand=principal') -Headers @{'ConsistencyLevel' = 'eventual' } -OutputType PSObject).Value
}

$HiPORoleMembers | Select-Object principalid, principal, directoryScopeId, roleDefinitionId, status, memberType, scheduleInfo | ConvertTo-Json -Depth 10