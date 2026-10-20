"""Documents + avatar hardening: access, validation, MinIO/DB rollback."""

from __future__ import annotations

import io
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.employee import router as employees_router
from app.modules.employee.router import _svc

TARGET_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()
HR_ID = uuid.uuid4()

HR_USER = {
    "employeeId": str(HR_ID),
    "emailId": "hr@example.com",
    "department": "HR",
    "role": "HR",
    "firstName": "Pat",
    "lastName": "HR",
    "viewAccess": True,
    "editAccess": True,
    "fullAccess": False,
    "createAccess": True,
}

VIEW_ONLY_USER = {
    **HR_USER,
    "employeeId": str(uuid.uuid4()),
    "editAccess": False,
    "viewAccess": True,
    "fullAccess": False,
}

EMPLOYEE_SELF = {
    "employeeId": str(TARGET_ID),
    "emailId": "worker@example.com",
    "department": "EMPLOYEE",
    "role": "EMPLOYEE",
    "firstName": "Sam",
    "lastName": "Worker",
    "viewAccess": False,
    "editAccess": False,
    "fullAccess": False,
    "createAccess": False,
}

EMPLOYEE_OTHER = {
    **EMPLOYEE_SELF,
    "employeeId": str(OTHER_ID),
    "emailId": "other@example.com",
}


def _emp(*, employee_id: uuid.UUID = TARGET_ID, role: str = "EMPLOYEE", department: str = "EMPLOYEE", photo: str | None = None):
    emp = MagicMock()
    emp.employee_id = employee_id
    emp.role = role
    emp.department = department
    emp.avatar_object_key = photo
    return emp


def _doc(*, doc_id: uuid.UUID | None = None, employee_id: uuid.UUID = TARGET_ID, url: str = "employees/x/y/a.pdf"):
    doc = MagicMock()
    doc.id = doc_id or uuid.uuid4()
    doc.employee_id = employee_id
    doc.url = url
    doc.file_name = "a.pdf"
    doc.status = "ACTIVE"
    return doc


def _build_app(user: dict[str, Any]) -> FastAPI:
    app = FastAPI()
    app.include_router(employees_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return user

    async def _db() -> Any:
        yield MagicMock()

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    return app


@pytest.fixture
async def hr_client():
    transport = ASGITransport(app=_build_app(HR_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def view_client():
    transport = ASGITransport(app=_build_app(VIEW_ONLY_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def self_client():
    transport = ASGITransport(app=_build_app(EMPLOYEE_SELF))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def other_client():
    transport = ASGITransport(app=_build_app(EMPLOYEE_OTHER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def storage():
    mock = MagicMock()
    mock.put_bytes = MagicMock()
    mock.get_bytes = MagicMock(return_value=(b"bytes", "application/pdf"))
    mock.remove = MagicMock()
    with patch("app.modules.employee.router.get_storage", return_value=mock):
        with patch("app.core.storage.get_storage", return_value=mock):
            yield mock


@pytest.fixture(autouse=True)
def _hierarchy_empty(monkeypatch: pytest.MonkeyPatch):
    async def _empty(_session):
        return {}

    monkeypatch.setattr(
        "app.modules.employee.access.load_hierarchy",
        _empty,
    )


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_documents_authorized(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    monkeypatch.setattr(_svc, "list_documents", AsyncMock(return_value=[{"id": "1"}]))
    response = await hr_client.get(f"/api/v1/employees/{TARGET_ID}/documents")
    assert response.status_code == 200
    assert response.json() == [{"id": "1"}]


@pytest.mark.asyncio
async def test_list_documents_forbidden_other_employee(
    other_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    list_mock = AsyncMock(return_value=[])
    monkeypatch.setattr(_svc, "list_documents", list_mock)
    response = await other_client.get(f"/api/v1/employees/{TARGET_ID}/documents")
    assert response.status_code == 403
    list_mock.assert_not_awaited()
    storage.put_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_upload_document_ok(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    monkeypatch.setattr(
        _svc,
        "upload_document",
        AsyncMock(return_value={"id": "d1", "objectKey": "k", "fileName": "a.pdf"}),
    )
    response = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/documents",
        params={"documents": '[{"fileName":"a.pdf","documentName":"a.pdf"}]'},
        files=[("files", ("a.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf"))],
    )
    assert response.status_code == 200
    storage.put_bytes.assert_called_once()
    assert response.json()[0]["id"] == "d1"


@pytest.mark.asyncio
async def test_upload_forbidden_without_edit(
    view_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    upload_mock = AsyncMock()
    monkeypatch.setattr(_svc, "upload_document", upload_mock)
    response = await view_client.post(
        f"/api/v1/employees/{TARGET_ID}/documents",
        params={"documents": '[{"fileName":"a.pdf"}]'},
        files=[("files", ("a.pdf", io.BytesIO(b"%PDF"), "application/pdf"))],
    )
    assert response.status_code == 403
    storage.put_bytes.assert_not_called()
    upload_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_upload_empty_file_400(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    response = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/documents",
        params={"documents": '[{"fileName":"a.pdf"}]'},
        files=[("files", ("a.pdf", io.BytesIO(b""), "application/pdf"))],
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()
    storage.put_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_upload_disallowed_type_400(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    response = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/documents",
        params={"documents": '[{"fileName":"a.exe"}]'},
        files=[("files", ("a.exe", io.BytesIO(b"MZ"), "application/x-msdownload"))],
    )
    assert response.status_code == 400
    assert "Disallowed" in response.json()["detail"]
    storage.put_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_upload_oversized_400(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    big = b"x" * (10 * 1024 * 1024 + 1)
    response = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/documents",
        params={"documents": '[{"fileName":"a.pdf"}]'},
        files=[("files", ("a.pdf", io.BytesIO(big), "application/pdf"))],
    )
    assert response.status_code == 400
    assert "10 MB" in response.json()["detail"]
    storage.put_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_upload_minio_fail_no_db_row(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    storage.put_bytes.side_effect = HTTPException(status_code=502, detail="Upload to object storage failed: boom")
    upload_mock = AsyncMock()
    monkeypatch.setattr(_svc, "upload_document", upload_mock)
    response = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/documents",
        params={"documents": '[{"fileName":"a.pdf"}]'},
        files=[("files", ("a.pdf", io.BytesIO(b"%PDF"), "application/pdf"))],
    )
    assert response.status_code == 502
    upload_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_upload_db_fail_removes_object(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    monkeypatch.setattr(_svc, "upload_document", AsyncMock(side_effect=RuntimeError("db down")))
    with pytest.raises(RuntimeError):
        await hr_client.post(
            f"/api/v1/employees/{TARGET_ID}/documents",
            params={"documents": '[{"fileName":"a.pdf"}]'},
            files=[("files", ("a.pdf", io.BytesIO(b"%PDF"), "application/pdf"))],
        )
    storage.put_bytes.assert_called_once()
    storage.remove.assert_called_once()


@pytest.mark.asyncio
async def test_download_ownership_ok(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    doc = _doc(url="employees/owned/key.pdf")
    monkeypatch.setattr(_svc, "get_document_by_object_key", AsyncMock(return_value=doc))
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp(employee_id=doc.employee_id)),
    )
    response = await hr_client.get(
        "/api/v1/employees/documents/download",
        params={"filePath": "employees/owned/key.pdf", "fileName": "a.pdf"},
    )
    assert response.status_code == 200
    assert response.content == b"bytes"
    storage.get_bytes.assert_called_once_with("employees/owned/key.pdf")


@pytest.mark.asyncio
async def test_download_unknown_key_404(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        _svc,
        "get_document_by_object_key",
        AsyncMock(side_effect=HTTPException(status_code=404, detail="Document not found")),
    )
    response = await hr_client.get(
        "/api/v1/employees/documents/download",
        params={"filePath": "nope", "fileName": "a.pdf"},
    )
    assert response.status_code == 404
    storage.get_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_download_forbidden_other_employee(
    other_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    doc = _doc()
    monkeypatch.setattr(_svc, "get_document_by_object_key", AsyncMock(return_value=doc))
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    response = await other_client.get(
        "/api/v1/employees/documents/download",
        params={"filePath": doc.url, "fileName": "a.pdf"},
    )
    assert response.status_code == 403
    storage.get_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_delete_document_requires_edit(
    view_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    doc = _doc()
    monkeypatch.setattr(_svc, "get_active_document", AsyncMock(return_value=doc))
    delete_mock = AsyncMock()
    monkeypatch.setattr(_svc, "delete_document", delete_mock)
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    response = await view_client.delete(f"/api/v1/employees/documents/{doc.id}")
    assert response.status_code == 403
    delete_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_document_ok(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc = _doc()
    monkeypatch.setattr(_svc, "get_active_document", AsyncMock(return_value=doc))
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    monkeypatch.setattr(_svc, "delete_document", AsyncMock(return_value={"id": str(doc.id), "status": "INACTIVE"}))
    response = await hr_client.delete(f"/api/v1/employees/documents/{doc.id}")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Avatar
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_avatar_upload_ok(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    emp = _emp()
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=emp),
    )
    monkeypatch.setattr(
        _svc,
        "set_avatar",
        AsyncMock(return_value={"employeeId": str(TARGET_ID), "avatarObjectKey": "new-key", "previousObjectKey": None}),
    )
    response = await hr_client.put(
        f"/api/v1/employees/{TARGET_ID}/avatar",
        files=[("file", ("photo.png", io.BytesIO(b"\x89PNG"), "image/png"))],
    )
    assert response.status_code == 200
    storage.put_bytes.assert_called_once()
    assert response.json()["avatarObjectKey"] == "new-key"


@pytest.mark.asyncio
async def test_avatar_replace_removes_old(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    emp = _emp(photo="employees/old.png")
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=emp),
    )
    monkeypatch.setattr(
        _svc,
        "set_avatar",
        AsyncMock(
            return_value={
                "employeeId": str(TARGET_ID),
                "avatarObjectKey": "employees/new.png",
                "previousObjectKey": "employees/old.png",
            }
        ),
    )
    response = await hr_client.put(
        f"/api/v1/employees/{TARGET_ID}/avatar",
        files=[("file", ("photo.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg"))],
    )
    assert response.status_code == 200
    storage.remove.assert_called_with("employees/old.png")


@pytest.mark.asyncio
async def test_avatar_self_upload_ok(self_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    monkeypatch.setattr(
        _svc,
        "set_avatar",
        AsyncMock(return_value={"employeeId": str(TARGET_ID), "avatarObjectKey": "k", "previousObjectKey": None}),
    )
    response = await self_client.put(
        f"/api/v1/employees/{TARGET_ID}/avatar",
        files=[("file", ("photo.webp", io.BytesIO(b"RIFF"), "image/webp"))],
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_avatar_admin_self_without_edit_flags_delete_ok(
    monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    """Staff roles on My Profile must manage own photo without editAccess."""
    admin_self = {
        "employeeId": str(TARGET_ID),
        "emailId": "admin@example.com",
        "department": "ADMIN",
        "role": "ADMIN",
        "firstName": "Anna",
        "lastName": "Admin",
        "viewAccess": False,
        "editAccess": False,
        "fullAccess": False,
        "createAccess": False,
    }
    transport = ASGITransport(app=_build_app(admin_self))
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp(role="ADMIN", department="ADMIN", photo="old.png")),
    )
    monkeypatch.setattr(
        "app.modules.employee.access.load_hierarchy",
        AsyncMock(return_value={}),
    )
    monkeypatch.setattr(
        _svc,
        "clear_avatar",
        AsyncMock(
            return_value={
                "employeeId": str(TARGET_ID),
                "avatarObjectKey": None,
                "previousObjectKey": "old.png",
            }
        ),
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete(f"/api/v1/employees/{TARGET_ID}/avatar")
    assert response.status_code == 200
    assert response.json()["avatarObjectKey"] is None


@pytest.mark.asyncio
async def test_avatar_unauthorized(other_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    response = await other_client.put(
        f"/api/v1/employees/{TARGET_ID}/avatar",
        files=[("file", ("photo.png", io.BytesIO(b"\x89PNG"), "image/png"))],
    )
    assert response.status_code == 403
    storage.put_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_avatar_oversized_400(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    big = b"x" * (2 * 1024 * 1024 + 1)
    response = await hr_client.put(
        f"/api/v1/employees/{TARGET_ID}/avatar",
        files=[("file", ("photo.png", io.BytesIO(big), "image/png"))],
    )
    assert response.status_code == 400
    storage.put_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_avatar_minio_fail(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    storage.put_bytes.side_effect = HTTPException(status_code=503, detail="Object storage unavailable")
    set_mock = AsyncMock()
    monkeypatch.setattr(_svc, "set_avatar", set_mock)
    response = await hr_client.put(
        f"/api/v1/employees/{TARGET_ID}/avatar",
        files=[("file", ("photo.png", io.BytesIO(b"\x89PNG"), "image/png"))],
    )
    assert response.status_code == 503
    set_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_avatar_db_fail_removes_object(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    monkeypatch.setattr(_svc, "set_avatar", AsyncMock(side_effect=RuntimeError("db")))
    with pytest.raises(RuntimeError):
        await hr_client.put(
            f"/api/v1/employees/{TARGET_ID}/avatar",
            files=[("file", ("photo.png", io.BytesIO(b"\x89PNG"), "image/png"))],
        )
    storage.remove.assert_called_once()


@pytest.mark.asyncio
async def test_avatar_get_and_delete(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock) -> None:
    emp = _emp(photo="employees/photo.png")
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=emp),
    )
    storage.get_bytes.return_value = (b"img", "image/png")
    get_resp = await hr_client.get(f"/api/v1/employees/{TARGET_ID}/avatar")
    assert get_resp.status_code == 200
    assert get_resp.content == b"img"

    monkeypatch.setattr(
        _svc,
        "clear_avatar",
        AsyncMock(
            return_value={
                "employeeId": str(TARGET_ID),
                "avatarObjectKey": None,
                "previousObjectKey": "employees/photo.png",
            }
        ),
    )
    del_resp = await hr_client.delete(f"/api/v1/employees/{TARGET_ID}/avatar")
    assert del_resp.status_code == 200
    storage.remove.assert_called_with("employees/photo.png")


@pytest.mark.asyncio
async def test_avatar_get_missing_404(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp(photo=None)),
    )
    response = await hr_client.get(f"/api/v1/employees/{TARGET_ID}/avatar")
    assert response.status_code == 404
