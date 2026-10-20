"""Employee skill certificate upload/download (MinIO object on EMPLOYEE_SKILL)."""

from __future__ import annotations

import io
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.employee import router as employees_router

TARGET_ID = uuid.uuid4()
SKILL_ID = uuid.uuid4()
HR_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()

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

EMPLOYEE_OTHER = {
    "employeeId": str(OTHER_ID),
    "emailId": "other@example.com",
    "department": "EMPLOYEE",
    "role": "EMPLOYEE",
    "firstName": "Sam",
    "lastName": "Other",
    "viewAccess": False,
    "editAccess": False,
    "fullAccess": False,
    "createAccess": False,
}


def _emp(*, employee_id: uuid.UUID = TARGET_ID):
    emp = MagicMock()
    emp.employee_id = employee_id
    emp.role = "EMPLOYEE"
    emp.department = "EMPLOYEE"
    return emp


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
async def other_client():
    transport = ASGITransport(app=_build_app(EMPLOYEE_OTHER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def storage():
    mock = MagicMock()
    mock.put_bytes = MagicMock()
    mock.get_bytes = MagicMock(return_value=(b"%PDF-bytes", "application/pdf"))
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


@pytest.mark.asyncio
async def test_upload_skill_certificate_ok(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    monkeypatch.setattr(
        "app.modules.employee.files.read_validated_document",
        AsyncMock(return_value=(b"%PDF-1.4", "application/pdf")),
    )
    monkeypatch.setattr(
        "app.modules.employee.router.skill_svc.set_skill_certificate",
        AsyncMock(
            return_value=(
                {
                    "skillId": str(SKILL_ID),
                    "hasCertificate": True,
                    "certificateFileName": "sql.pdf",
                    "certificateObjectKey": "employees/x/sql.pdf",
                },
                None,
            )
        ),
    )
    response = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/skills/{SKILL_ID}/certificate",
        files=[("file", ("sql.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf"))],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["hasCertificate"] is True
    assert body["certificateFileName"] == "sql.pdf"
    storage.put_bytes.assert_called_once()


@pytest.mark.asyncio
async def test_delete_skill_certificate_ok(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    clear_mock = AsyncMock(
        return_value={
            "skillId": str(SKILL_ID),
            "hasCertificate": False,
            "certificateFileName": None,
            "certificateObjectKey": None,
        }
    )
    monkeypatch.setattr(
        "app.modules.employee.router.skill_svc.clear_skill_certificate",
        clear_mock,
    )
    response = await hr_client.delete(
        f"/api/v1/employees/{TARGET_ID}/skills/{SKILL_ID}/certificate"
    )
    assert response.status_code == 200
    assert response.json()["hasCertificate"] is False
    clear_mock.assert_awaited()


@pytest.mark.asyncio
async def test_upload_skill_certificate_forbidden_other_employee(
    other_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    set_mock = AsyncMock()
    monkeypatch.setattr(
        "app.modules.employee.router.skill_svc.set_skill_certificate",
        set_mock,
    )
    response = await other_client.post(
        f"/api/v1/employees/{TARGET_ID}/skills/{SKILL_ID}/certificate",
        files=[("file", ("sql.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf"))],
    )
    assert response.status_code == 403
    set_mock.assert_not_awaited()
    storage.put_bytes.assert_not_called()


@pytest.mark.asyncio
async def test_download_skill_certificate_ok(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    row = MagicMock()
    row.certificate_object_key = "employees/x/skills/s/certificate/sql.pdf"
    row.certificate_file_name = "sql.pdf"
    monkeypatch.setattr(
        "app.modules.employee.router.skill_svc.get_employee_skill",
        AsyncMock(return_value=row),
    )
    response = await hr_client.get(
        f"/api/v1/employees/{TARGET_ID}/skills/{SKILL_ID}/certificate"
    )
    assert response.status_code == 200
    assert response.content == b"%PDF-bytes"
    storage.get_bytes.assert_called_once_with(row.certificate_object_key)


@pytest.mark.asyncio
async def test_download_skill_certificate_missing(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch, storage: MagicMock
) -> None:
    monkeypatch.setattr(
        "app.modules.employee.access.get_employee_or_404",
        AsyncMock(return_value=_emp()),
    )
    row = MagicMock()
    row.certificate_object_key = None
    row.certificate_file_name = None
    monkeypatch.setattr(
        "app.modules.employee.router.skill_svc.get_employee_skill",
        AsyncMock(return_value=row),
    )
    response = await hr_client.get(
        f"/api/v1/employees/{TARGET_ID}/skills/{SKILL_ID}/certificate"
    )
    assert response.status_code == 404
    storage.get_bytes.assert_not_called()
