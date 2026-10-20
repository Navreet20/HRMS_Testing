"""Default request bodies shown in Swagger "Try it out".

Most routers accept ``dict[str, Any]`` bodies, so the generated schema has no
fields. These examples list the fields each service requires, with placeholder
values. ID placeholders must be replaced with real rows before sending.
"""

from typing import Any

from fastapi import FastAPI

_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
_ID_2 = "3fa85f64-5717-4562-b3fc-2c963f66afa7"

REQUEST_EXAMPLES: dict[tuple[str, str], Any] = {
    # --- Auth ---
    ("POST", "/api/v1/auth/switch-view"): {"view": "employee"},
    ("PATCH", "/api/v1/auth/theme-preference"): {"themePreference": "dark"},
    ("PATCH", "/api/v1/auth/quick-actions-preference"): {
        "quickActionsPreference": ["leavesApply", "attendance"],
    },
    ("PATCH", "/api/v1/auth/forgot-password"): {"emailId": "jane.doe@example.com"},
    ("PATCH", "/api/v1/auth/reset-password"): {
        "password": "NewPassw0rd!",
        "tempPassword": "TempPassw0rd!",
    },
    # --- Employee portal (me) ---
    # requestType "swap" / "reportLostStolen" take systemAssetId instead of categoryId.
    ("POST", "/api/v1/me/asset-requests"): {
        "requestType": "new",
        "categoryId": _ID,
        "newAssetDetails": "Need a laptop for development work",
    },
    ("POST", "/api/v1/me/it-requests"): {
        "category": "softwareLicense",
        "details": "Need a JetBrains IntelliJ IDEA license",
    },
    ("POST", "/api/v1/me/manage/profile-update-requests/{request_id}/complete"): {
        "changesSummary": "Updated mailing address as requested",
    },
    # notes is required when action is "reject".
    ("POST", "/api/v1/me/manage/profile-update-requests/{request_id}/decide"): {
        "action": "approve",
        "notes": "Verified against supporting document",
    },
    # Approving a new/swap request requires assignSystemAssetId (an in-stock asset).
    ("POST", "/api/v1/me/manage/asset-requests/{request_id}/decide"): {
        "action": "approve",
        "notes": "Assigned from stock",
        "assignSystemAssetId": _ID,
    },
    # --- Employees ---
    ("POST", "/api/v1/employees"): {
        "firstName": "Jane",
        "lastName": "Doe",
        "emailId": "jane.doe@example.com",
        "dateOfBirth": "1990-05-20",
        "dateOfJoining": "2026-01-15",
        "leavePolicyId": _ID,
        "employmentType": "FULL_TIME",
        "phoneNumber": "+15551234567",
    },
    ("POST", "/api/v1/employees/drafts"): {
        "firstName": "Jane",
        "lastName": "Doe",
        "personalEmail": "jane.doe@example.com",
    },
    ("POST", "/api/v1/employees/code-preview"): {"firstName": "Jane", "lastName": "Doe"},
    ("POST", "/api/v1/employees/transitions"): {
        "action": "rehire",
        "emailId": "jane.doe@example.com",
    },
    ("PATCH", "/api/v1/employees/{employee_id}"): {
        "middleName": "Marie",
        "phoneNumber": "+15551234567",
    },
    # action "reject" requires comments; "approve" needs no other fields.
    ("POST", "/api/v1/employees/{employee_id}/transitions"): {
        "action": "offboard",
        "endDate": "2026-01-15",
        "comments": "Resigned",
    },
    ("POST", "/api/v1/employees/{employee_id}/projects"): {
        "projectName": "Apollo Migration",
        "projectStartDate": "2026-01-15",
        "projectRole": "MEMBER",
        "status": "ACTIVE",
    },
    ("PATCH", "/api/v1/employees/{employee_id}/projects/{project_id}"): {
        "endDate": "2026-01-15",
    },
    ("POST", "/api/v1/employees/{employee_id}/profile-changes"): {
        "addressLine1": "123 Main St",
        "city": "Austin",
        "state": "TX",
        "postalCode": "73301",
        "country": "US",
    },
    ("POST", "/api/v1/employees/{employee_id}/profile-changes/{change_id}/approve"): {
        "comments": "Looks good",
    },
    ("POST", "/api/v1/employees/{employee_id}/profile-changes/{change_id}/reject"): {
        "comments": "Address could not be verified",
    },
    ("POST", "/api/v1/employees/{employee_id}/correction-requests"): {
        "fieldName": "lastName",
        "requestedValue": "Smith",
        "note": "Legal name change after marriage",
    },
    ("POST", "/api/v1/employees/correction-requests/{request_id}/approve"): {
        "note": "Verified with legal documents",
    },
    ("POST", "/api/v1/employees/correction-requests/{request_id}/reject"): {
        "note": "Supporting document missing",
    },
    ("POST", "/api/v1/employees/{employee_id}/skills"): {
        "skillIds": [_ID],
        "proficiency": "INTERMEDIATE",
        "yearsExperience": 3,
    },
    ("PATCH", "/api/v1/employees/{employee_id}/skills/{skill_id}"): {
        "proficiency": "EXPERT",
        "yearsExperience": 5,
    },
    # --- Company and org setup ---
    # Single-company platform: creation always returns 410.
    ("POST", "/api/v1/companies"): {
        "companyName": "Acme Corp",
        "companyType": "LLC",
        "companyEmail": "jane.doe@example.com",
    },
    ("PATCH", "/api/v1/companies/{company_id}"): {
        "companyName": "Acme Corp",
        "companyWebsite": "https://acme.example.com",
        "timesheetHoursFormat": "decimal",
    },
    ("POST", "/api/v1/departments"): {"departmentName": "Engineering"},
    ("PATCH", "/api/v1/departments/{department_id}"): {
        "departmentName": "Platform Engineering",
        "departmentHeadId": _ID,
    },
    # US locations also require city, state and a 5-digit zip.
    ("POST", "/api/v1/locations"): {
        "locationName": "New York HQ",
        "addressLine1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zip": "10001",
        "country": "US",
        "timezone": "America/New_York",
    },
    ("PATCH", "/api/v1/locations/{location_id}"): {
        "locationName": "New York Office",
        "locationType": "HQ",
    },
    ("POST", "/api/v1/designations"): {
        "title": "Software Engineer",
        "jobFamily": "Engineering",
    },
    ("PATCH", "/api/v1/designations/{designation_id}"): {
        "title": "Senior Software Engineer",
    },
    ("POST", "/api/v1/national-id-document-types"): {
        "documentTypeCode": "DRIVERS_LICENSE",
        "documentTypeLabel": "Driver's license",
        "countryCode": "US",
    },
    ("PATCH", "/api/v1/national-id-document-types/{document_type_id}"): {
        "documentTypeLabel": "Driver's License",
        "format": "^[A-Z0-9]{5,20}$",
    },
    ("PATCH", "/api/v1/config"): [{"id": _ID, "value": "EDIT"}],
    ("POST", "/api/v1/config/emails"): {
        "type": "EMAIL",
        "parameter": "HR_NOTIFICATION_EMAIL",
        "value": "jane.doe@example.com",
    },
    ("POST", "/api/v1/config/job-family"): [
        {"type": "JOB_FAMILY", "parameter": "Engineering", "value": "Software, QA, DevOps"},
    ],
    ("POST", "/api/v1/config/hierarchy"): [{"parameter": "LEVEL_1", "value": "MANAGER"}],
    # --- RBAC ---
    # moduleId / submoduleId are integer MODULE_ID / SUBMODULE_ID values
    # (GET /api/v1/rbac/modules), e.g. 9 = Company Setup, 6 = Departments.
    ("PUT", "/api/v1/rbac/employees/{employee_id}/grants"): {
        "moduleId": 9,
        "submoduleIds": [6],
        "accessLevel": "full_access",
    },
    ("PUT", "/api/v1/rbac/employees/{employee_id}/access"): {
        "grants": [{"moduleId": 9, "submoduleId": 6, "accessLevel": "read_only"}],
    },
    ("PATCH", "/api/v1/rbac/employees/{employee_id}/grants/{grant_id}"): {
        "accessLevel": "read_only",
    },
    ("POST", "/api/v1/users"): {
        "email": "jane.doe@example.com",
        "password": "ChangeMe123!",
        "role": "EMPLOYEE",
    },
    ("PATCH", "/api/v1/users/{user_id}"): {"role": "HR", "editAccess": True},
    # --- Clients and projects ---
    # locations (with country) is required unless isInternal is true.
    ("POST", "/api/v1/clients"): {
        "clientName": "Acme Corp",
        "industry": "Healthcare",
        "locations": [
            {
                "locationName": "Headquarters",
                "country": "United States",
                "stateProvince": "TX",
                "city": "Dallas",
                "address": "100 Main St",
                "zip": "75201",
                "region": "NA",
            }
        ],
        "stakeholders": [
            {
                "name": "Jane Doe",
                "title": "Procurement Manager",
                "email": "jane.doe@example.com",
                "phoneNumber": "+1-214-555-0100",
            }
        ],
    },
    # Sending locations or stakeholders re-validates the full client.
    ("PATCH", "/api/v1/clients/{client_id}"): {
        "clientName": "Acme Corporation",
        "customerNetTerm": "45",
    },
    ("POST", "/api/v1/clients/{client_id}/invoices"): {
        "employeeId": _ID,
        "projectName": "Customer Portal Revamp",
        "invoiceNumber": "INV-2026-0001",
        "invoiceMonthandYear": "January 2026",
        "invoicedDate": "2026-01-31",
        "netTerm": "30",
        "invoiceDueDate": "2026-03-02",
        "invoiceRate": "85",
        "invoiceHours": "160",
        "invoicedAmount": 13600,
    },
    ("PATCH", "/api/v1/clients/invoices/{invoice_id}"): {
        "invoiceStatus": "PAID",
        "invoicedAmount": 13600,
    },
    ("POST", "/api/v1/projects"): {
        "projectName": "Customer Portal Revamp",
        "clientId": _ID,
        "billingType": "Per HR",
        "projectCode": "CPR2026",
        "projectType": "Development",
        "region": "NA",
        "status": "ACTIVE",
        "projectStartdate": "2026-01-15",
        "plannedEndDate": "2026-12-31",
    },
    ("PATCH", "/api/v1/projects/{project_id}"): {
        "projectName": "Customer Portal Revamp Phase 2",
        "status": "ON_HOLD",
        "plannedEndDate": "2027-03-31",
    },
    ("PUT", "/api/v1/projects/{project_id}/allocations"): {
        "allocations": [
            {
                "employeeId": _ID,
                "roleOnProject": "Backend Developer",
                "allocationPercentage": 100,
                "startDate": "2026-01-15",
                "billable": True,
                "billabilityPercentage": 100,
            }
        ],
    },
    ("POST", "/api/v1/projects/{project_id}/allocations/{allocation_id}/end"): {
        "endDate": "2026-06-30",
    },
    # --- Vendors ---
    ("POST", "/api/v1/vendors"): {
        "vendorName": "Globex Staffing LLC",
        "vendorType": "Staffing",
        "contactName": "Jane Doe",
        "designation": "Account Manager",
        "ein": "123456789",
        "vendorNetTerm": "30",
        "msaStartDate": "2026-01-15",
        "msaEndDate": "2027-01-14",
    },
    ("PATCH", "/api/v1/vendors/{vendor_id}"): {
        "contactName": "John Smith",
        "vendorNetTerm": "45",
    },
    ("POST", "/api/v1/vendors/{vendor_id}/invoices"): {
        "employeeId": _ID,
        "billNumber": "BILL-2026-0001",
        "invoiceMonthandYear": "January 2026",
        "billDate": "2026-01-31",
        "netTerm": "30",
        "dueDate": "2026-03-02",
        "invoiceRate": "70",
        "invoiceHours": "160",
        "invoicedAmount": 11200,
    },
    ("PATCH", "/api/v1/vendors/invoices/{invoice_id}"): {
        "invoiceStatus": "PAID",
        "invoicedAmount": 11200,
    },
    # --- Assets ---
    # serialNumber is required for the Laptop and Mobile categories.
    ("POST", "/api/v1/assets"): {
        "categoryId": _ID,
        "serialNumber": "C02XL0GHJGH5",
        "model": "MacBook Pro 14",
        "osPlatform": "Mac",
        "specifications": "16GB RAM / 512GB SSD",
        "condition": "New",
        "purchaseDate": "2026-01-15",
        "warrantyExpiry": "2027-01-15",
    },
    ("POST", "/api/v1/assets/{system_asset_id}/allocate"): {
        "employeeId": _ID,
        "allocatedDate": "2026-01-15",
    },
    ("POST", "/api/v1/assets/allocations/{allocation_id}/return"): {
        "reasonForReturn": "Employee terminated",
        "conditionAtReturn": "Good",
        "returnedDate": "2026-01-15",
        "returnNotes": "Returned with charger",
    },
    ("POST", "/api/v1/assets/allocations/{allocation_id}/swap"): {
        "systemAssetId": _ID,
        "reasonForReturn": "Upgrade",
        "conditionAtReturn": "Good",
        "returnedDate": "2026-01-15",
        "allocatedDate": "2026-01-15",
    },
    # categoryId, assetId and status cannot be changed here.
    ("PATCH", "/api/v1/assets/{system_asset_id}"): {
        "model": "MacBook Pro 16",
        "condition": "Good",
        "warrantyExpiry": "2027-06-30",
    },
    ("POST", "/api/v1/assets/{system_asset_id}/report-lost"): {
        "reason": "Stolen",
        "lostDate": "2026-01-15",
        "notes": "Stolen from vehicle",
    },
    ("POST", "/api/v1/assets/{system_asset_id}/mark-found"): {
        "condition": "Good",
        "notes": "Found in meeting room",
    },
    # --- Expenses and payroll ---
    ("POST", "/api/v1/expenses"): [
        {
            "employeeId": _ID,
            "paymentDate": "2026-01-15",
            "expenseType": "Travel",
            "expenseCost": 250.75,
        }
    ],
    ("PATCH", "/api/v1/expenses/{expense_id}"): {"expenseCost": 300.0, "status": "APPROVED"},
    ("POST", "/api/v1/payrolls"): [
        {"employeeId": _ID, "paymentDate": "2026-01-15", "amount": 5000},
    ],
    ("PATCH", "/api/v1/payrolls/{payroll_id}"): {"amount": 5200, "status": "PAID"},
    # --- Schedule ---
    ("POST", "/api/v1/schedule"): {
        "title": "Sprint Planning",
        "date": "2026-01-15",
        "startTime": "10:00",
        "endTime": "11:00",
        "kind": "meeting",
    },
    ("PATCH", "/api/v1/schedule/{event_id}"): {
        "title": "Sprint Planning (Rescheduled)",
        "startTime": "14:00",
        "endTime": "15:00",
    },
    # --- Skills catalog (currently locked: returns 403) ---
    ("POST", "/api/v1/skills"): {"skillName": "Python"},
    ("POST", "/api/v1/skills/merge"): {"fromSkillId": _ID, "keepSkillId": _ID_2},
    ("PATCH", "/api/v1/skills/{skill_id}"): {"skillName": "Python 3"},
    # --- Timesheets ---
    # Every workDate must fall inside the timesheet's week; max 24h per day.
    ("PUT", "/api/v1/timesheet-weeks/{timesheet_id}"): {
        "lines": [
            {
                "projectCodeCategory": "Other",
                "otherType": "Research",
                "billable": False,
                "entries": [
                    {"workDate": "2026-01-15", "hours": 8, "comment": "Market research"},
                ],
            },
        ],
    },
    ("POST", "/api/v1/timesheet-weeks/approve-batch"): {"timesheetIds": [_ID]},
    ("POST", "/api/v1/timesheet-weeks/{timesheet_id}/reject"): {
        "comments": "Please correct Friday's hours.",
    },
    # --- Notification templates ---
    # Only the template's own {placeholders} are allowed in subject/body.
    ("PUT", "/api/v1/notifications/templates/{key}"): {
        "subject": "[EAOVA] Update on your request",
        "body": "Hello,\n\nYour request has been updated.\n\nThank you.",
    },
    ("POST", "/api/v1/notifications/templates/{key}/preview"): {
        "subject": "[EAOVA] Update on your request",
        "body": "Hello,\n\nYour request has been updated.\n\nThank you.",
    },
    ("POST", "/api/v1/notifications/templates/{key}/send-test"): {
        "toEmail": "jane.doe@example.com",
    },
    # --- Leave ---
    ("POST", "/api/v1/leave-policies"): {
        "policyName": "Standard Leave Policy 2026",
        "policyStartYear": 2026,
        "policyEndYear": 2026,
        "lines": [{"leaveTypeId": _ID, "daysAllowed": 12, "rolloverAllowed": False}],
    },
    ("PATCH", "/api/v1/leave-policies/{policy_id}/days"): {
        "lines": [{"policyLineId": _ID, "daysAllowed": 15}],
    },
    ("PATCH", "/api/v1/leave-policies/{policy_id}/status"): {"status": "Inactive"},
    ("POST", "/api/v1/leave-requests/preview"): {
        "leaveTypeId": _ID,
        "fromDate": "2026-01-15",
        "toDate": "2026-01-16",
    },
    ("POST", "/api/v1/leave-requests"): {
        "leaveTypeId": _ID,
        "fromDate": "2026-01-15",
        "toDate": "2026-01-16",
        "reason": "Family event",
    },
    ("PUT", "/api/v1/leave-requests/{leave_request_id}"): {
        "leaveTypeId": _ID,
        "fromDate": "2026-01-15",
        "toDate": "2026-01-16",
        "reason": "Family event",
    },
    ("POST", "/api/v1/leave-approvals/{leave_request_id}/reject"): {
        "reason": "Team coverage is insufficient on these dates.",
    },
    # holidayYear must be the current or next year and match holidayDate.
    ("POST", "/api/v1/holidays"): {
        "holidayYear": 2026,
        "holidayName": "Company Foundation Day",
        "holidayType": "Company Holiday",
        "holidayDate": "2026-01-15",
    },
    ("PUT", "/api/v1/holidays/{holiday_id}"): {
        "holidayYear": 2026,
        "holidayName": "Company Foundation Day",
        "holidayType": "Company Holiday",
        "holidayDate": "2026-01-15",
    },
}


def install_request_examples(app: FastAPI) -> None:
    """Attach REQUEST_EXAMPLES to the JSON request bodies in the OpenAPI schema."""
    build_schema = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = build_schema()
        for (method, path), example in REQUEST_EXAMPLES.items():
            operation = schema.get("paths", {}).get(path, {}).get(method.lower())
            if not operation:
                continue
            content = operation.get("requestBody", {}).get("content", {})
            if "application/json" in content:
                content["application/json"]["example"] = example
        return schema

    app.openapi = openapi  # type: ignore[method-assign]
