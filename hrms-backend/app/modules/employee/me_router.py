"""Self-scoped employee endpoints under ``/me/*``."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

from app.core.storage import get_storage, read_object
from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.employee.service import EmployeeService
from app.modules.rbac.access import (
    MODULE_KEY_EMPLOYEE_PORTAL,
    SUBMODULE_KEY_MANAGE,
    require_module_access,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(tags=["Me"])
_svc = EmployeeService()

_portal_manage_read = require_module_access(
    MODULE_KEY_EMPLOYEE_PORTAL,
    submodule_key=SUBMODULE_KEY_MANAGE,
    min_level=ACCESS_LEVEL_READ_ONLY,
)
_portal_manage_write = require_module_access(
    MODULE_KEY_EMPLOYEE_PORTAL,
    submodule_key=SUBMODULE_KEY_MANAGE,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
)


@router.get("/me/managing-option")
async def managing_option(session: DbSession, user: CurrentUser) -> dict[str, bool]:
    """Return Self/Manage gate flags (direct reports + functional queues)."""
    return await _svc.managing_option(session, user)


@router.get("/me/project-allocation")
async def project_allocation(
    session: DbSession, user: CurrentUser
) -> dict[str, bool]:
    """Whether the caller has an active project allocation (My projects nav gate)."""
    return await _svc.project_allocation_option(session, user)


@router.get("/me/profile-update-requests")
async def list_profile_update_requests(
    session: DbSession, user: CurrentUser
) -> list[dict]:
    """List the caller's profile update requests (ESS-DATA-2)."""
    return await _svc.list_own_profile_update_requests(session, user)


@router.post("/me/profile-update-requests")
async def create_profile_update_request(
    request: Request,
    session: DbSession,
    user: CurrentUser,
) -> dict:
    """Submit a profile update request; optional supporting document via multipart."""
    content_type = (request.headers.get("content-type") or "").lower()
    attachment = None
    if "multipart/form-data" in content_type:
        form = await request.form()
        body: dict[str, Any] = {}
        for key in (
            "shortDescription",
            "short_description",
            "longDescription",
            "long_description",
            "requestedForEmployeeId",
            "requested_for_employee_id",
            "fieldChanged",
            "field_changed",
            "newValue",
            "new_value",
        ):
            value = form.get(key)
            if value is not None and not hasattr(value, "read"):
                body[key] = value
        raw_file = form.get("attachment") or form.get("file")
        if raw_file is not None and hasattr(raw_file, "read"):
            attachment = raw_file
    else:
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Invalid JSON body")
    return await _svc.create_profile_update_request(
        session, user, body, attachment=attachment
    )


@router.get("/me/profile-update-requests/{request_id}/attachment")
async def download_own_profile_update_attachment(
    session: DbSession,
    user: CurrentUser,
    request_id: str,
) -> Response:
    """Download the document on your own profile update request."""
    try:
        parsed_id = UUID(request_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid request id") from exc
    object_key, filename = await _svc.own_profile_update_attachment_object(
        session, user, parsed_id
    )
    data, content_type = await read_object(get_storage(), object_key)
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
        },
    )


@router.get("/me/employee-directory-search")
async def employee_directory_search(
    session: DbSession,
    user: CurrentUser,
    q: str = Query(min_length=2),
) -> list[dict]:
    """Search active employees for on-behalf profile requests."""
    return await _svc.employee_directory_search(session, q)


@router.get("/me/assigned-assets")
async def list_assigned_assets_for_request(
    session: DbSession,
    user: CurrentUser,
    employeeId: str | None = Query(default=None),
) -> list[dict]:
    """Open asset allocations for self or a selected employee (create-request form)."""
    return await _svc.list_assigned_assets_for_request(
        session, user, employee_id=employeeId
    )


@router.get("/me/asset-categories")
async def list_asset_categories_for_request(
    session: DbSession, user: CurrentUser
) -> list[dict]:
    """Asset Management category catalog for New asset requests (any signed-in employee)."""
    from app.modules.assets import service as assets_svc

    _ = user  # auth via CurrentUser
    # Each category says how many are In Stock so the form can disable empty ones.
    return await assets_svc.list_categories_with_stock(session)


@router.get("/me/asset-catalog")
async def list_asset_catalog_for_request(
    session: DbSession,
    user: CurrentUser,
    categoryId: str = Query(..., min_length=1),
) -> dict:
    """Inventory models, OS options, and specs for an asset category."""
    from app.modules.assets import service as assets_svc

    _ = user  # auth via CurrentUser
    return await assets_svc.list_asset_catalog_for_category(session, categoryId)


@router.get("/me/asset-requests")
async def list_asset_requests(session: DbSession, user: CurrentUser) -> list[dict]:
    """List the caller's asset requests (ESS-DATA-3)."""
    return await _svc.list_own_asset_requests(session, user)


@router.post("/me/asset-requests")
async def create_asset_request(
    session: DbSession, user: CurrentUser, body: dict[str, Any]
) -> dict:
    """Submit a one-directional asset request and email Asset Manager/HR (ESS-DATA-3)."""
    return await _svc.create_asset_request(session, user, body)


@router.get("/me/it-requests")
async def list_it_requests(session: DbSession, user: CurrentUser) -> list[dict]:
    """List the caller's IT requests (ESS-DATA-4)."""
    return await _svc.list_own_it_requests(session, user)


@router.post("/me/it-requests")
async def create_it_request(
    session: DbSession, user: CurrentUser, body: dict[str, Any]
) -> dict:
    """Submit a one-directional IT request and email IT (ESS-DATA-4)."""
    return await _svc.create_it_request(session, user, body)


@router.get(
    "/me/manage/profile-update-requests",
    dependencies=[Depends(_portal_manage_read)],
)
async def list_manage_profile_update_requests(
    session: DbSession, user: CurrentUser
) -> list[dict]:
    """ESS-DATA-5: HR staff queue of profile update requests (read-only)."""
    return await _svc.list_manage_profile_update_requests(session, user)


@router.get(
    "/me/manage/profile-update-requests/{request_id}/attachment",
    dependencies=[Depends(_portal_manage_read)],
)
async def download_profile_update_attachment(
    session: DbSession,
    user: CurrentUser,
    request_id: str,
) -> Response:
    """Download the supporting document stored on a profile update request."""
    try:
        parsed_id = UUID(request_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid request id") from exc
    object_key, filename = await _svc.profile_update_attachment_object(
        session, user, parsed_id
    )
    data, content_type = await read_object(get_storage(), object_key)
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
        },
    )


@router.post(
    "/me/manage/profile-update-requests/{request_id}/complete",
    dependencies=[Depends(_portal_manage_write)],
)
async def complete_profile_update_request(
    session: DbSession,
    user: CurrentUser,
    request_id: str,
    body: dict[str, Any],
) -> dict:
    """Mark a profile update request Completed and email the submitter."""
    try:
        parsed_id = UUID(request_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid request id") from exc
    return await _svc.complete_profile_update_request(
        session, user, parsed_id, body or {}
    )


@router.post(
    "/me/manage/profile-update-requests/{request_id}/decide",
    dependencies=[Depends(_portal_manage_write)],
)
async def decide_profile_update_request(
    session: DbSession,
    user: CurrentUser,
    request_id: str,
    body: dict[str, Any],
) -> dict:
    """Approve or reject a profile update request from Manage."""
    try:
        parsed_id = UUID(request_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid request id") from exc
    return await _svc.decide_profile_update_request(
        session, user, parsed_id, body or {}
    )


@router.get("/me/manage/counts")
async def manage_counts(session: DbSession, user: CurrentUser) -> dict[str, int]:
    """Waiting items per Manage tab: timesheets, leaves and requests."""
    return await _svc.manage_counts(session, user)


@router.get(
    "/me/manage/asset-requests",
    dependencies=[Depends(_portal_manage_read)],
)
async def list_manage_asset_requests(
    session: DbSession, user: CurrentUser
) -> list[dict]:
    """ESS-DATA-5: HR staff queue of asset requests."""
    return await _svc.list_manage_asset_requests(session, user)


@router.post(
    "/me/manage/asset-requests/{request_id}/decide",
    dependencies=[Depends(_portal_manage_write)],
)
async def decide_asset_request(
    session: DbSession,
    user: CurrentUser,
    request_id: str,
    body: dict[str, Any],
) -> dict:
    """Approve or reject an asset request from Manage."""
    try:
        parsed_id = UUID(request_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid request id") from exc
    return await _svc.decide_asset_request(session, user, parsed_id, body or {})


@router.get(
    "/me/manage/asset-requests/{request_id}/available-assets",
    dependencies=[Depends(_portal_manage_read)],
)
async def list_available_assets_for_request(
    session: DbSession, user: CurrentUser, request_id: str
) -> list[dict]:
    """In Stock assets that could fulfil this asset request."""
    try:
        parsed_id = UUID(request_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid request id") from exc
    return await _svc.list_available_assets_for_request(session, user, parsed_id)


@router.get(
    "/me/manage/it-requests",
    dependencies=[Depends(_portal_manage_read)],
)
async def list_manage_it_requests(
    session: DbSession, user: CurrentUser
) -> list[dict]:
    """ESS-DATA-5: HR staff queue of IT requests (read-only)."""
    return await _svc.list_manage_it_requests(session, user)
