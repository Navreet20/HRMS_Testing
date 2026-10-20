import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.core.role_groups import TIMESHEET_ORG_APPROVER_ROLES
from app.core.object_response import cached_object_response
from app.core.storage import get_storage
from app.dependencies import CurrentUser
from app.modules.company import service as svc
from app.modules.company.files import logo_extension, read_validated_logo
from app.modules.deps import DbSession
from app.modules.rbac.access import MODULE_KEY_COMPANY_SETUP, require_module_access
from app.modules.rbac.catalog import SUBMODULE_KEY_COMPANY_PROFILE
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(prefix="/companies", tags=["Companies"])

_company_read = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_COMPANY_PROFILE,
    min_level=ACCESS_LEVEL_READ_ONLY,
    legacy_roles=TIMESHEET_ORG_APPROVER_ROLES,
)
# DATA-8: Company Setup mutations are grant-only (no Role.ADMIN fallback).
_company_write = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_COMPANY_PROFILE,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
)
_company_staff_write = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_COMPANY_PROFILE,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
)

_LOGO_HEADERS_STATIC = {
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
}


@router.get("/current", dependencies=[Depends(_company_read)])
async def get_current_company(db: DbSession, user: CurrentUser) -> dict:
    return await svc.get_current_company(db, user)


@router.get("/current/logo", dependencies=[Depends(_company_read)])
async def get_current_logo(
    db: DbSession,
    user: CurrentUser,
    v: str | None = Query(None, description="Logo object key the page was built with"),
    if_none_match: str | None = Header(None),
) -> Response:
    key = await svc.get_current_logo_key(db, user)
    return await cached_object_response(
        get_storage(),
        key,
        version=v,
        if_none_match=if_none_match,
        extra_headers=_LOGO_HEADERS_STATIC,
    )


@router.get("", dependencies=[Depends(_company_read)])
async def list_companies(db: DbSession) -> list[dict]:
    return await svc.list_companies(db)


@router.get("/pending-approvals", dependencies=[Depends(_company_read)])
async def pending_company_approvals(db: DbSession) -> list[dict]:
    return await svc.pending_approvals(db)


@router.get("/tasks", dependencies=[Depends(_company_read)])
async def company_tasks(db: DbSession) -> list[dict]:
    return await svc.company_tasks(db)


@router.get("/{company_id}", dependencies=[Depends(_company_read)])
async def get_company(db: DbSession, company_id: uuid.UUID) -> dict:
    return await svc.get_company(db, company_id)


@router.post("", dependencies=[Depends(_company_write)])
async def create_company(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_company(db, user, body)


@router.patch("/{company_id}", dependencies=[Depends(_company_staff_write)])
async def update_company(
    db: DbSession,
    user: CurrentUser,
    company_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    return await svc.update_company(db, user, company_id, body)


@router.put("/{company_id}/logo", dependencies=[Depends(_company_write)])
async def put_logo(
    db: DbSession,
    user: CurrentUser,
    company_id: uuid.UUID,
    file: UploadFile = File(...),
) -> dict:
    data, content_type = await read_validated_logo(file)
    ext = logo_extension(content_type)
    object_key = f"companies/{company_id}/logo/{uuid.uuid4()}.{ext}"
    storage = get_storage()
    storage.put_bytes(object_key, data, content_type)
    previous = None
    try:
        result = await svc.set_logo(db, user, company_id, object_key)
        previous = result.get("previousObjectKey")
    except Exception:
        try:
            storage.remove(object_key)
        except Exception:
            pass
        raise
    if previous and previous != object_key:
        try:
            storage.remove(str(previous))
        except Exception:
            pass
    return result


@router.get("/{company_id}/logo", dependencies=[Depends(_company_read)])
async def get_logo(
    db: DbSession,
    company_id: uuid.UUID,
    v: str | None = Query(None, description="Logo object key the page was built with"),
    if_none_match: str | None = Header(None),
) -> Response:
    key = await svc.get_logo_key(db, company_id)
    return await cached_object_response(
        get_storage(),
        key,
        version=v,
        if_none_match=if_none_match,
        extra_headers=_LOGO_HEADERS_STATIC,
    )


@router.delete("/{company_id}/logo", dependencies=[Depends(_company_write)])
async def delete_logo(
    db: DbSession,
    user: CurrentUser,
    company_id: uuid.UUID,
) -> dict:
    result = await svc.clear_logo(db, user, company_id)
    previous = result.get("previousObjectKey")
    if previous:
        try:
            get_storage().remove(str(previous))
        except HTTPException as exc:
            if exc.status_code == 502:
                raise HTTPException(
                    status_code=502,
                    detail="Logo cleared but storage cleanup failed",
                ) from exc
            raise
    return result


@router.post("/{company_id}/approve", dependencies=[Depends(_company_write)])
async def approve_company(db: DbSession, company_id: uuid.UUID) -> dict:
    return await svc.approve_company(db, company_id)


@router.post("/{company_id}/reject", dependencies=[Depends(_company_write)])
async def reject_company(db: DbSession, company_id: uuid.UUID) -> dict:
    return await svc.reject_company(db, company_id)


@router.delete("/{company_id}", dependencies=[Depends(_company_write)])
async def delete_company(db: DbSession, company_id: uuid.UUID) -> dict:
    return await svc.delete_company(db, company_id)
