function Get-AADObjectsFromAzureRBAC {
 
    # Module
    Import-Module Az.Accounts, Az.Resources

    # Authentication
    $context = Get-AzContext

    if (!$context -or ($context.Tenant.Id -eq $null)) 
        {
            $TenantId = Read-Host "Your TenantId"
            Connect-AzAccount -TenantId $TenantId
        } 
    else 
        {
            $TenantId = $context.Tenant.Id
            Write-Host "TenantId '$TenantId' already connected"
        }

    # Eligible roles in PIM
    $MSPIM = Get-AzADServicePrincipal | Where-Object {$_.DisplayName -eq "MS-PIM"}
    $MSPIMScope = (Get-AzRoleAssignment -ObjectId $MSPIM.Id)

    $AzRBACEligibleAssignments = $MSPIMScope | ForEach-Object {
        $Scope = $_.Scope
        $Path = $Scope + "/providers/Microsoft.Authorization/roleEligibilityScheduleRequests?api-version=2020-10-01-preview"
        $EligibleAssign = ((Invoke-AzRestMethod -Method GET -Path $Path).Content | ConvertFrom-Json).value.properties | select-object PrincipalId, PrincipalType, expandedproperties
        $EligibleAssign | ForEach-Object {


            [pscustomobject]@{
                RoleDefinitionId            = $_.expandedProperties.RoleDefinition.Id
                RoleDefinitionName          = $_.expandedProperties.RoleDefinition.DisplayName
                RoleDefinitionType          = $_.expandedProperties.RoleDefinition.Type
                RoleAssignmentType          = "Eligible"
                ObjectName                  = $_.expandedProperties.principal.DisplayName
                ObjectId                    = $_.expandedProperties.principal.id
                ObjectType                  = $_.expandedProperties.principal.type
                Scope                       = $Scope
            }
        }        
    }

    # Permanent roles / direct assigned
    $AzRBACDirectAssignments = Get-AzRoleAssignment | Where-Object {$_.ObjectId -ne "$MSPIM.ID"}
    $AzRBACDirectAssignments = $AzRBACDirectAssignments | ForEach-Object {

        if ((Get-AzRoleDefinition -Id $_.RoleDefinitionId).IsCustom -eq $true) {
            $RoleDefinitionType = "CustomRole"
        }
        else {
            $RoleDefinitionType = "BuiltInRole"
        }

        [pscustomobject]@{
            RoleDefinitionId            = $_.RoleDefinitionId
            RoleDefinitionName          = $_.RoleDefinitionName
            RoleDefinitionType          = $RoleDefinitionType
            RoleAssignmentType          = "Permanent"
            ObjectName                  = $_.DisplayName
            ObjectId                    = $_.ObjectId
            ObjectType                  = $_.ObjectType
            Scope                       = $_.Scope
            #$ServiceName                = $Tag.$ServiceName        
            #$RBACPrivilegedLevel        = $Tag.$RBACPrivilegedLevel        
        }    
    }
    $Result = @()
    $Result += $AzRBACEligibleAssignments
    $Result += $AzRBACDirectAssignments
    return $Result
}
Get-AADObjectsFromAzureRBAC