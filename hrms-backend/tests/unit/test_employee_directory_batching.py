"""Employee directory rows load their extras once per page, not once per employee."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.employee import access
from app.modules.employee.service import EmployeeService


def _employee(code: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        employee_id=uuid.uuid4(),
        reporting_manager_id=None,
        national_id_document_type=code,
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_page_of_employees_uses_one_load_per_kind(monkeypatch):
    service = EmployeeService()
    people = [_employee("PAN"), _employee("PAN"), _employee(None)]
    contacts = {p.employee_id: {"phone": str(i)} for i, p in enumerate(people)}

    onboarding = AsyncMock(return_value={})
    managers = AsyncMock(return_value={})
    contact_loader = AsyncMock(return_value=contacts)
    type_loader = AsyncMock(return_value={"pan": "type-1"})
    grant = AsyncMock(return_value="full_access")
    to_dict = AsyncMock(side_effect=lambda session, e, **kw: kw)
    monkeypatch.setattr(service, "_onboarding_by_employee_ids", onboarding)
    monkeypatch.setattr(service, "_reporting_manager_names_by_id", managers)
    monkeypatch.setattr(service, "_contacts_by_employee", contact_loader)
    monkeypatch.setattr(service, "_national_id_type_ids_by_code", type_loader)
    monkeypatch.setattr(service, "_to_dict", to_dict)
    monkeypatch.setattr(access, "actor_employees_grant_level", grant)

    rows = await service._serialize_directory_rows(
        MagicMock(), people, {"department": "HR"}, set()
    )

    for loader in (onboarding, managers, contact_loader, type_loader, grant):
        loader.assert_awaited_once()
    assert type_loader.await_args.args[1] == {"PAN", ""}
    assert [r["contact"]["phone"] for r in rows] == ["0", "1", "2"]
    assert all(r["employees_grant_level"] == "full_access" for r in rows)
    assert all(r["national_id_type_ids"] == {"pan": "type-1"} for r in rows)


@pytest.mark.unit
def test_batched_contact_block_matches_single_employee_shape():
    service = EmployeeService()
    address = SimpleNamespace(
        address_line1="1 Main", address_line2=None, city="Austin", state="TX",
        zip_code="73301", country="US", address_id=uuid.uuid4(),
    )
    emergency = SimpleNamespace(
        name="Kim", phone_number="555", relation="Sister", email_id="k@x.com",
        linked_employee_id=None,
    )
    block = service._contact_from_rows(address, [emergency], "111", "p@x.com", "222")
    assert block["addressLine1"] == "1 Main"
    assert block["city"] == "Austin"
    assert block["emergencyName"] == "Kim"
    assert block["alternateEmergencyName"] == ""
    assert block["phone"] == "111" and block["alternatePhone"] == "222"
