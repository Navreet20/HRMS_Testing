"""Self-service profile changes: submit / pending / approve / reject."""

from __future__ import annotations

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
from app.modules.employee.service import EmployeeService

TARGET_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()
HR_ID = uuid.uuid4()
CHANGE_ID = uuid.uuid4()

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

PAYLOAD = {
    "addressLine1": "200 Review Ave",
    "city": "Dallas",
    "state": "TX",
    "postalCode": "75201",
    "country": "US",
    "emergencyName": "Alex",
    "emergencyPhone": "+1-555-0101",
    "emergencyRelation": "Sibling",
    "emergencyEmployeeId": None,
}


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
async def hr_client():
    transport = ASGITransport(app=_build_app(HR_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def _hierarchy_empty(monkeypatch: pytest.MonkeyPatch):
    async def _empty(_session):
        return {}

    monkeypatch.setattr(
        "app.modules.employee.access.load_hierarchy",
        _empty,
    )


def test_normalize_allows_only_address_and_emergency() -> None:
    svc = EmployeeService()
    out = svc._normalize_profile_payload(PAYLOAD)
    assert out["addressLine1"] == "200 Review Ave"
    assert out["emergencyName"] == "Alex"

    with_alt = svc._normalize_profile_payload(
        {**PAYLOAD, "alternatePhone": "+15550199"}
    )
    assert with_alt["alternatePhone"] == "+15550199"

    with_gender = svc._normalize_profile_payload({**PAYLOAD, "gender": "female"})
    assert with_gender["gender"] == "FEMALE"

    with_demo = svc._normalize_profile_payload(
        {
            **PAYLOAD,
            "phone": "+1-555-0100",
            "maritalStatus": "single",
            "nationality": "us",
            "ethnicity": "asian",
        }
    )
    assert with_demo["phoneNumber"] == "+15550100"
    assert with_demo["maritalStatus"] == "SINGLE"
    assert with_demo["nationality"] == "US"
    assert with_demo["ethnicity"] == "ASIAN"

    with pytest.raises(HTTPException) as exc:
        svc._normalize_profile_payload({**PAYLOAD, "firstName": "Nope"})
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_submit_profile_change_self_only(
    self_client: AsyncClient, other_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    pending = {
        "id": str(CHANGE_ID),
        "employeeId": str(TARGET_ID),
        "payload": PAYLOAD,
        "status": "PENDING",
        "comments": None,
        "createdBy": "Sam Worker",
        "reviewedBy": None,
        "createdDate": "2026-08-04T00:00:00Z",
        "updatedDate": "2026-08-04T00:00:00Z",
    }
    submit = AsyncMock(return_value=pending)
    monkeypatch.setattr(_svc, "submit_profile_change", submit)

    ok = await self_client.post(
        f"/api/v1/employees/{TARGET_ID}/profile-changes",
        json=PAYLOAD,
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "PENDING"
    submit.assert_awaited_once()

    submit.side_effect = HTTPException(
        status_code=403, detail="Only the employee can submit their own profile change"
    )
    forbidden = await other_client.post(
        f"/api/v1/employees/{TARGET_ID}/profile-changes",
        json=PAYLOAD,
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_employee_cannot_approve_profile_change(
    self_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    approve = AsyncMock(return_value={"ok": True})
    monkeypatch.setattr(_svc, "approve_profile_change", approve)
    response = await self_client.post(
        f"/api/v1/employees/{TARGET_ID}/profile-changes/{CHANGE_ID}/approve",
        json={},
    )
    assert response.status_code == 403
    approve.assert_not_awaited()


@pytest.mark.asyncio
async def test_hr_approve_and_reject_profile_change(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    approve = AsyncMock(
        return_value={
            "change": {"id": str(CHANGE_ID), "status": "APPROVED"},
            "employee": {"employeeId": str(TARGET_ID), "pendingProfileChange": False},
        }
    )
    reject = AsyncMock(
        return_value={"id": str(CHANGE_ID), "status": "REJECTED", "comments": "Incomplete"}
    )
    monkeypatch.setattr(_svc, "approve_profile_change", approve)
    monkeypatch.setattr(_svc, "reject_profile_change", reject)

    approved = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/profile-changes/{CHANGE_ID}/approve",
        json={},
    )
    assert approved.status_code == 200
    assert approved.json()["change"]["status"] == "APPROVED"
    approve.assert_awaited_once()

    rejected = await hr_client.post(
        f"/api/v1/employees/{TARGET_ID}/profile-changes/{CHANGE_ID}/reject",
        json={"comments": "Incomplete"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"
    reject.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_pending_self_or_hr(
    self_client: AsyncClient,
    other_client: AsyncClient,
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pending = {
        "id": str(CHANGE_ID),
        "employeeId": str(TARGET_ID),
        "payload": PAYLOAD,
        "status": "PENDING",
    }
    get_pending = AsyncMock(return_value=pending)
    monkeypatch.setattr(_svc, "get_pending_profile_change", get_pending)

    self_ok = await self_client.get(
        f"/api/v1/employees/{TARGET_ID}/profile-changes/pending"
    )
    assert self_ok.status_code == 200
    assert self_ok.json()["status"] == "PENDING"

    hr_ok = await hr_client.get(
        f"/api/v1/employees/{TARGET_ID}/profile-changes/pending"
    )
    assert hr_ok.status_code == 200

    other_forbidden = await other_client.get(
        f"/api/v1/employees/{TARGET_ID}/profile-changes/pending"
    )
    assert other_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_employee_self_patch_blocked(
    self_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    emp = MagicMock()
    emp.is_system_account = False
    monkeypatch.setattr(_svc, "_get", AsyncMock(return_value=emp))
    response = await self_client.patch(
        f"/api/v1/employees/{TARGET_ID}",
        json={"firstName": "Hacked"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Not allowed to edit field(s): firstName"


@pytest.mark.asyncio
async def test_hr_can_patch_personal_fields_after_profile_complete(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """HR editing another employee must not hit self-edit field locks."""
    emp = MagicMock()
    emp.is_system_account = False
    monkeypatch.setattr(_svc, "_get", AsyncMock(return_value=emp))
    patch_employee = AsyncMock(
        return_value={
            "employeeId": str(TARGET_ID),
            "firstName": "Ada",
            "lastName": "Lovelace",
            "personalEmail": "ada.personal@example.com",
        }
    )
    monkeypatch.setattr(_svc, "patch_employee", patch_employee)

    response = await hr_client.patch(
        f"/api/v1/employees/{TARGET_ID}",
        json={
            "firstName": "Ada",
            "lastName": "Lovelace",
            "middleName": "A",
            "dateOfBirth": "1990-05-05",
            "personalEmail": "ada.personal@example.com",
            "phoneNumber": "+15550100",
            "gender": "FEMALE",
            "ethnicity": "ASIAN",
            "maritalStatus": "SINGLE",
            "nationality": "US",
            "addressLine1": "1 Main St",
            "addressLine2": "Apt 2",
            "city": "Austin",
            "state": "TX",
            "postalCode": "78701",
            "country": "US",
            "emergencyName": "Bob",
            "emergencyPhone": "+15550101",
            "emergencyRelation": "Sibling",
            "emergencyEmployeeId": None,
        },
    )
    assert response.status_code == 200
    patch_employee.assert_awaited_once()
