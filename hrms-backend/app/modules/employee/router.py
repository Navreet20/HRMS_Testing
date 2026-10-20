"""Lean Employees HTTP surface (~22 endpoints).

Architecture
------------
GET/POST       /employees
POST           /employees/drafts             # EMP-DATA-11 save draft
POST           /employees/code-preview       # best-effort name-based code (no write)
GET/PATCH/DELETE /employees/{id}
POST           /employees/{id}/transitions   # draft|invite|approve|reject|toggle_status|offboard|rehire
GET/POST       /employees/{id}/projects
GET/POST       /employees/{id}/skills
PATCH/DELETE   /employees/{id}/skills/{skillId}
GET/POST/DELETE /employees/{id}/skills/{skillId}/certificate
PATCH/DELETE   /employees/{id}/projects/{projectId}
GET/POST       /employees/{id}/documents
GET/POST       /employees/{id}/onboarding-packets[/{type}]  # NDA/W-4/bank/handbook
GET            /employees/{id}/onboarding-packets/{type}/template
GET            /employees/{id}/onboarding-packets/{type}/current
GET            /employees/{id}/onboarding-packets/{type}/versions
GET            /employees/{id}/onboarding-packets/{type}/versions/{versionId}
PUT/GET/DELETE /employees/{id}/avatar
GET            /employees/documents/download
DELETE         /employees/documents/{documentId}
GET/POST       /employees/export|import (+ template)
GET            /employees/tasks
GET            /employees/audit-trail       # HR/Admin profile field audit (read-only)

Password / admin onboard live under Auth and Admin — not here.
List filters: status, q, customerId, vendorId, vendorName, projectId, email,
              primary, reportsTo, jobRank. ``q`` prefix-matches (case-insensitive)
              first/last name, email, employeeCode, and businessEmployeeId; results
              rank first-name matches, then last-name, then code, then email/id.
"""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.core.role_groups import (
    APPROVAL_ROLES,
    HR_STAFF_ROLES,
    TIMESHEET_ROLES,
)
from app.core.bootstrap_admin import is_superadmin_view
from app.core.roles import Role, session_access_roles
from app.core.storage import get_storage, read_object, safe_filename
from app.dependencies import CurrentUser, require_roles
from app.modules.rbac.access import (
    MODULE_KEY_EMPLOYEES,
    level_meets_minimum,
    require_audit_trail_access,
    require_module_access,
    resolve_module_access_level,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY
from app.modules.deps import DbSession
from app.modules.employee.access import (
    actor_employee_id,
    actor_role,
    assert_can_edit_employee,
    assert_can_view_employee,
    get_employee_or_404,
)
from app.modules.employee.import_export import (
    build_template_csv,
    employees_to_csv,
    parse_employee_csv,
)
from app.modules.employee.list_query import resolve_list_query
from app.modules.employee import notifications as profile_notifications
from app.modules.employee.service import EmployeeService
from app.modules.skills import service as skill_svc

router = APIRouter(prefix="/employees", tags=["Employees"])
_svc = EmployeeService()

_employees_read = require_module_access(
    MODULE_KEY_EMPLOYEES,
    min_level=ACCESS_LEVEL_READ_ONLY,
)
_employees_write = require_module_access(
    MODULE_KEY_EMPLOYEES,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
)
_audit_trail_read = require_audit_trail_access()


async def _employees_list_access(user: CurrentUser, session: DbSession) -> dict[str, Any]:
    """JWT EMPLOYEE reaches ``list_employees`` (self-only without a grant)."""
    if actor_role(user) == Role.EMPLOYEE.value:
        return user
    return await _employees_read(user, session)


_MAX_IMPORT_BYTES = 5 * 1024 * 1024

_LIFECYCLE_APPROVAL = frozenset({"approve", "reject"})
_LIFECYCLE_HR = frozenset(
    {
        "rehire",
        "reactivate",
        "offboard",
        "deactivate",
        "toggle_status",
        "status",
        "invite",
        "resend_invite",
    }
)
_LIFECYCLE_TIMESHEET = frozenset({"draft"})


def _csv_response(csv_bytes: bytes, filename: str, extra: dict[str, str] | None = None) -> Response:
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        **(extra or {}),
    }
    return Response(content=csv_bytes, media_type="text/csv; charset=utf-8", headers=headers)


async def _actor_has_employees_full_access(
    session: DbSession, user: dict[str, Any]
) -> bool:
    """True when Manage Access granted Employees full_access (Admin persona)."""
    if is_superadmin_view(user):
        return True
    raw_id = actor_employee_id(user)
    if not raw_id:
        return False
    try:
        employee_id = uuid.UUID(raw_id)
    except (TypeError, ValueError):
        return False
    level = await resolve_module_access_level(
        session,
        employee_id=employee_id,
        module_key=MODULE_KEY_EMPLOYEES,
    )
    return level_meets_minimum(level, ACCESS_LEVEL_FULL_ACCESS)


async def _assert_lifecycle_roles(
    session: DbSession, user: dict[str, Any], action: str
) -> None:
    """JWT staff roles **or** Employees full_access grant (DATA-8 Admin)."""
    normalized = action.strip().lower().replace("-", "_")
    roles = session_access_roles(user)
    if normalized in _LIFECYCLE_APPROVAL:
        allowed = {r.value for r in APPROVAL_ROLES}
    elif normalized in _LIFECYCLE_HR:
        allowed = {r.value for r in HR_STAFF_ROLES}
    elif normalized in _LIFECYCLE_TIMESHEET:
        allowed = {r.value for r in TIMESHEET_ROLES}
    else:
        return  # service will 400 on unknown action
    if roles.intersection(allowed):
        return
    # Grant-elevated Admins keep JWT EMPLOYEE but hold Employees full_access.
    if normalized in _LIFECYCLE_APPROVAL or normalized in _LIFECYCLE_HR:
        if await _actor_has_employees_full_access(session, user):
            return
    raise HTTPException(status_code=403, detail="Insufficient permissions")


# ---------------------------------------------------------------------------
# Collection
# ---------------------------------------------------------------------------


@router.get("", dependencies=[Depends(_employees_list_access)])
async def list_employees(
    session: DbSession,
    user: CurrentUser,
    email: str | None = Query(None),
    status: str | None = Query(None),
    q: str | None = Query(None),
    client_id: str | None = Query(None, alias="customerId"),
    vendor_id: str | None = Query(None, alias="vendorId"),
    vendor_name: str | None = Query(None, alias="vendorName"),
    project_id: str | None = Query(None, alias="projectId"),
    reports_to: str | None = Query(None, alias="reportsTo"),
    job_rank: str | None = Query(None, alias="jobRank"),
    department_id: str | None = Query(None, alias="departmentId"),
    location_id: str | None = Query(None, alias="locationId"),
    designation_id: str | None = Query(None, alias="designationId"),
    primary: bool | None = Query(None),
    sort: str | None = Query(None),
    sort_dir: str | None = Query(None, alias="sortDir"),
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, alias="pageSize", ge=1),
) -> list[dict] | dict:
    # JWT EMPLOYEE without Employees grant → self only (My Profile).
    # Grant-elevated Admins (Employees read/write) get the org directory.
    if actor_role(user) == Role.EMPLOYEE.value:
        self_id = actor_employee_id(user)
        if not self_id:
            return []
        has_directory = False
        try:
            level = await resolve_module_access_level(
                session,
                employee_id=uuid.UUID(self_id),
                module_key=MODULE_KEY_EMPLOYEES,
            )
            has_directory = level_meets_minimum(level, ACCESS_LEVEL_READ_ONLY)
        except (TypeError, ValueError):
            has_directory = False
        if not has_directory:
            return [await _svc.get_by_id(session, uuid.UUID(self_id))]

    query = resolve_list_query(
        email=email,
        status=status,
        q=q,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_name=vendor_name,
        project_id=project_id,
        reports_to=reports_to,
        job_rank=job_rank,
        department_id=department_id,
        location_id=location_id,
        designation_id=designation_id,
        primary=primary,
        sort=sort,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    if query.email:
        return await _svc.get_by_email(session, query.email)
    return await _svc.list_filtered(
        session,
        user,
        status=query.status,
        q=query.q,
        client_id=query.client_id,
        vendor_id=query.vendor_id,
        vendor_name=query.vendor_name,
        project_id=query.project_id,
        reports_to=query.reports_to,
        job_rank=query.job_rank,
        department_id=query.department_id,
        location_id=query.location_id,
        designation_id=query.designation_id,
        sort=query.sort,
        sort_dir=query.sort_dir,
        page=query.page,
        page_size=query.page_size,
    )


@router.post("", dependencies=[Depends(_employees_write)])
async def create_employee(session: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await _svc.create(session, body, user)


@router.post("/drafts", dependencies=[Depends(_employees_write)])
async def create_employee_draft(
    session: DbSession, user: CurrentUser, body: dict[str, Any]
) -> dict:
    """EMP-DATA-11: Save incomplete Add Employee form as NEW with employee_code only."""
    return await _svc.create_draft(session, body, user)


@router.post("/code-preview", dependencies=[Depends(_employees_write)])
async def preview_employee_code(
    session: DbSession, user: CurrentUser, body: dict[str, Any]
) -> dict[str, str]:
    """Best-effort name-based employee_code. Does not persist or reserve."""
    return await _svc.preview_employee_code(session, body)


@router.get("/tasks", dependencies=[Depends(require_roles(*APPROVAL_ROLES, Role.ACCOUNTANT))])
async def employee_tasks(session: DbSession) -> list[dict]:
    return await _svc.tasks(session)


@router.get(
    "/audit-trail",
    dependencies=[Depends(_audit_trail_read)],
)
async def list_employee_audit_trail(
    session: DbSession,
    employee_id: uuid.UUID | None = Query(None, alias="employeeId"),
    q: str | None = Query(None),
    from_date: date | None = Query(None, alias="fromDate"),
    to_date: date | None = Query(None, alias="toDate"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, alias="pageSize", ge=1, le=200),
) -> dict:
    """Read-only profile field-change history for HR/Admin."""
    return await _svc.list_field_audit(
        session,
        employee_id=employee_id,
        q=q,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/notifications",
    dependencies=[Depends(require_roles(*APPROVAL_ROLES))],
)
async def list_profile_notifications(
    session: DbSession,
    user: CurrentUser,
    unread_only: bool = Query(default=False, alias="unreadOnly"),
) -> dict:
    """HR inbox: employee self-service profile update alerts."""
    return await profile_notifications.list_profile_notifications(
        session, user, unread_only=unread_only
    )


@router.patch(
    "/notifications/{notification_id}",
    dependencies=[Depends(require_roles(*APPROVAL_ROLES))],
)
async def mark_profile_notification_read(
    session: DbSession,
    user: CurrentUser,
    notification_id: uuid.UUID,
) -> dict:
    return await profile_notifications.mark_profile_notification_read(
        session, user, notification_id
    )


@router.get("/export", dependencies=[Depends(_employees_read)])
async def export_employees(session: DbSession, user: CurrentUser) -> Response:
    rows = await _svc.list_all(session, user)
    csv_bytes = employees_to_csv(rows)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"employees-export-{stamp}.csv"
    object_key = f"employees/exports/{stamp}/{filename}"
    get_storage().put_bytes(object_key, csv_bytes, "text/csv")
    return _csv_response(csv_bytes, filename, {"X-Object-Key": object_key})


@router.get("/import/template", dependencies=[Depends(_employees_read)])
async def import_template() -> Response:
    return _csv_response(build_template_csv(), "employees-import-template.csv")


@router.post("/import", dependencies=[Depends(_employees_write)])
async def import_employees(
    session: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
) -> dict:
    raw_name = file.filename or "employees-import.csv"
    filename = safe_filename(raw_name)
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported (Excel: Save As CSV)")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(data) > _MAX_IMPORT_BYTES:
        raise HTTPException(status_code=400, detail="Import file exceeds 5 MB limit")

    batch_id = str(uuid.uuid4())
    object_key = f"employees/imports/{batch_id}/{filename}"
    get_storage().put_bytes(object_key, data, file.content_type or "text/csv")

    rows, parse_errors = parse_employee_csv(data)
    result = await _svc.import_rows(session, rows, user) if rows else {
        "createdCount": 0,
        "skippedCount": 0,
        "created": [],
        "skipped": [],
    }
    return {
        "objectKey": object_key,
        "fileName": filename,
        "createdCount": result["createdCount"],
        "skippedCount": result["skippedCount"],
        "errorCount": len(parse_errors),
        "created": result["created"],
        "skipped": result["skipped"],
        "errors": parse_errors,
    }


# Document download/delete before /{employee_id}
@router.get("/documents/download", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def download_document(
    session: DbSession,
    user: CurrentUser,
    file_path: str = Query(..., alias="filePath"),
    file_name: str = Query(..., alias="fileName"),
) -> Response:
    from app.modules.employee.access import assert_can_view_employee

    doc = await _svc.get_document_by_object_key(session, file_path)
    await assert_can_view_employee(session, user, doc.employee_id)
    data, content_type = await read_object(get_storage(), doc.url or file_path)
    filename = safe_filename(file_name or doc.file_name or "download")
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.delete("/documents/{document_id}", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def delete_document(
    session: DbSession,
    user: CurrentUser,
    document_id: uuid.UUID,
) -> dict:
    from app.modules.employee.access import assert_can_edit_employee

    doc = await _svc.get_active_document(session, document_id)
    await assert_can_edit_employee(session, user, doc.employee_id)
    return await _svc.delete_document(session, document_id)


@router.post("/activate-due", dependencies=[Depends(_employees_write)])
async def activate_due_employees(session: DbSession, user: CurrentUser) -> dict:
    """Pending → Active when date of joining is today or earlier.

    Stub for a future cron/scheduler. Safe to call repeatedly (idempotent).
    """
    return await _svc.activate_due(session, actor=user)


@router.post("/transitions", dependencies=[Depends(_employees_write)])
async def transition_employee_collection(
    session: DbSession,
    user: CurrentUser,
    body: dict[str, Any],
) -> dict:
    """Collection lifecycle (rehire-by-email). Must be registered before /{employee_id}."""
    action = body.get("action")
    if not isinstance(action, str) or not action.strip():
        raise HTTPException(status_code=400, detail="action is required")
    await _assert_lifecycle_roles(session, user, action)
    normalized = action.strip().lower().replace("-", "_")
    if normalized not in {"rehire", "reactivate"}:
        raise HTTPException(
            status_code=400,
            detail="Only action=rehire is supported on POST /employees/transitions "
            "(reactivate remains a compatibility alias); "
            "use /employees/{id}/transitions for other lifecycle actions",
        )
    return await _svc.apply_transition(
        session,
        None,
        action,
        email_id=body.get("emailId") or body.get("email_id"),
        patch={k: v for k, v in body.items() if k not in {"action", "emailId", "email_id"}},
    )


# ---------------------------------------------------------------------------
# Item
# ---------------------------------------------------------------------------


@router.get("/{employee_id}", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def get_employee(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
) -> dict:
    from app.modules.employee.access import check_can_view_employee

    emp = await _svc._get(session, employee_id)
    grant_level = await check_can_view_employee(session, user, emp)
    return await _svc._profile_dict(
        session, emp, actor=user, employees_grant_level=grant_level
    )


@router.patch("/{employee_id}", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def update_employee(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    from app.modules.employee.access import (
        actor_employee_id,
        actor_role,
        assert_can_edit_employee,
    )
    from app.modules.employee.employment_updates import body_has_emp14_fields
    from app.modules.employee.field_permissions import assert_patch_fields_allowed

    is_self = actor_employee_id(user) == str(employee_id)
    role = actor_role(user)
    target = await _svc._get(session, employee_id)
    if bool(getattr(target, "is_system_account", False)) and not is_self:
        raise HTTPException(
            status_code=403,
            detail="System accounts cannot be edited via employee profile",
        )
    grant_full = False
    if role == Role.EMPLOYEE.value:
        grant_full = await _actor_has_employees_full_access(session, user)
    if role == Role.EMPLOYEE.value and not is_self:
        # DATA-8: Employees full_access grant elevates past self-only JWT.
        await assert_can_edit_employee(session, user, employee_id)
    elif role == Role.EMPLOYEE.value and is_self and not grant_full:
        assert_patch_fields_allowed(
            body,
            app_role=role,
            is_self=True,
            already_saved=True,
        )
        result = await _svc.patch_employee(session, employee_id, body, actor=user)
        refreshed = await _svc._get(session, employee_id)
        try:
            await profile_notifications.notify_profile_updated(
                session, user, refreshed
            )
        except Exception:
            # Profile save must succeed even if the HR inbox write fails.
            import logging

            logging.getLogger(__name__).exception(
                "Failed to enqueue profile-update notification for %s",
                employee_id,
            )
        return result
    if body_has_emp14_fields(body) or role == Role.EMPLOYEE.value:
        await assert_can_edit_employee(session, user, employee_id)
    # full_access grant → Admin field matrix; read_only never reaches here for others.
    assert_patch_fields_allowed(
        body,
        app_role=(
            Role.ADMIN.value
            if role == Role.EMPLOYEE.value and grant_full
            else role
        ),
        is_self=is_self,
        already_saved=True,
    )
    return await _svc.patch_employee(session, employee_id, body, actor=user)


@router.delete("/{employee_id}", dependencies=[Depends(_employees_write)])
async def delete_employee(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    end_date: str | None = Query(None, alias="endDate"),
    hard: bool = Query(False, description="Hard-delete NEW drafts only (discard)"),
) -> dict:
    if not hard and (not end_date or not end_date.strip()):
        raise HTTPException(status_code=400, detail="endDate is required to offboard")
    target = await _svc._get(session, employee_id)
    if bool(getattr(target, "is_system_account", False)):
        raise HTTPException(
            status_code=403,
            detail="System accounts cannot be offboarded or deleted",
        )
    if hard:
        return await _svc.cascade_delete(session, employee_id, actor=user)
    return await _svc.delete_with_end_date(
        session, employee_id, end_date.strip(), actor=user
    )


@router.post("/{employee_id}/transitions", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def transition_employee(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    """Lifecycle workflow. Body: { action, comments?, emailId?, endDate?, ...patch fields for draft }."""
    action = body.get("action")
    if not isinstance(action, str) or not action.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "action is required (draft|invite|resend_invite|"
                "approve|reject|toggle_status|offboard|rehire)"
            ),
        )
    await _assert_lifecycle_roles(session, user, action)
    normalized_action = action.strip().lower().replace("-", "_")
    # emailId is the rehire lookup key, not a patch field. Invite/draft
    # persist Work Email as emailId/officialEmail and must keep those keys.
    reserved = {"action", "comments"}
    if normalized_action not in {"invite", "draft", "resend_invite"}:
        reserved = reserved | {"emailId", "email_id"}
    patch = {k: v for k, v in body.items() if k not in reserved}
    return await _svc.apply_transition(
        session,
        employee_id,
        action,
        comments=body.get("comments"),
        email_id=body.get("emailId")
        or body.get("email_id")
        or body.get("officialEmail"),
        patch=patch or None,
        actor=user,
    )


# ---------------------------------------------------------------------------
# Nested projects
# ---------------------------------------------------------------------------


@router.get("/{employee_id}/projects", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def list_employee_projects(session: DbSession, employee_id: uuid.UUID) -> list[dict]:
    return await _svc.list_projects(session, employee_id)


@router.post("/{employee_id}/projects", dependencies=[Depends(_employees_write)])
async def add_employee_project(session: DbSession, employee_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await _svc.add_project(session, employee_id, body)


@router.patch(
    "/{employee_id}/projects/{project_id}",
    dependencies=[Depends(_employees_write)],
)
async def update_employee_project(
    session: DbSession,
    employee_id: uuid.UUID,
    project_id: uuid.UUID,
    body: dict[str, Any] | None = None,
    end_date: str | None = Query(None, alias="endDate"),
) -> dict:
    _ = employee_id
    payload = body or {}
    if payload.get("projectRole") == "LEAD" or payload.get("makeLead") is True:
        return await _svc.add_lead_to_project(session, project_id)
    resolved_end = end_date or payload.get("endDate") or payload.get("projectEndDate")
    if not resolved_end:
        raise HTTPException(status_code=400, detail="endDate is required unless makeLead/projectRole=LEAD")
    return await _svc.update_project(session, project_id, str(resolved_end))


@router.delete(
    "/{employee_id}/projects/{project_id}",
    dependencies=[Depends(_employees_write)],
)
async def delete_employee_project(
    session: DbSession,
    employee_id: uuid.UUID,
    project_id: uuid.UUID,
    end_date: str | None = Query(None, alias="endDate"),
    hard: bool = Query(False),
) -> dict:
    _ = employee_id
    if hard:
        return await _svc.delete_project_data(session, project_id)
    if not end_date or not end_date.strip():
        raise HTTPException(status_code=400, detail="endDate is required for soft-delete (or pass hard=true)")
    return await _svc.delete_project(session, project_id, end_date.strip())


# ---------------------------------------------------------------------------
# Self-service profile changes (address / emergency → HR review)
# ---------------------------------------------------------------------------


@router.post(
    "/{employee_id}/profile-changes",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def submit_profile_change(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    return await _svc.submit_profile_change(session, employee_id, user, body)


@router.get(
    "/{employee_id}/profile-changes/pending",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def get_pending_profile_change(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
) -> dict | None:
    from app.modules.employee.access import actor_employee_id, actor_role

    role = actor_role(user)
    is_self = actor_employee_id(user) == str(employee_id)
    if not is_self and role == Role.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return await _svc.get_pending_profile_change(session, employee_id)


@router.post(
    "/{employee_id}/profile-changes/{change_id}/approve",
    dependencies=[Depends(_employees_write)],
)
async def approve_profile_change(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    change_id: uuid.UUID,
    body: dict[str, Any] | None = None,
) -> dict:
    return await _svc.approve_profile_change(
        session,
        employee_id,
        change_id,
        user,
        comments=(body or {}).get("comments"),
    )


@router.post(
    "/{employee_id}/profile-changes/{change_id}/reject",
    dependencies=[Depends(_employees_write)],
)
async def reject_profile_change(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    change_id: uuid.UUID,
    body: dict[str, Any] | None = None,
) -> dict:
    return await _svc.reject_profile_change(
        session,
        employee_id,
        change_id,
        user,
        comments=(body or {}).get("comments"),
    )


# ---------------------------------------------------------------------------
# Identity correction requests (name / DOB)
# ---------------------------------------------------------------------------


@router.get(
    "/correction-requests",
    dependencies=[Depends(_employees_write)],
)
async def list_correction_requests(
    session: DbSession,
    status: str | None = Query(None),
    employee_id: uuid.UUID | None = Query(None, alias="employeeId"),
) -> list[dict]:
    return await _svc.list_correction_requests(
        session, status=status, employee_id=employee_id
    )


@router.post(
    "/{employee_id}/correction-requests",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def create_correction_request(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    return await _svc.create_correction_request(session, employee_id, user, body)


@router.post(
    "/correction-requests/{request_id}/approve",
    dependencies=[Depends(_employees_write)],
)
async def approve_correction_request(
    session: DbSession,
    user: CurrentUser,
    request_id: uuid.UUID,
    body: dict[str, Any] | None = None,
) -> dict:
    return await _svc.review_correction_request(
        session,
        request_id,
        user,
        approve=True,
        note=(body or {}).get("note") or (body or {}).get("comments"),
    )


@router.post(
    "/correction-requests/{request_id}/reject",
    dependencies=[Depends(_employees_write)],
)
async def reject_correction_request(
    session: DbSession,
    user: CurrentUser,
    request_id: uuid.UUID,
    body: dict[str, Any] | None = None,
) -> dict:
    return await _svc.review_correction_request(
        session,
        request_id,
        user,
        approve=False,
        note=(body or {}).get("note") or (body or {}).get("comments"),
    )


# ---------------------------------------------------------------------------
# Nested documents + avatar
# ---------------------------------------------------------------------------


@router.get("/{employee_id}/documents", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def list_documents(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
) -> list[dict]:
    from app.modules.employee.access import assert_can_view_employee

    await assert_can_view_employee(session, user, employee_id)
    return await _svc.list_documents(session, employee_id)


# ---------------------------------------------------------------------------
# Onboarding packet docs (NDA / W-4 / bank / handbook) — versioned MinIO uploads
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}/onboarding-packets",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def list_onboarding_packets(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
) -> list[dict]:
    from app.modules.employee import onboarding_packets as packets

    await assert_can_view_employee(session, user, employee_id)
    return await packets.list_packet_documents(session, employee_id=employee_id)


@router.get(
    "/{employee_id}/onboarding-packets/{document_type}/template",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def download_onboarding_packet_template(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    document_type: str,
) -> Response:
    from app.modules.employee import onboarding_packets as packets

    await assert_can_view_employee(session, user, employee_id)
    data, content_type, filename = await packets.download_template(document_type)
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "Cache-Control": "private, max-age=60",
        },
    )


@router.get(
    "/{employee_id}/onboarding-packets/{document_type}/current",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def download_onboarding_packet_current(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    document_type: str,
) -> Response:
    from app.modules.employee import onboarding_packets as packets

    await assert_can_view_employee(session, user, employee_id)
    data, content_type, filename = await packets.download_current_upload(
        session, employee_id=employee_id, document_type=document_type
    )
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "Cache-Control": "private, no-store",
        },
    )


@router.get(
    "/{employee_id}/onboarding-packets/{document_type}/versions",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def list_onboarding_packet_versions(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    document_type: str,
) -> dict:
    from app.modules.employee import onboarding_packets as packets

    await assert_can_view_employee(session, user, employee_id)
    return await packets.list_packet_versions(
        session, employee_id=employee_id, document_type=document_type
    )


@router.get(
    "/{employee_id}/onboarding-packets/{document_type}/versions/{version_id}",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def download_onboarding_packet_version(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    document_type: str,
    version_id: uuid.UUID,
) -> Response:
    from app.modules.employee import onboarding_packets as packets

    await assert_can_view_employee(session, user, employee_id)
    data, content_type, filename = await packets.download_packet_version(
        session,
        employee_id=employee_id,
        document_type=document_type,
        version_id=version_id,
    )
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "Cache-Control": "private, no-store",
        },
    )


@router.post(
    "/{employee_id}/onboarding-packets/{document_type}",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def upload_onboarding_packet(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    document_type: str,
    file: UploadFile = File(...),
) -> dict:
    from app.modules.employee import onboarding_packets as packets
    from app.modules.employee.access import assert_can_edit_employee

    # Self may upload; HR/admin may also upload on behalf of employee.
    emp = await assert_can_edit_employee(session, user, employee_id)
    return await packets.upload_packet_document(
        session,
        employee=emp,
        document_type=document_type,
        upload=file,
        actor=user,
    )


@router.post("/{employee_id}/documents", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def upload_documents(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    documents: str = Query(...),
    files: list[UploadFile] = File(default=[]),
) -> list[dict]:
    from app.modules.employee.access import assert_can_edit_employee
    from app.modules.employee.files import read_validated_document

    await assert_can_edit_employee(session, user, employee_id)
    meta_list = json.loads(documents)
    if not isinstance(meta_list, list):
        meta_list = [meta_list]
    storage = get_storage()
    results: list[dict] = []
    for idx, meta in enumerate(meta_list):
        if not isinstance(meta, dict):
            continue
        upload = files[idx] if idx < len(files) else None
        data, content_type = await read_validated_document(upload)
        doc_id = uuid.uuid4()
        raw_name = meta.get("fileName") or (upload.filename if upload else f"file-{idx}")
        filename = safe_filename(str(raw_name))
        meta = {**meta, "fileName": filename, "documentName": meta.get("documentName") or filename}
        object_key = f"employees/{employee_id}/{doc_id}/{filename}"
        storage.put_bytes(object_key, data, content_type)
        try:
            results.append(
                await _svc.upload_document(
                    session,
                    employee_id,
                    meta,
                    object_key,
                    document_id=doc_id,
                    actor=user,
                )
            )
        except Exception:
            try:
                storage.remove(object_key)
            except Exception:
                pass
            raise
    return results


@router.put("/{employee_id}/avatar", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def put_avatar(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    file: UploadFile = File(...),
) -> dict:
    from app.modules.employee.access import assert_can_manage_avatar
    from app.modules.employee.files import avatar_extension, read_validated_avatar

    emp = await assert_can_manage_avatar(session, user, employee_id)
    data, content_type = await read_validated_avatar(file)
    ext = avatar_extension(content_type)
    object_key = f"employees/{employee_id}/avatar/{uuid.uuid4()}.{ext}"
    storage = get_storage()
    storage.put_bytes(object_key, data, content_type)
    previous = emp.avatar_object_key
    try:
        result = await _svc.set_avatar(session, employee_id, object_key, actor=user)
    except Exception:
        try:
            storage.remove(object_key)
        except Exception:
            pass
        raise
    if previous and previous != object_key:
        try:
            storage.remove(previous)
        except Exception:
            pass
    return result


@router.get("/{employee_id}/avatar", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def get_avatar(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
) -> Response:
    from app.modules.employee.access import assert_can_view_employee

    emp = await assert_can_view_employee(session, user, employee_id)
    key = emp.avatar_object_key
    if not key:
        raise HTTPException(status_code=404, detail="Employee has no profile photo")
    data, content_type = await read_object(get_storage(), key)
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=60"},
    )


@router.delete("/{employee_id}/avatar", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def delete_avatar(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
) -> dict:
    from app.modules.employee.access import assert_can_manage_avatar

    await assert_can_manage_avatar(session, user, employee_id)
    result = await _svc.clear_avatar(session, employee_id, actor=user)
    previous = result.get("previousObjectKey")
    if previous and not str(previous).startswith("/uploads/"):
        try:
            get_storage().remove(str(previous))
        except HTTPException as exc:
            if exc.status_code == 502:
                raise HTTPException(
                    status_code=502,
                    detail="Photo cleared but storage cleanup failed",
                ) from exc
            raise
    return result


@router.get("/{employee_id}/skills", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def list_employee_skills(
    session: DbSession, user: CurrentUser, employee_id: uuid.UUID
) -> list[dict]:
    """Skills already on this employee (catalog names + optional years/level)."""
    await assert_can_view_employee(session, user, employee_id)
    return await skill_svc.list_employee_skills(session, employee_id)


@router.post("/{employee_id}/skills", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def attach_employee_skills(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    body: dict[str, Any],
) -> list[dict]:
    """Attach Active catalog skills by skillIds. Self or HR-with-edit."""
    if actor_employee_id(user) != str(employee_id):
        await assert_can_edit_employee(session, user, employee_id)
    else:
        await get_employee_or_404(session, employee_id)
    return await skill_svc.attach_employee_skills(session, user, employee_id, body)


async def _assert_can_edit_own_or_staff_skills(
    session: DbSession, user: dict[str, Any], employee_id: uuid.UUID
) -> None:
    if actor_employee_id(user) != str(employee_id):
        await assert_can_edit_employee(session, user, employee_id)
    else:
        await get_employee_or_404(session, employee_id)


@router.patch(
    "/{employee_id}/skills/{skill_id}",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def update_employee_skill(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    """Update proficiency/years on one attached skill. Keeps the certificate."""
    await _assert_can_edit_own_or_staff_skills(session, user, employee_id)
    return await skill_svc.update_employee_skill(
        session, user, employee_id, skill_id, body
    )


@router.post(
    "/{employee_id}/skills/{skill_id}/certificate",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def upload_skill_certificate(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    file: UploadFile = File(...),
) -> dict:
    """Attach one optional certificate file to an employee skill row (MinIO)."""
    from app.modules.employee.files import read_validated_document

    await _assert_can_edit_own_or_staff_skills(session, user, employee_id)
    data, content_type = await read_validated_document(file)
    filename = safe_filename(file.filename or "certificate")
    object_key = f"employees/{employee_id}/skills/{skill_id}/certificate/{filename}"
    storage = get_storage()
    storage.put_bytes(object_key, data, content_type)
    try:
        payload, previous = await skill_svc.set_skill_certificate(
            session, user, employee_id, skill_id, object_key, filename
        )
    except Exception:
        try:
            storage.remove(object_key)
        except Exception:
            pass
        raise
    if previous:
        try:
            storage.remove(previous)
        except Exception:
            pass
    return payload


@router.delete(
    "/{employee_id}/skills/{skill_id}/certificate",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def delete_skill_certificate(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
) -> dict:
    """Remove the certificate file from this employee skill row."""
    await _assert_can_edit_own_or_staff_skills(session, user, employee_id)
    return await skill_svc.clear_skill_certificate(
        session, user, employee_id, skill_id
    )


@router.get(
    "/{employee_id}/skills/{skill_id}/certificate",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def download_skill_certificate(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
) -> Response:
    """Download the certificate stored on this employee skill row."""
    await assert_can_view_employee(session, user, employee_id)
    row = await skill_svc.get_employee_skill(session, employee_id, skill_id)
    object_key = row.certificate_object_key
    if not object_key:
        raise HTTPException(status_code=404, detail="No certificate on this skill.")
    data, content_type = await read_object(get_storage(), object_key)
    filename = safe_filename(row.certificate_file_name or "certificate")
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
        },
    )


@router.delete(
    "/{employee_id}/skills/{skill_id}",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def detach_employee_skill(
    session: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
) -> dict:
    """Remove one catalog skill from this employee."""
    await _assert_can_edit_own_or_staff_skills(session, user, employee_id)
    return await skill_svc.detach_employee_skill(
        session, employee_id, skill_id, actor=user
    )
