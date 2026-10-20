import uuid

from typing import Any

from fastapi import APIRouter, Depends

from app.core.role_groups import ADMIN_ROLES, TIMESHEET_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.national_id import service as svc
from app.modules.org.service import viewer_sees_inactive

router = APIRouter(tags=["National ID document types"])

_require_admin = require_roles(
    *ADMIN_ROLES,
    detail="You do not have access to create or change document types. Ask an admin.",
)


@router.get(
    "/national-id-document-types",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def list_document_types(
    db: DbSession, user: CurrentUser, country: str | None = None
) -> list[dict]:
    """Admin sees Active+Inactive. HR sees Active. ?country=US = US types plus Passport."""
    return await svc.list_document_types(
        db,
        include_inactive=viewer_sees_inactive(user),
        country=country,
    )


@router.get(
    "/national-id-document-types/{document_type_id}",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def get_document_type(
    db: DbSession, user: CurrentUser, document_type_id: uuid.UUID
) -> dict:
    return await svc.get_document_type(
        db, document_type_id, include_inactive=viewer_sees_inactive(user)
    )


@router.post("/national-id-document-types", dependencies=[Depends(_require_admin)])
async def create_document_type(
    db: DbSession, user: CurrentUser, body: dict[str, Any]
) -> dict:
    """Admin adds a type. Empty countryCode = every country."""
    return await svc.create_document_type(db, user, body)


@router.patch(
    "/national-id-document-types/{document_type_id}",
    dependencies=[Depends(_require_admin)],
)
async def update_document_type(
    db: DbSession,
    user: CurrentUser,
    document_type_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    """Admin: rename, format, country, or `{ "status": "Inactive" }` / Active."""
    return await svc.update_document_type(db, user, document_type_id, body)


@router.delete(
    "/national-id-document-types/{document_type_id}",
    dependencies=[Depends(_require_admin)],
)
async def delete_document_type(db: DbSession, document_type_id: uuid.UUID) -> dict:
    """Hard-delete. Prefer PATCH status=Inactive so history stays."""
    return await svc.delete_document_type(db, document_type_id)
