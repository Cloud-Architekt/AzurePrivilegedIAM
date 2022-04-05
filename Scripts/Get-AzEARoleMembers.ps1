function Get-AzEARoleMembers {
    <#    
    .SYNOPSIS
        Get a list of all role assignments from Enterprise Agreement (EA) management with relation to the user account and assigned classic administrator roles in subscriptions.
        This script needs to be executed with permissions as "Enrollment reader" (EA role) and "Reader" permission on Management Root Group (to read all classic administrators assignments) in the related Azure (AD) tenants.

    .DESCRIPTION
        Get a list of all role assignments from Enterprise Agreement (EA) management with relation to the user account and assigned classic administrator roles in subscriptions.

    .EXAMPLE
        Get-AzEARoleMembers -TenantName "contoso.onmicrosoft.com"
    #>

    [cmdletbinding()]
    param (
        [Parameter(Mandatory=$True)]
        [System.String]$TenantName
    )

    # Check required modules
    $RequiredModules = (
        "Az.Accounts",
        "Az.ResourceGraph",
        "Microsoft.Graph.Authentication",
        "Microsoft.Graph.Users"
        )
        foreach ($Module in $RequiredModules) {
            if (Get-Module -ListAvailable -Name $Module) {
                Write-Verbose "Module already installed"
            }
            else {
                Write-Host "Installing $Module module"
                try {
                    Install-Module $Module -AllowClobber -Force -ErrorAction Stop
                    Import-Module $Module
                }
                catch {
                    Write-Error $_.Exception.Message
                    break
                }
            }
        }

    # Authentication and Connect to Az
    Connect-AzAccount -Tenant $TenantName

    # Get Token and connect to MgGraph
    $AccessToken = (Get-AzAccessToken -ResourceTypeName "MSGraph").Token
    Connect-MgGraph -AccessToken $AccessToken
    $TenantId = (Get-AzContext).Tenant.Id

    # List all subscriptions to get classic administrators
    $Subscriptions = (Get-AzSubscription -TenantId $TenantId | where-object {$_.HomeTenantId -eq $TenantId}).SubscriptionId
    $SubscriptionClassicAdmins = foreach ($Subscription in $Subscriptions) {
        Write-Host "Check Classic Administrators (incl. Service Admin) in $Subscription"
        $AzContext = Set-AzContext -SubscriptionId $Subscription -WarningAction SilentlyContinue
        $ClassicAdmins = ((Invoke-AzRestMethod -Method Get https://management.azure.com/subscriptions/"$Subscription"/providers/Microsoft.Authorization/classicAdministrators?api-version=2015-06-01).content | ConvertFrom-Json).Value.properties
        foreach ($ClassicAdmin in $ClassicAdmins) {
            if($ClassicAdmin.Role.Contains(";")) { $ClassicAdmin.Role = $ClassicAdmins.role.Split(";") }
            [pscustomobject]@{
                SubscriptionId                   =   $Subscription
                Emailaddress                     =   $ClassicAdmin.emailAddress
                ClassicAdminRole                 =   $ClassicAdmin.Role
                SubscriptionDetails              =   Search-AzGraph -Query "resourcecontainers | where id =~ '/subscriptions/$Subscription' | project name, properties, ['tags']"
            }
        }
    }

    function Get-AzureEABillingRoles {
            
        $BillingAccounts = ((Invoke-AzRestMethod -Method GET "https://management.azure.com/providers/Microsoft.Billing/billingAccounts?api-version=2019-10-01-preview").Content | ConvertFrom-Json).value
        $AzureEaAdmins = @()
        $BillingRoleDefinitions = @()

        $BillingAccounts | ForEach-Object {
            if($_.Properties.agreementType -eq "EnterpriseAgreement") {
                $BillingAccountId = $_.name

                # Check for EA roles and definitions
                Write-Host "Getting Enrollment administrators..."
                $BillingRoleDefinitions += $EnrollmentRoleDefinitions = ((Invoke-AzRestMethod -Method Get https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BillingAccountId/billingRoleDefinitions?api-version=2019-10-01-preview).content | ConvertFrom-Json).value

                ## ENROLLMENT ADMINISTRATORS
                $EnrollmentAdminDetails = $BillingAccounts | ForEach-Object {
                    ((Invoke-AzRestMethod -Method Get https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BillingAccountId/billingRoleAssignments?api-version=2019-10-01-preview).Content | ConvertFrom-Json).value
                }
                $EnterpriseEnrollmentAdmin = $EnrollmentAdminDetails | Select-Object id, properties
                $AzureEaAdmins += $EnterpriseEnrollmentAdmin | select-object id, properties

                ## ENROLLMENT ACCOUNTS
                Write-Host "Getting Enrollment account admins..."
                $EnterpriseEnrollmentAccounts = $BillingAccounts | ForEach-Object {
                    ((Invoke-AzRestMethod -Method get https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BillingAccountId/enrollmentAccounts?api-version=2019-10-01-preview).content | ConvertFrom-Json).value
                }
                $EnterpriseEnrollmentAccountsRoleAssignments = $EnterpriseEnrollmentAccounts | foreach-object {
                    $EnrollmentAccountName = $_.name
                    ((Invoke-AzRestMethod -Method Get https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BillingAccountId/enrollmentAccounts/$EnrollmentAccountName/billingRoleAssignments?api-version=2019-10-01-preview).content | ConvertFrom-Json).value
                }
                $EnterpriseEnrollmentAccountAdmins = $EnterpriseEnrollmentAccountsRoleAssignments | Select-Object id, properties
                $BillingRoleDefinitions += $AccountRoleDefinitions = ForEach ($roleDefinitionId in $EnterpriseEnrollmentAccountsRoleAssignments.properties.roleDefinitionId) {
                    ((Invoke-AzRestMethod -Method Get https://management.azure.com/"$roleDefinitionId"?api-version=2019-10-01-preview).content | ConvertFrom-Json)
                }

                $AzureEaAdmins += $EnterpriseEnrollmentAccountAdmins | select-object id, properties

                ## ENROLLMENT DEPARTMENTS
                Write-Host "Getting Enrollment department admins..."
                $EnterpriseEnrollmentDepartment = $BillingAccounts | ForEach-Object {
                    ((Invoke-AzRestMethod -Method Get https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BillingAccountId/departments?api-version=2019-10-01-preview).content | ConvertFrom-Json).value
                }

                $EnterpriseEnrollmentDepartmentRoleAssignments = $EnterpriseEnrollmentDepartment | foreach-object {
                    $DepartmentName = $_.name
                    ((Invoke-AzRestMethod -Method Get  https://management.azure.com/providers/Microsoft.Billing/billingAccounts/$BillingAccountId/departments/$DepartmentName/billingRoleAssignments?api-version=2019-10-01-preview).content | ConvertFrom-Json).value
                }
                $BillingRoleDefinitions += $DepartmentRoleDefinitions = ForEach ($roleDefinitionId in $EnterpriseEnrollmentDepartmentRoleAssignments.properties.roleDefinitionId) {
                    ((Invoke-AzRestMethod -Method Get https://management.azure.com/"$roleDefinitionId"?api-version=2019-10-01-preview).content | ConvertFrom-Json)
                }

                $EnterpriseEnrollmentDepartmentAdmins = $EnterpriseEnrollmentDepartmentRoleAssignments | Select-Object id, properties
                $AzureEaAdmins += $EnterpriseEnrollmentDepartmentAdmins | select-object id, properties
            }
            else {
                Write-Warning "Non-EA subscription...checking if MCA subscription for subscription creator role..."
            }
        }

        # Unique values in role definition
        $BillingRoleDefinitions = $BillingRoleDefinitions | select-object -Unique id, name, properties, type

        # Get tenant names to detect user objects outside of organization
        $TenantDomainNames = (Get-AzTenant -TenantId $TenantId).Domains

        Write-Host "Collecting user information and details of role definitions..."
        foreach ($AzureEaAdmin in $AzureEaAdmins) {
            $UserMailAddress = $AzureEaAdmin.properties.userEmailAddress
            $BillingRoleDefinitionId = $AzureEaAdmin.properties.roleDefinitionId
            $BillingRoleDefinitionDetails = ($BillingRoleDefinitions | where-object {$_.id -eq "$BillingRoleDefinitionId"}).properties
            if ($AzureEaAdmins.properties.userAuthenticationType -eq "Organization")
                { $User = Get-MgUser -Filter "proxyAddresses/any(y:startswith(y,'smtp:$UserMailAddress'))"
            }
            [pscustomobject]@{
                RoleAssignmentId                 =   $AzureEaAdmin.id
                RoleAssignmentScopeName          =   $AzureEaAdmin.properties.Scope
                RoleName                         =   $BillingRoleDefinitionDetails.roleName
                RoleId                           =   $AzureEaAdmin.properties.roleDefinitionId
                RoleDefinitionActions            =   $BillingRoleDefinitionDetails.permissions.actions
                RoleDefinitionDescription        =   $BillingRoleDefinitionDetails.description
                ObjectDisplayName                =   $User.DisplayName
                ObjectSignInName                 =   $User.UserPrincipalName
                ObjectMailAddress                =   $AzureEaAdmin.properties.userEmailAddress
                ObjectId                         =   $User.Id
                ObjectAccountType                =   $AzureEaAdmin.properties.userAuthenticationType
            }
        }
    }

    Write-Host "Getting Azure Billing information..."
    $AzBillingAssignments = Get-AzureEABillingRoles -TenantName $TenantName

    Write-Host "Check if primary user name (mail address) of Classic Admin assignments not match with EA/Azure Billing role principal"
    foreach ($SubscriptionClassicAdmin in $SubscriptionClassicAdmins) {
        if ($SubscriptionClassicAdmin.Emailaddress -notin $AzBillingAssignments.ObjectMailAddress) {
            Write-Warning "No match between mail address of Account/Service Owner in Azure RBAC and EA Portal/Billing RBAC: $($SubscriptionClassicAdmin.Emailaddress)"
        }
    }

    Write-Host "Add classic role assignment information to Azure Billing role assignments"
    foreach ($AzBillingAssignment in $AzBillingAssignments) {
        $SubscriptionClassicAdmin = $SubscriptionClassicAdmins | where-object {$_.Emailaddress -eq $AzBillingAssignment.ObjectMailAddress} | select-object SubscriptionId, ClassicAdminRole
        $AzBillingAssignment | Add-Member -NotePropertyName ClassicAdminRoleSubscriptions -NotePropertyValue $SubscriptionClassicAdmin
    }
    $AzBillingAssignments
}