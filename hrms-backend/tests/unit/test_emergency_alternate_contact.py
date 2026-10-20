"""Unit tests for primary + alternate emergency contact persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.employee.service import EmployeeService


@pytest.mark.asyncio
async def test_contact_for_employee_returns_alternate_fields() -> None:
    employee_id = uuid4()
    primary = SimpleNamespace(
        name="Ron",
        phone_number="+18475498574",
        relation="Friend",
        email_id="ron@example.com",
        linked_employee_id=None,
        created_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        emergency_contact_id=uuid4(),
    )
    alternate = SimpleNamespace(
        name="Chandler",
        phone_number="+15551212",
        relation="Friend",
        email_id="chandler@example.com",
        linked_employee_id=None,
        created_date=datetime(2026, 1, 2, tzinfo=timezone.utc),
        emergency_contact_id=uuid4(),
    )

    session = MagicMock()
    addr_result = MagicMock()
    addr_result.scalars.return_value.all.return_value = []
    session.execute = AsyncMock(return_value=addr_result)

    svc = EmployeeService()
    svc._emergency_contacts_ordered = AsyncMock(return_value=[primary, alternate])  # type: ignore[method-assign]

    contact = await svc._contact_for_employee(
        session, employee_id, phone="+1000", personal_email="m@example.com"
    )
    assert contact["emergencyName"] == "Ron"
    assert contact["emergencyEmail"] == "ron@example.com"
    assert contact["alternateEmergencyName"] == "Chandler"
    assert contact["alternateEmergencyPhone"] == "+15551212"
    assert contact["alternateEmergencyRelation"] == "Friend"
    assert contact["alternateEmergencyEmail"] == "chandler@example.com"


@pytest.mark.asyncio
async def test_apply_profile_payload_persists_alternate_contact() -> None:
    employee_id = uuid4()
    session = MagicMock()
    session.add = MagicMock()
    session.delete = AsyncMock()
    session.flush = AsyncMock()

    addr_result = MagicMock()
    addr_result.scalar_one_or_none.return_value = SimpleNamespace(
        address_line1=None,
        address_line2=None,
        city=None,
        state=None,
        zip_code=None,
        country=None,
    )
    session.execute = AsyncMock(return_value=addr_result)

    primary = SimpleNamespace(
        name="Ron",
        phone_number="+18475498574",
        relation="Friend",
        email_id="ron@example.com",
        linked_employee_id=None,
        created_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        emergency_contact_id=uuid4(),
        updated_date=None,
    )
    svc = EmployeeService()
    svc._emergency_contacts_ordered = AsyncMock(return_value=[primary])  # type: ignore[method-assign]
    svc._get = AsyncMock()  # type: ignore[method-assign]

    await svc._apply_profile_payload(
        session,
        employee_id,
        {
            "emergencyName": "Ron",
            "emergencyPhone": "+18475498574",
            "emergencyRelation": "Friend",
            "emergencyEmail": "ron@example.com",
            "alternateEmergencyName": "Chandler",
            "alternateEmergencyPhone": "+15551212",
            "alternateEmergencyRelation": "Friend",
            "alternateEmergencyEmail": "chandler@example.com",
        },
    )

    assert session.add.call_count == 1
    created = session.add.call_args[0][0]
    assert created.name == "Chandler"
    assert created.phone_number == "+15551212"
    assert created.relation == "Friend"
    assert created.email_id == "chandler@example.com"
