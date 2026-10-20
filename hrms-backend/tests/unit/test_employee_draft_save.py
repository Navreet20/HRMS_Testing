"""EMP-DATA-11: save draft + employee_code; invite retains code."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.core.roles import Role, Status
from app.modules.employee.access_fields import resolve_company_for_write
from app.modules.employee.service import EmployeeService


def _session_no_email_collision() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    empty = MagicMock()
    empty.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=empty)
    return session


@pytest.mark.asyncio
async def test_create_draft_requires_identity_stub() -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    with pytest.raises(HTTPException) as exc:
        await svc.create_draft(
            session,
            {"firstName": "Ada"},
            {"firstName": "HR", "lastName": "Admin"},
        )
    assert exc.value.status_code == 400
    assert "draft" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_create_draft_allocates_code_without_business_id() -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    actor = {"firstName": "HR", "lastName": "Admin"}

    with (
        patch.object(svc, "_assign_employee_code", AsyncMock(return_value="ADA_LOV")),
        patch.object(svc, "_apply_master_fields", AsyncMock()),
        patch.object(svc, "_apply_profile_payload", AsyncMock()),
        patch.object(
            svc,
            "_to_dict",
            AsyncMock(
                return_value={
                    "status": Status.NEW.value,
                    "employeeCode": "ADA_LOV",
                    "businessEmployeeId": None,
                }
            ),
        ),
        patch("app.modules.employee.service.apply_profile_fields", MagicMock()),
        patch(
            "app.modules.employee.service.record_field_change",
            AsyncMock(return_value=0),
        ),
    ):
        result = await svc.create_draft(
            session,
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
            },
            actor,
        )

    emp = session.add.call_args[0][0]
    assert emp.status == Status.NEW.value
    assert emp.employee_code == "ADA_LOV"
    assert emp.password is None
    assert emp.role == Role.EMPLOYEE.value
    assert emp.department == Role.EMPLOYEE.value
    assert emp.company == "Default"
    assert result["employeeCode"] == "ADA_LOV"
    assert result["businessEmployeeId"] is None


@pytest.mark.asyncio
async def test_create_draft_rejects_em_dash_company_uses_actor() -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    actor = {
        "firstName": "HR",
        "lastName": "Admin",
        "company": {"companyName": "EAOVA"},
    }

    with (
        patch.object(svc, "_assign_employee_code", AsyncMock(return_value="ADA_LOV")),
        patch.object(svc, "_apply_master_fields", AsyncMock()),
        patch.object(svc, "_apply_profile_payload", AsyncMock()),
        patch.object(
            svc,
            "_to_dict",
            AsyncMock(return_value={"status": Status.NEW.value}),
        ),
        patch("app.modules.employee.service.apply_profile_fields", MagicMock()),
        patch(
            "app.modules.employee.service.record_field_change",
            AsyncMock(return_value=0),
        ),
    ):
        await svc.create_draft(
            session,
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "dateOfBirth": "1990-05-05",
                "company": "—",
            },
            actor,
        )

    emp = session.add.call_args[0][0]
    assert emp.company == "EAOVA"
    assert emp.company != "—"
    assert emp.role == Role.EMPLOYEE.value
    assert emp.department == Role.EMPLOYEE.value


@pytest.mark.asyncio
async def test_create_draft_omitted_company_uses_default() -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()

    with (
        patch.object(svc, "_assign_employee_code", AsyncMock(return_value="ADA_LOV")),
        patch.object(svc, "_apply_master_fields", AsyncMock()),
        patch.object(svc, "_apply_profile_payload", AsyncMock()),
        patch.object(
            svc,
            "_to_dict",
            AsyncMock(return_value={"status": Status.NEW.value}),
        ),
        patch("app.modules.employee.service.apply_profile_fields", MagicMock()),
        patch(
            "app.modules.employee.service.record_field_change",
            AsyncMock(return_value=0),
        ),
    ):
        await svc.create_draft(
            session,
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "dateOfBirth": "1990-05-05",
            },
            {"firstName": "HR", "lastName": "Admin"},
        )

    emp = session.add.call_args[0][0]
    assert emp.company == "Default"
    assert emp.role == Role.EMPLOYEE.value
    assert emp.department == Role.EMPLOYEE.value


def test_resolve_company_for_write_placeholders() -> None:
    assert resolve_company_for_write("—", None) == "Default"
    assert resolve_company_for_write("  ", None) == "Default"
    assert resolve_company_for_write(None, {"company": {"companyName": "EAOVA"}}) == "EAOVA"
    assert resolve_company_for_write("Acme", {"company": {"companyName": "EAOVA"}}) == "Acme"


@pytest.mark.asyncio
async def test_create_with_as_draft_routes_to_create_draft() -> None:
    svc = EmployeeService()
    session = AsyncMock()
    with patch.object(
        svc, "create_draft", AsyncMock(return_value={"status": "NEW"})
    ) as create_draft:
        out = await svc.create(
            session,
            {
                "asDraft": True,
                "firstName": "Ada",
                "lastName": "Lovelace",
                "dateOfBirth": "1990-05-05",
            },
            {},
        )
    create_draft.assert_awaited_once()
    assert out["status"] == "NEW"


@pytest.mark.asyncio
async def test_reject_employee_code_mutation() -> None:
    svc = EmployeeService()
    with pytest.raises(HTTPException) as exc:
        svc._reject_immutable_identity_fields({"employeeCode": "HACK"})
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_apply_transition_invite_merges_stripped_email_id() -> None:
    svc = EmployeeService()
    emp_id = uuid.uuid4()
    with patch.object(
        svc, "invite_draft", AsyncMock(return_value={"status": "PENDING"})
    ) as invite:
        await svc.apply_transition(
            AsyncMock(),
            emp_id,
            "invite",
            email_id="  ada@gmail.com  ",
            patch={"firstName": "Ada"},
            actor={},
        )
    body = invite.await_args.args[2]
    assert body["emailId"] == "ada@gmail.com"
    assert body["firstName"] == "Ada"
