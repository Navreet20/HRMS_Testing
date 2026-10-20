"""Employee profile-update in-app notifications for HR."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.employee import notifications as profile_notifications
from app.modules.employee import router as employees_router

TARGET_ID = uuid.uuid4()
HR_ID = uuid.uuid4()
COMPANY_ID = uuid.uuid4()
NOTIFICATION_ID = uuid.uuid4()

HR_USER = {
    "employeeId": str(HR_ID),
    "emailId": "hr@example.com",
    "department": "HR",
    "role": "HR",
    "firstName": "Pat",
    "lastName": "HR",
    "companyId": str(COMPANY_ID),
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
    "firstName": "John",
    "lastName": "Smith",
    "companyId": str(COMPANY_ID),
    "viewAccess": False,
    "editAccess": False,
    "fullAccess": False,
    "createAccess": False,
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


def test_profile_updated_message_includes_name_and_id() -> None:
    emp = MagicMock()
    emp.first_name = "John"
    emp.last_name = "Smith"
    emp.business_employee_id = "EMP1024"
    emp.employee_code = None
    assert (
        profile_notifications.profile_updated_message(emp)
        == "John Smith (EMP1024) has updated their profile."
    )


@pytest.mark.asyncio
async def test_self_patch_creates_profile_notification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    emp = MagicMock()
    emp.employee_id = TARGET_ID
    emp.first_name = "John"
    emp.last_name = "Smith"
    emp.business_employee_id = "EMP1024"
    emp.is_system_account = False

    patched = {"ok": True}
    monkeypatch.setattr(
        employees_router._svc,
        "_get",
        AsyncMock(return_value=emp),
    )
    monkeypatch.setattr(
        employees_router._svc,
        "patch_employee",
        AsyncMock(return_value=patched),
    )
    notify = AsyncMock()
    monkeypatch.setattr(
        employees_router.profile_notifications,
        "notify_profile_updated",
        notify,
    )
    monkeypatch.setattr(
        "app.modules.employee.field_permissions.assert_patch_fields_allowed",
        lambda *args, **kwargs: None,
    )

    transport = ASGITransport(app=_build_app(EMPLOYEE_SELF))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.patch(
            f"/api/v1/employees/{TARGET_ID}",
            json={"addressLine1": "99 Draft Lane"},
        )

    assert response.status_code == 200
    notify.assert_awaited_once()
    assert notify.await_args.args[2] is emp


@pytest.mark.asyncio
async def test_hr_lists_and_marks_profile_notifications(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listed = {
        "notifications": [
            {
                "notificationId": str(NOTIFICATION_ID),
                "type": "PROFILE_UPDATED",
                "title": "John Smith (EMP1024) has updated their profile.",
                "body": "John Smith (EMP1024) has updated their profile.",
                "linkPath": "/employees",
                "referenceId": str(TARGET_ID),
                "isRead": False,
                "createdDate": "2026-08-31T12:00:00+00:00",
            }
        ],
        "unreadCount": 1,
    }
    monkeypatch.setattr(
        employees_router.profile_notifications,
        "list_profile_notifications",
        AsyncMock(return_value=listed),
    )
    monkeypatch.setattr(
        employees_router.profile_notifications,
        "mark_profile_notification_read",
        AsyncMock(
            return_value={**listed["notifications"][0], "isRead": True},
        ),
    )

    transport = ASGITransport(app=_build_app(HR_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        listed_response = await ac.get(
            "/api/v1/employees/notifications?unreadOnly=true"
        )
        marked = await ac.patch(
            f"/api/v1/employees/notifications/{NOTIFICATION_ID}"
        )

    assert listed_response.status_code == 200
    assert listed_response.json()["unreadCount"] == 1
    assert marked.status_code == 200
    assert marked.json()["isRead"] is True
