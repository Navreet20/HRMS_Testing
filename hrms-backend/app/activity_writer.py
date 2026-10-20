"""The one way to write an activity log row. Every module uses write_log(); it refuses a record type, an action
or a details field that is not on the lists below, so a sensitive value cannot slip into the log by accident.

To log a new record type, add it to ALLOWED_FIELDS with its reviewed field list (and the word to
the README). Sensitive data is never logged as a value: log VIEWED_SENSITIVE with no details.
The database adds a second layer: a 4 KB size limit and a refusal of known sensitive key names.
"""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import SENSITIVE_KEYS, ActivityLog

ALLOWED_FIELDS: dict[str, frozenset[str]] = {
    "asset": frozenset({"asset_category_id", "serial_number", "model", "os_platform", "condition", "status",
                        "purchase_date", "warranty_expiry", "warranty_plan_type", "purchase_receipt_file_name"}),
    "asset_assignment": frozenset({"asset_id", "assigned_to_employee_id", "assigned_date", "returned_date",
                                   "return_reason", "condition_at_return", "replaces_assignment_id"}),
    "location": frozenset({"name", "city", "state", "country_code", "timezone", "is_active"}),
    "department": frozenset({"name", "parent_department_id", "head_employee_id", "is_active"}),
    "designation": frozenset({"name", "is_active"}),
    "leave_policy": frozenset({"name", "start_year", "end_year", "is_active", "lines"}),
    "company": frozenset({"name", "company_type", "location_id", "asset_code_prefix",
                          "timesheet_reminder_weekday", "timesheet_hours_format"}),
    "company_holiday": frozenset({"holiday_date", "name", "holiday_type"}),
    # Personal fields (date of birth, personal email and phones, ethnicity, national ID) are never listed: a change
    # to one is logged as "updated" with no details, a look at one as "viewed_sensitive".
    # The grant_* keys are for access_granted / access_changed / access_revoked (logged against the employee).
    "employee": frozenset({"first_name", "middle_name", "last_name", "employee_code", "status", "official_email",
                           "work_mode", "department_id", "location_id", "designation_id", "employment_type",
                           "reporting_manager_id", "date_of_joining", "payroll_start_date", "leave_policy_id",
                           "timesheet_required", "role",
                           "grant_id", "module_key", "submodule_key", "access_level", "previous_access_level"}),
    "address": frozenset({"city", "state", "country_code"}),
    "emergency_contact": frozenset({"contact_order", "name", "relation"}),
    "onboarding_document": frozenset({"document_type", "version_number"}),
    "skill": frozenset({"name"}),
    "employee_skill": frozenset({"skill_id", "proficiency", "years_experience", "certificate_name",
                                 "certificate_expires_on"}),
    "national_id_document_type": frozenset({"document_type_code", "document_type_label", "country_code",
                                            "number_format", "is_active"}),
    "client": frozenset({"client_code", "client_name", "industry", "account_owner", "client_category",
                         "status", "logo_object_key"}),
    "client_location": frozenset({"client_id", "office_location_id", "location_name", "address_line_1",
                                  "address_line_2", "city", "state_province", "zip", "country"}),
    # No description: it is unlimited text, and its old and new values could pass the 4 KB details limit.
    "project": frozenset({"project_number", "project_code", "client_id", "name", "project_type", "region",
                          "billing_type", "end_customer_name", "status", "start_date", "planned_end_date",
                          "actual_end_date"}),
    "project_member": frozenset({"project_id", "employee_id", "role"}),
    "project_stakeholder": frozenset({"project_id", "name", "title", "department", "email", "phone_number"}),
    "allocation": frozenset({"project_id", "employee_id", "role_on_project", "allocation_percentage", "is_billable",
                             "billable_percentage", "start_date", "end_date", "client_location_id",
                             "work_office_location_id", "work_address_id"}),
}

ACTIONS = frozenset({
    "created", "updated", "deactivated", "reactivated", "deleted", "viewed_sensitive",
    "assigned", "returned", "swapped", "marked_lost", "marked_found", "sent_for_repair", "decommissioned",
    "submitted", "recalled", "approved", "rejected", "completed", "resubmitted", "reopened",
    "access_granted", "access_changed", "access_revoked",
})


def check_details(entity_type: str, action: str, details: dict | None) -> None:
    """Raise ValueError unless the record type, the action and every field in details are allowed."""
    if entity_type not in ALLOWED_FIELDS:
        raise ValueError(f"entity_type {entity_type!r} is not allowed in the activity log")
    if action not in ACTIONS:
        raise ValueError(f"action {action!r} is not an agreed activity log word")
    if details is None:
        return
    if action == "viewed_sensitive":
        raise ValueError("viewed_sensitive is logged without details")
    for key in details:
        if key in SENSITIVE_KEYS:
            raise ValueError(f"{key!r} is sensitive and must never be logged")
        if key not in ALLOWED_FIELDS[entity_type]:
            raise ValueError(f"field {key!r} is not allowed for {entity_type!r}")


async def write_log(session: AsyncSession, *, action: str, entity_type: str, entity_id: uuid.UUID,
                    actor_employee_id: uuid.UUID | None = None, details: dict | None = None,
                    request_id: uuid.UUID | None = None) -> ActivityLog:
    """Add one activity log row to the session (the caller commits, in the same transaction as the change)."""
    check_details(entity_type, action, details)
    row = ActivityLog(action=action, entity_type=entity_type, entity_id=entity_id,
                      actor_employee_id=actor_employee_id, details=details, request_id=request_id)
    session.add(row)
    return row
