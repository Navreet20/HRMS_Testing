"""Company Setup → Notifications API (delivery log, retry, template catalog)."""

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import Field

from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.notifications import service as svc
from app.modules.rbac.access import MODULE_KEY_COMPANY_SETUP, require_module_access
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY
from app.schemas.common import CamelModel

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class TemplateWording(CamelModel):
    subject: str
    body: str


class SendTestBody(CamelModel):
    to_email: str = Field(alias="toEmail")


# Company Setup grant only: the log shows who was emailed and about what.
_read = require_module_access(MODULE_KEY_COMPANY_SETUP, min_level=ACCESS_LEVEL_READ_ONLY)
_write = require_module_access(MODULE_KEY_COMPANY_SETUP, min_level=ACCESS_LEVEL_FULL_ACCESS)


@router.get("/deliveries", dependencies=[Depends(_read)])
async def list_deliveries(
    db: DbSession,
    status: str | None = Query(None),
    search: str | None = Query(None, max_length=200),
    page: int = Query(0, ge=0),
    page_size: int = Query(25, alias="pageSize", ge=1, le=svc.MAX_PAGE_SIZE),
) -> dict:
    return await svc.list_deliveries(
        db, status_filter=status, search=search, page=page, page_size=page_size
    )


@router.post("/deliveries/{delivery_id}/retry", dependencies=[Depends(_write)])
async def retry_delivery(db: DbSession, delivery_id: uuid.UUID) -> dict:
    return await svc.retry_delivery(db, delivery_id)


@router.post("/deliveries/{delivery_id}/withdraw", dependencies=[Depends(_write)])
async def withdraw_delivery(db: DbSession, delivery_id: uuid.UUID) -> dict:
    """Stop a waiting email so a later retry does not send it."""
    return await svc.withdraw_delivery(db, delivery_id)


@router.get("/templates", dependencies=[Depends(_read)])
async def list_templates(db: DbSession) -> list[dict]:
    return await svc.list_templates(db)


@router.put("/templates/{key}", dependencies=[Depends(_write)])
async def save_template(db: DbSession, user: CurrentUser, key: str, body: TemplateWording) -> dict:
    """Edit an email's subject and message (Company Setup full access)."""
    return await svc.save_template(db, user, key, body.subject, body.body)


@router.delete("/templates/{key}", dependencies=[Depends(_write)])
async def reset_template(db: DbSession, key: str) -> dict:
    """Go back to the built-in wording."""
    return await svc.reset_template(db, key)


@router.post("/templates/{key}/preview", dependencies=[Depends(_read)])
async def preview_template(key: str, body: TemplateWording) -> dict:
    """Render unsaved wording with example values."""
    return svc.preview_template(key, body.subject, body.body)


@router.post("/templates/{key}/send-test", dependencies=[Depends(_write)])
async def send_test_email(key: str, body: SendTestBody) -> dict:
    """Queue one sample of this template. Does not replace automatic sends."""
    return await svc.send_test_email(key, body.to_email)
