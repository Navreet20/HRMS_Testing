from datetime import date, datetime
from typing import Any
from uuid import UUID
import json

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import NoInspectionAvailable

from app.modules.clients.display_ids import (
    CLIENT_DISPLAY_PREFIX,
    LOCATION_DISPLAY_PREFIX,
    STAKEHOLDER_DISPLAY_PREFIX,
    normalize_display_id,
)
from app.modules.employee.profile_fields import profile_fields_to_dict
from app.modules.employee.status import employee_status_for_api


def _iso(value: Any) -> str | None:
    """Dates / datetimes as ISO strings (JWT claims and JSON must not carry date objects)."""
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def location_address_label(location: Any | None) -> str | None:
    """Compact address from a locations row; falls back to the location name."""
    if location is None:
        return None
    parts: list[str] = []
    for attr in (
        "address_line_1",
        "address_line_2",
        "city",
        "state",
        "postal_code",
        "country_code",
    ):
        text = str(getattr(location, attr, None) or "").strip()
        if text:
            parts.append(text)
    if parts:
        return ", ".join(parts)
    name = str(getattr(location, "name", None) or "").strip()
    return name or None


def _address_part(source: Any, *names: str) -> str:
    for name in names:
        raw = source.get(name) if isinstance(source, dict) else getattr(source, name, None)
        text = str(raw or "").strip()
        if text:
            return text
    return ""


def personal_address_label(address: Any | None) -> str | None:
    """Compact personal/home address from an ADDRESS row or contact dict."""
    if address is None:
        return None
    parts: list[str] = []
    for names in (
        ("address_line1", "addressLine1", "address_line_1"),
        ("address_line2", "addressLine2", "address_line_2"),
        ("city",),
        ("state",),
        ("zip_code", "postalCode", "zip"),
        ("country",),
    ):
        text = _address_part(address, *names)
        if text:
            parts.append(text)
    return ", ".join(parts) if parts else None


def preferred_personal_address(addresses: Any) -> Any | None:
    """Pick the HOME/ACTIVE personal address when an employee has several."""
    rows = [row for row in list(addresses or []) if row is not None]
    if not rows:
        return None

    def score(row: Any) -> tuple[int, int, int]:
        if isinstance(row, dict):
            typ = str(row.get("addressType") or row.get("address_type") or "").upper()
            status = str(row.get("status") or "").upper()
            line = _address_part(row, "addressLine1", "address_line1")
            city = _address_part(row, "city")
        else:
            typ = str(getattr(row, "address_type", None) or "").upper()
            status = str(getattr(row, "status", None) or "").upper()
            line = _address_part(row, "address_line1", "addressLine1")
            city = _address_part(row, "city")
        return (
            1 if line or city else 0,
            1 if typ in {"HOME", "PERSONAL"} else 0,
            1 if status in {"ACTIVE", "ACT"} else 0,
        )

    return max(rows, key=score)


def _skill_certificate_fields(row: Any) -> dict[str, Any]:
    object_key = getattr(row, "certificate_object_key", None) or None
    file_name = getattr(row, "certificate_file_name", None) or None
    cert_name = getattr(row, "certificate_name", None) or None
    if not isinstance(object_key, str) or not object_key.strip():
        object_key = None
    if not isinstance(file_name, str) or not file_name.strip():
        file_name = None
    if not isinstance(cert_name, str) or not cert_name.strip():
        cert_name = None
    expires = getattr(row, "certificate_expires_on", None)
    expires_on: str | None = None
    if isinstance(expires, datetime):
        expires_on = expires.date().isoformat()
    elif isinstance(expires, date):
        expires_on = expires.isoformat()
    elif isinstance(expires, str) and expires.strip():
        expires_on = expires.strip()[:10]
    return {
        "hasCertificate": bool(object_key or cert_name),
        "certificateName": cert_name,
        "certificateExpiresOn": expires_on,
        "certificateFileName": file_name,
        "certificateObjectKey": object_key,
    }


def _employee_skills(emp: Any) -> list[dict[str, Any]]:
    rows = _rel_if_loaded(emp, "employee_skills")
    if not rows:
        return []
    skills: list[dict[str, Any]] = []
    for row in rows:
        skill = getattr(row, "skill", None)
        skills.append(
            {
                "skillId": str(row.skill_id),
                "skillName": getattr(skill, "skill_name", None),
                "proficiency": row.proficiency,
                "yearsExperience": row.years_experience,
                **_skill_certificate_fields(row),
            }
        )
    return skills


def _rel_if_loaded(obj: Any, name: str) -> Any:
    """Read a relationship only if already loaded (avoids async MissingGreenlet)."""
    try:
        state = sa_inspect(obj)
    except NoInspectionAvailable:
        return getattr(obj, name, None)
    if name in state.unloaded:
        return None
    return getattr(obj, name, None)


_ALLOWED_QUICK_ACTIONS = frozenset(
    {
        "employees",
        "attendance",
        "attendanceApprovals",
        "leavesApply",
        "leavesApprovals",
        "projects",
        "projectsMine",
        "schedule",
    }
)


def parse_quick_actions_preference(raw: Any) -> list[str] | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        values = raw
    elif isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = [part.strip() for part in text.split(",") if part.strip()]
        values = parsed if isinstance(parsed, list) else None
        if values is None:
            return None
    else:
        return None
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in values:
        if not isinstance(item, str):
            continue
        key = item.strip()
        if key not in _ALLOWED_QUICK_ACTIONS or key in seen:
            continue
        seen.add(key)
        cleaned.append(key)
    return cleaned


def employee_to_dict(
    emp: Any,
    access: Any | None = None,
    company: Any | None = None,
    *,
    contact: dict[str, Any] | None = None,
    pending_profile_change: bool | None = None,
    include_full_national_id: bool = False,
) -> dict[str, Any]:
    org_dept = _rel_if_loaded(emp, "org_department")
    work_loc = _rel_if_loaded(emp, "work_location")
    designation = _rel_if_loaded(emp, "designation")
    leave_policy = _rel_if_loaded(emp, "leave_policy")
    department_id = getattr(emp, "department_id", None)
    location_id = getattr(emp, "location_id", None)
    designation_id = getattr(emp, "designation_id", None)
    reporting_manager_id = getattr(emp, "reporting_manager_id", None)
    personal_email = getattr(emp, "personal_email", None)
    email_id = emp.email_id
    # EMP-DATA-9: drafts use a placeholder official email until Invite.
    status_val = str(getattr(emp, "status", "") or "")
    email_lower = str(email_id or "").strip().lower()
    if (
        status_val == "NEW"
        and email_lower.startswith("draft+")
        and email_lower.endswith("@hrms.local")
    ):
        email_id = None
    leave_policy_id = getattr(emp, "leave_policy_id", None)
    data: dict[str, Any] = {
        "employeeId": str(emp.employee_id),
        "businessEmployeeId": getattr(emp, "business_employee_id", None),
        "employeeCode": emp.employee_code,
        "firstName": emp.first_name,
        "middleName": emp.middle_name,
        "lastName": emp.last_name,
        # Legacy access string (role bucket); org unit is departmentId/departmentName.
        "department": emp.department,
        "departmentId": str(department_id) if department_id else None,
        "departmentName": org_dept.department_name if org_dept is not None else None,
        "locationId": str(location_id) if location_id else None,
        "locationName": work_loc.location_name if work_loc is not None else None,
        "locationAddress": location_address_label(work_loc),
        "personalAddress": None,
        "personalAddressId": None,
        "designationId": str(designation_id) if designation_id else None,
        "designationTitle": designation.title if designation is not None else None,
        "designationJobFamily": getattr(designation, "job_family", None) if designation is not None else None,
        "skills": _employee_skills(emp),
        # Company name on EMPLOYEE.COMPANY (string); catalog UUID is separate.
        "company": emp.company,
        "jobDescription": getattr(emp, "job_description", None),
        "role": emp.role,
        "gender": emp.gender,
        "dateOfBirth": _iso(emp.date_of_birth),
        "phoneNumber": emp.phone_number,
        "emailId": email_id,
        "personalEmail": personal_email,
        "employmentType": emp.employment_type,
        "vendor": getattr(emp, "vendor", None),
        "jobRank": getattr(emp, "job_rank", None),
        "status": employee_status_for_api(emp.status),
        "employmentStartDate": _iso(emp.employment_start_date),
        "dateOfJoining": _iso(emp.employment_start_date),
        "employmentEndDate": getattr(emp, "employment_end_date", None),
        "employeeImmigrationStatus": getattr(emp, "employee_immigration_status", None),
        "reportingManagerId": str(reporting_manager_id) if reporting_manager_id else None,
        "leavePolicyName": (
            leave_policy.policy_name
            if leave_policy is not None and leave_policy_id is not None
            else None
        ),
        "isSystemAccount": bool(getattr(emp, "is_system_account", False)),
        "avatarObjectKey": getattr(emp, "avatar_object_key", None) or None,
        "photoUrl": getattr(emp, "avatar_object_key", None) or None,
        "createdBy": getattr(emp, "created_by", None),
        "updatedBy": getattr(emp, "updated_by", None),
        "createdDate": _dt(getattr(emp, "created_date", None)),
        "updatedDate": _dt(getattr(emp, "updated_date", None)),
    }
    data.update(
        profile_fields_to_dict(emp, include_full_national_id=include_full_national_id)
    )
    if access is not None:
        data["userAccess"] = {
            "createAccess": access.create_access,
            "viewAccess": access.view_access,
            "editAccess": access.edit_access,
            "fullAccess": access.full_access,
        }
    if contact is not None:
        data["contact"] = contact
    if pending_profile_change is not None:
        data["pendingProfileChange"] = pending_profile_change
    personal_source = contact
    if personal_source is None:
        personal_source = preferred_personal_address(_rel_if_loaded(emp, "addresses") or [])
    data["personalAddress"] = personal_address_label(personal_source)
    personal_id = None
    if isinstance(contact, dict) and contact.get("addressId"):
        personal_id = str(contact.get("addressId"))
    elif personal_source is not None and not isinstance(personal_source, dict):
        addr_id = getattr(personal_source, "address_id", None)
        if addr_id:
            personal_id = str(addr_id)
    data["personalAddressId"] = personal_id
    return data


def profile_change_to_dict(row: Any) -> dict[str, Any]:
    payload: Any = {}
    raw = getattr(row, "payload", None)
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                payload = parsed
        except json.JSONDecodeError:
            payload = {}
    return {
        "id": str(row.id),
        "employeeId": str(row.employee_id),
        "payload": payload,
        "status": row.status,
        "comments": row.comments,
        "createdBy": row.created_by,
        "reviewedBy": row.reviewed_by,
        "createdDate": _dt(row.created_date),
        "updatedDate": _dt(row.updated_date),
    }


def correction_request_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "employeeId": str(row.employee_id),
        "fieldName": row.field_name,
        "requestedValue": row.requested_value,
        "note": row.note,
        "status": row.status,
        "reviewedBy": row.reviewed_by,
        "createdAt": _dt(row.created_at),
        "updatedAt": _dt(row.updated_at),
    }


def _decision_fields(row: Any) -> dict[str, Any]:
    """How a manager decided a request: their comment, who, and when."""
    note = getattr(row, "decision_note", None)
    by_name = getattr(row, "decided_by_name", None)
    decided = getattr(row, "decided_date", None) or getattr(row, "decided_at", None)
    return {
        "decisionNote": note if isinstance(note, str) and note else None,
        "decidedByName": by_name if isinstance(by_name, str) and by_name else None,
        "decidedDate": _dt(decided),
    }


def profile_update_request_to_dict(row: Any) -> dict[str, Any]:
    short_description = getattr(row, "short_description", None)
    submitted_by_employee_id = getattr(row, "submitted_by_employee_id", None)
    return {
        "id": str(row.id),
        "employeeId": str(row.employee_id),
        "submittedByEmployeeId": (
            str(submitted_by_employee_id)
            if isinstance(submitted_by_employee_id, UUID)
            else None
        ),
        "fieldChanged": row.field_changed,
        "oldValue": row.old_value,
        "newValue": row.new_value,
        "shortDescription": (
            short_description
            if isinstance(short_description, str) and short_description
            else row.new_value
        ),
        "longDescription": (
            row.long_description
            if isinstance(getattr(row, "long_description", None), str)
            else None
        ),
        "attachmentFileName": (
            row.attachment_file_name
            if isinstance(getattr(row, "attachment_file_name", None), str)
            else None
        ),
        "hasAttachment": bool(getattr(row, "attachment_object_key", None)),
        "status": row.status,
        "requestedDate": _dt(row.requested_date),
        "createdDate": _dt(row.created_date),
        "updatedDate": _dt(row.updated_date),        **_decision_fields(row),
    }


def asset_request_to_dict(row: Any) -> dict[str, Any]:
    submitted_by_employee_id = getattr(row, "submitted_by_employee_id", None)
    requested_category_id = getattr(row, "requested_category_id", None)
    requested_category = getattr(row, "requested_category", None)
    category_name = None
    if requested_category is not None:
        category_name = getattr(requested_category, "category_name", None)
    return {
        "id": str(row.id),
        "employeeId": str(row.employee_id),
        "submittedByEmployeeId": (
            str(submitted_by_employee_id)
            if isinstance(submitted_by_employee_id, UUID)
            else None
        ),
        "requestType": row.request_type,
        "systemAssetId": str(row.system_asset_id) if row.system_asset_id else None,
        "categoryId": (
            str(requested_category_id)
            if isinstance(requested_category_id, UUID)
            else None
        ),
        "categoryName": category_name,
        "newAssetDetails": row.new_asset_details,
        "status": row.status,
        "requestedDate": _dt(row.requested_date),
        "createdDate": _dt(row.created_date),
        "updatedDate": _dt(row.updated_date),        "fulfilledSystemAssetId": (
            str(getattr(row, "fulfilled_system_asset_id", None))
            if isinstance(getattr(row, "fulfilled_system_asset_id", None), UUID)
            else None
        ),
        **_decision_fields(row),
    }


def it_request_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "employeeId": str(row.employee_id),
        "category": row.category,
        "details": row.details,
        "status": row.status,
        "requestedDate": _dt(row.requested_date),
        "createdDate": _dt(row.created_date),
        "updatedDate": _dt(row.updated_date),        **_decision_fields(row),
    }


def user_details_from_employee(
    emp: Any,
    access: Any | None,
    company: Any | None = None,
    *,
    access_grants: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "employeeId": str(emp.employee_id),
        "firstName": emp.first_name,
        "lastName": emp.last_name,
        "emailId": emp.email_id,
        "department": emp.department,
        "createAccess": access.create_access if access else False,
        "editAccess": access.edit_access if access else False,
        "viewAccess": access.view_access if access else False,
        "fullAccess": access.full_access if access else False,
        "status": employee_status_for_api(emp.status),
        "employeeType": emp.employment_type,
        "employeeStartDate": _iso(getattr(emp, "employment_start_date", None)),
        "employeeEndDate": _iso(getattr(emp, "employment_end_date", None)),
        "company": company,
        "role": emp.role,
        "themePreference": getattr(emp, "theme_preference", None) or "light",
        "quickActionsPreference": parse_quick_actions_preference(
            getattr(emp, "quick_actions_preference", None)
        ),
        # Always an array so FE can distinguish “loaded, empty” from legacy payloads.
        "accessGrants": list(access_grants or []),
    }


def timesheet_detail_to_dict(d: Any) -> dict[str, Any]:
    return {
        "timesheetDetailsId": str(d.timesheet_details_id),
        "date": d.date,
        "hoursWorked": d.hours_worked,
        "projectId": d.project_id,
        "projectName": d.project_name,
        "taskId": d.task_id,
        "taskName": d.task_name,
        "description": d.description,
    }


def timesheet_to_dict(ts: Any, details: list[Any] | None = None) -> dict[str, Any]:
    payload = {
        "timesheetId": str(ts.timesheet_id),
        "projectName": ts.project_name,
        "projectId": ts.project_id,
        "startDate": ts.start_date,
        "endDate": ts.end_date,
        "totalHours": ts.total_hours,
        "status": ts.status,
        "lastDecisionStage": ts.last_decision_stage,
        "lastDecisionComments": ts.last_decision_comments,
        "lastDecisionAt": _dt(ts.last_decision_at),
        "lastDecisionBy": ts.last_decision_by,
        "createdBy": ts.created_by,
        "updatedBy": ts.updated_by,
        "createdDate": _dt(ts.created_date),
        "updatedDate": _dt(ts.updated_date),
        "employeeId": str(ts.employee_id) if ts.employee_id else None,
    }
    if details is not None:
        payload["timesheetdetails"] = [timesheet_detail_to_dict(d) for d in details]
    return payload


def project_data_to_dict(p: Any) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "projectName": p.project_name,
        "projectStartDate": p.project_start_date,
        "projectEndDate": p.project_end_date,
        "projectRole": p.project_role,
        "status": p.status,
        "projectType": p.project_type,
        "employeeId": str(p.employee_id) if p.employee_id else None,
    }


def uuid_or_str(value: UUID | str) -> str:
    return str(value)


def company_to_dict(c: Any) -> dict[str, Any]:
    return {
        "companyId": str(c.id),
        "companyName": c.name,
        "companyType": c.company_type,
        "companyEmail": c.email,
        "companyPhone": c.phone,
        "companyWebsite": c.website,
        "companyAddressLine1": None,
        "companyAddressLine2": None,
        "city": None,
        "state": None,
        "zipcode": None,
        "country": None,
        "companyLogo": None,
        "logoObjectKey": getattr(c, "logo_object_key", None) or None,
        "headquartersLocationId": str(c.location_id) if getattr(c, "location_id", None) else None,
        "assetCodePrefix": getattr(c, "asset_code_prefix", None),
        "companyStatus": "ACTIVE",
        "timesheetReminderWeekday": int(getattr(c, "timesheet_reminder_weekday", 1) or 1),
        "timesheetExpectedWeeklyHours": 40.0,
        "timesheetHoursFormat": (
            "decimal" if getattr(c, "timesheet_hours_format", None) == "decimal" else "clock"
        ),
        "createdBy": None,
        "updatedBy": None,
        "createdDate": None,
        "updatedDate": None,
    }


def _iso_date(value: Any) -> str | None:
    return value.isoformat() if value else None


def project_to_dict(p: Any) -> dict[str, Any]:
    status = p.status
    if status and str(status).upper() == "INACTIVE":
        status = "CLOSED"
    planned = _iso_date(p.planned_end_date)
    return {
        "projectId": str(p.id),
        "projectDisplayId": p.project_number,
        "projectNumber": p.project_number,
        "projectName": p.name,
        "projectStartdate": _iso_date(p.start_date),
        "projectEnddate": planned,
        "status": status,
        "invoicePeriod": None,
        "endClientName": p.end_customer_name,
        "clientId": str(p.client_id) if getattr(p, "client_id", None) else None,
        "projectCode": p.project_code,
        "projectType": p.project_type,
        "region": p.region,
        "billingType": p.billing_type,
        "plannedEndDate": planned,
        "actualEndDate": _iso_date(p.actual_end_date),
        "description": p.description,
        "createdBy": None,
        "updatedBy": None,
        "createdDate": None,
        "updatedDate": None,
    }


def _account_owner_name(customer: Any) -> str | None:
    return None


def _client_ref(customer: Any) -> str | None:
    return getattr(customer, "client_code", None)


_CLIENT_ARCHIVED_ALIASES = frozenset({"INACTIVE", "ARCHIVED", "ARCHIVE"})


def client_status_to_api(raw: Any) -> str:
    """Stored client status as the API value: ACTIVE | INACTIVE (the old "Archived" label is input-only)."""
    value = str(raw or "").strip()
    if not value:
        return "ACTIVE"
    if value.upper() in _CLIENT_ARCHIVED_ALIASES:
        return "INACTIVE"
    if value.upper() == "ACTIVE":
        return "ACTIVE"
    return value


def client_category_to_api(raw: Any, is_internal: Any = False) -> str:
    """Stored client category (INTERNAL | DIRECT | INTERMEDIARY) -> internal | direct | intermediary."""
    value = str(raw or "").strip().lower()
    if value in {"internal", "direct", "intermediary"}:
        return value
    return "internal" if is_internal else "direct"


def client_status_from_api(raw: Any) -> str | None:
    """Map API/display client status to stored ACTIVE / INACTIVE."""
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None
    lowered = value.lower()
    if lowered in {"inactive", "archived", "archive"}:
        return "INACTIVE"
    if lowered in {"active"}:
        return "ACTIVE"
    return value.upper()


def client_to_dict(
    c: Any,
    *,
    locations: list[Any] | None = None,
    offices: dict[Any, Any] | None = None,
    stakeholders: list[Any] | None = None,
    owner_name: str | None = None,
) -> dict[str, Any]:
    """A clients row plus its pre-loaded client_locations / stakeholders (no lazy relationships)."""
    offices = offices or {}
    location_rows = []
    for link in locations or []:
        office = offices.get(link.office_location_id) if link.office_location_id else None
        location_rows.append(
            {
                "id": str(link.id),
                "clientLocationId": str(link.id),
                "locationId": str(link.office_location_id) if link.office_location_id else None,
                "locationName": link.location_name or (office.name if office is not None else None),
                "address": link.address_line_1 or (office.address_line_1 if office is not None else None),
                "addressLine1": link.address_line_1 or (office.address_line_1 if office is not None else None),
                "addressLine2": link.address_line_2 or (office.address_line_2 if office is not None else None),
                "city": link.city or (office.city if office is not None else None),
                "state": link.state_province or (office.state if office is not None else None),
                "stateProvince": link.state_province or (office.state if office is not None else None),
                "country": link.country or (office.country_code if office is not None else None),
                "zip": link.zip or (office.postal_code if office is not None else None),
                "region": None,
            }
        )
    category = str(c.client_category or "").upper()
    industry = getattr(c, "industry", None)
    return {
        "id": str(c.id),
        "customerId": str(c.id),
        "clientId": c.client_code,
        "clientCode": c.client_code,
        "status": client_status_to_api(c.status),
        "clientName": c.client_name,
        "customerName": c.client_name,
        "clientStatus": client_status_to_api(c.status),
        "customerStatus": client_status_to_api(c.status),
        "clientType": industry,
        "customerType": industry,
        "industry": industry,
        "accountOwnerId": str(c.account_owner) if getattr(c, "account_owner", None) else None,
        "accountOwnerName": owner_name,
        "isInternal": category == "INTERNAL",
        "clientCategory": client_category_to_api(category),
        "logoObjectKey": getattr(c, "logo_object_key", None) or None,
        "contactName": None,
        "designation": None,
        "contactEmail": None,
        "customerNetTerm": None,
        "msaStartDate": None,
        "msaEndDate": None,
        "locations": location_rows,
        "stakeholders": [
            {
                "id": str(row.id),
                "stakeholderId": getattr(row, "display_number", None),
                "name": row.name,
                "title": row.title,
                "department": getattr(row, "department", None),
                "email": getattr(row, "email", None),
                "phoneNumber": getattr(row, "phone_number", None),
            }
            for row in (stakeholders or [])
        ],
        "invoicingEntities": [],
        "createdBy": None,
        "updatedBy": None,
        "createdDate": None,
        "updatedDate": None,
    }


def vendor_to_dict(v: Any) -> dict[str, Any]:
    return {
        "vendorId": str(v.vendor_id),
        "vendorName": v.vendor_name,
        "vendorStatus": v.vendor_status,
        "vendorType": v.vendor_company_type,
        "contactName": v.vendor_company_contact_name,
        "designation": v.vendor_company_designation,
        "ein": v.vendor_ein_number,
        "vendorNetTerm": v.vendor_net_term,
        "msaStartDate": v.msa_start_date,
        "msaEndDate": v.msa_end_date,
        "createdBy": v.created_by,
        "updatedBy": v.updated_by,
        "createdDate": _dt(v.created_date),
        "updatedDate": _dt(v.updated_date),
    }


def expense_to_dict(e: Any) -> dict[str, Any]:
    return {
        "expensesId": str(e.expenses_id),
        "employeeId": str(e.employee_id) if e.employee_id is not None else None,
        "paymentDate": e.payment_date,
        "expenseType": e.expense_type,
        "expenseCost": float(e.expense_cost) if e.expense_cost is not None else None,
        "status": e.status,
        "createdBy": e.created_by,
        "updatedBy": e.updated_by,
        "createdDate": _dt(e.created_date),
        "updatedDate": _dt(e.updated_date),
    }


def payroll_to_dict(p: Any) -> dict[str, Any]:
    return {
        "payrollId": str(p.payroll_id),
        "employeeId": str(p.employee_id) if p.employee_id is not None else None,
        "paymentDate": p.payment_date,
        "periodType": p.period_type,
        "period": p.period,
        "amount": float(p.amount) if p.amount is not None else None,
        "hrs": float(p.hrs) if p.hrs is not None else None,
        "payrate": float(p.payrate) if p.payrate is not None else None,
        "status": p.status,
        "createdBy": p.created_by,
        "updatedBy": p.updated_by,
        "createdDate": _dt(p.created_date),
        "updatedDate": _dt(p.updated_date),
    }


def config_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "type": row.type,
        "parameter": row.parameter,
        "value": row.value,
    }


def department_config_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "department": row.department,
        "type": row.type,
        "value": row.value,
    }


def legacy_user_to_dict(u: Any) -> dict[str, Any]:
    return {
        "userId": str(u.user_id),
        "email": u.email,
        "role": u.role,
        "createAccess": u.create_access,
        "viewAccess": u.view_access,
        "editAccess": u.edit_access,
        "fullAccess": u.full_access,
        "userStatus": u.user_status,
    }
