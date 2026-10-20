import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.core.object_response import cached_object_response
from app.core.storage import get_storage
from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.clients import service as svc
from app.modules.clients.files import logo_extension, read_validated_logo
from app.modules.rbac.access import MODULE_KEY_CUSTOMERS, require_module_access
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(tags=["Clients"])

_clients_read = require_module_access(
    MODULE_KEY_CUSTOMERS,
    min_level=ACCESS_LEVEL_READ_ONLY,
)
_clients_write = require_module_access(
    MODULE_KEY_CUSTOMERS,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
)


@router.get("", dependencies=[Depends(_clients_read)])
async def list_clients(db: DbSession) -> list[dict]:
    return await svc.list_clients(db)


@router.get("/inactive", dependencies=[Depends(_clients_read)])
async def inactive_clients(db: DbSession) -> list[dict]:
    return await svc.inactive_clients(db)


@router.get("/search", dependencies=[Depends(_clients_read)])
async def search_clients(db: DbSession, q: str = Query(...)) -> list[dict]:
    return await svc.search_clients(db, q)


@router.get("/invoices/summary", dependencies=[Depends(_clients_read)])
async def client_invoice_summary(db: DbSession) -> list[dict]:
    return await svc.invoice_summary(db)


@router.get("/invoices", dependencies=[Depends(_clients_read)])
async def all_client_invoices(db: DbSession) -> list[dict]:
    return await svc.list_client_invoices(db)


@router.get("/invoices/by-employee", dependencies=[Depends(_clients_read)])
async def client_invoices_by_employee(db: DbSession, employee_id: str = Query(...)) -> list[dict]:
    return await svc.invoices_by_employee(db, employee_id)


@router.post("/invoices/reminders", dependencies=[Depends(_clients_write)])
async def send_overdue_reminders(db: DbSession) -> dict:
    return await svc.send_overdue_reminders(db)


@router.get("/industries", dependencies=[Depends(_clients_read)])
async def list_industries(db: DbSession) -> list[dict]:
    return await svc.list_industries(db)


@router.get("/overview", dependencies=[Depends(_clients_read)])
async def clients_overview(
    db: DbSession,
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    industry: str | None = Query(None),
    sort: str = Query("name"),
    sort_dir: str = Query("asc", alias="sortDir", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, alias="pageSize"),
) -> dict:
    """One page of clients with project counts: the Clients directory in one call."""
    return await svc.clients_overview(
        db,
        q=q,
        status_filter=status_filter,
        industry=industry,
        sort=sort,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )


@router.get("/options", dependencies=[Depends(_clients_read)])
async def client_options(db: DbSession) -> list[dict]:
    """Id, name, status and internal flag of every client, for pickers."""
    return await svc.client_options(db)


@router.get("/{client_id}/detail", dependencies=[Depends(_clients_read)])
async def client_detail(
    db: DbSession, user: CurrentUser, client_id: uuid.UUID
) -> dict:
    """The client and its projects in one call (projects only for people who can read them)."""
    from app.modules.projects.router import _projects_read

    try:
        await _projects_read(user, db)
        can_read_projects = True
    except HTTPException as exc:
        if exc.status_code != 403:
            raise
        can_read_projects = False
    return await svc.get_client_detail(db, client_id, include_projects=can_read_projects)


@router.get("/{client_id}", dependencies=[Depends(_clients_read)])
async def get_client(db: DbSession, client_id: uuid.UUID) -> dict:
    return await svc.get_client(db, client_id)


@router.post("", dependencies=[Depends(_clients_write)])
async def create_client(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_client(db, user, body)


@router.patch("/{client_id}", dependencies=[Depends(_clients_write)])
async def update_client(
    db: DbSession, user: CurrentUser, client_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.update_client(db, user, client_id, body)


@router.delete("/{client_id}", dependencies=[Depends(_clients_write)])
async def delete_client(db: DbSession, user: CurrentUser, client_id: uuid.UUID) -> dict:
    """Archive a client (compatibility alias for POST /{id}/archive); a client is never deleted."""
    return await svc.archive_client(db, client_id, user)


@router.post("/{client_id}/archive", dependencies=[Depends(_clients_write)])
async def archive_client(db: DbSession, user: CurrentUser, client_id: uuid.UUID) -> dict:
    return await svc.archive_client(db, client_id, user)


@router.post("/{client_id}/restore", dependencies=[Depends(_clients_write)])
async def restore_client(db: DbSession, user: CurrentUser, client_id: uuid.UUID) -> dict:
    return await svc.restore_client(db, client_id, user)


@router.get("/{client_id}/locations", dependencies=[Depends(_clients_read)])
async def list_client_locations(db: DbSession, client_id: uuid.UUID) -> list[dict]:
    return await svc.list_client_locations(db, client_id)


@router.post("/{client_id}/locations", dependencies=[Depends(_clients_write)])
async def create_client_location(
    db: DbSession, user: CurrentUser, client_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    """Internal client: send ``locationId`` (company office). Direct / Intermediary: ``address`` + ``country``."""
    return await svc.create_client_location(db, user, client_id, body)


@router.patch("/{client_id}/locations/{location_id}", dependencies=[Depends(_clients_write)])
async def update_client_location(
    db: DbSession, user: CurrentUser, client_id: uuid.UUID, location_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.update_client_location(db, user, client_id, location_id, body)


@router.delete("/{client_id}/locations/{location_id}", dependencies=[Depends(_clients_write)])
async def delete_client_location(
    db: DbSession, user: CurrentUser, client_id: uuid.UUID, location_id: uuid.UUID
) -> dict:
    return await svc.delete_client_location(db, user, client_id, location_id)


@router.put("/{client_id}/logo", dependencies=[Depends(_clients_write)])
async def put_logo(
    db: DbSession,
    client_id: uuid.UUID,
    file: UploadFile = File(...),
) -> dict:
    data, content_type = await read_validated_logo(file)
    ext = logo_extension(content_type)
    object_key = f"clients/{client_id}/logo/{uuid.uuid4()}.{ext}"
    storage = get_storage()
    storage.put_bytes(object_key, data, content_type)
    previous = None
    try:
        result = await svc.set_logo(db, client_id, object_key)
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


@router.get("/{client_id}/logo", dependencies=[Depends(_clients_read)])
async def get_logo(
    db: DbSession,
    client_id: uuid.UUID,
    v: str | None = Query(None, description="Logo object key the page was built with"),
    if_none_match: str | None = Header(None),
) -> Response:
    key = await svc.get_logo_key(db, client_id)
    return await cached_object_response(
        get_storage(), key, version=v, if_none_match=if_none_match
    )


@router.delete("/{client_id}/logo", dependencies=[Depends(_clients_write)])
async def delete_logo(db: DbSession, client_id: uuid.UUID) -> dict:
    result = await svc.clear_logo(db, client_id)
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


@router.get("/{client_id}/invoices", dependencies=[Depends(_clients_read)])
async def client_invoices(db: DbSession, client_id: uuid.UUID) -> list[dict]:
    return await svc.list_client_invoices(db, client_id)


@router.post("/{client_id}/invoices", dependencies=[Depends(_clients_write)])
async def create_client_invoice(
    db: DbSession, user: CurrentUser, client_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    body = {**body, "customerId": str(client_id)}
    return await svc.create_client_invoice(db, user, body)


@router.patch("/invoices/{invoice_id}", dependencies=[Depends(_clients_write)])
async def update_client_invoice(db: DbSession, invoice_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await svc.update_client_invoice(db, invoice_id, body)


@router.get("/{client_id}/invoices/summary", dependencies=[Depends(_clients_read)])
async def summary_by_customer(db: DbSession, client_id: uuid.UUID) -> dict:
    return await svc.invoice_summary_by_client(db, str(client_id))
