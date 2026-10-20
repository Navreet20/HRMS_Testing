"""RBAC-DATA-5: Active grants map to session accessGrants payload."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.serialize import user_details_from_employee
from app.modules.rbac.catalog import (
    MODULE_CLIENTS,
    MODULE_EMPLOYEE_PORTAL,
    MODULE_EMPLOYEES,
    SUBMODULE_MANAGE,
    SUBMODULE_SELF,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY
from app.modules.rbac.session_grants import resolve_session_grants


SELF_GRANT = {
    "moduleKey": "employeePortal",
    "submoduleKey": "self",
    "accessLevel": "full_access",
}
MANAGE_GRANT = {
    "moduleKey": "employeePortal",
    "submoduleKey": "manage",
    "accessLevel": "full_access",
}


def _session(grant_rows: list[tuple], *, has_reports: bool) -> AsyncMock:
    grants_result = MagicMock()
    grants_result.all.return_value = grant_rows
    reports_result = MagicMock()
    reports_result.first.return_value = (uuid.uuid4(),) if has_reports else None
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[grants_result, reports_result])
    return session


@pytest.mark.asyncio
async def test_resolve_session_grants_maps_keys() -> None:
    session = _session(
        [(ACCESS_LEVEL_READ_ONLY, MODULE_CLIENTS, None)], has_reports=False
    )
    out = await resolve_session_grants(session, employee_id=uuid.uuid4())
    assert out == [
        {"moduleKey": "customers", "accessLevel": "read_only"},
        SELF_GRANT,
    ]


@pytest.mark.asyncio
async def test_employee_portal_ignores_stored_rows_and_derives_from_reports() -> None:
    stored = [
        (ACCESS_LEVEL_READ_ONLY, MODULE_EMPLOYEE_PORTAL, SUBMODULE_SELF),
        (ACCESS_LEVEL_FULL_ACCESS, MODULE_EMPLOYEE_PORTAL, SUBMODULE_MANAGE),
    ]
    no_reports = await resolve_session_grants(
        _session(stored, has_reports=False), employee_id=uuid.uuid4()
    )
    assert no_reports == [SELF_GRANT]

    with_reports = await resolve_session_grants(
        _session([], has_reports=True), employee_id=uuid.uuid4()
    )
    assert with_reports == [SELF_GRANT, MANAGE_GRANT]


@pytest.mark.asyncio
async def test_resolve_session_grants_only_queries_exact_employee() -> None:
    """Grants must not bleed across distinct employee rows / email domains."""
    session = _session(
        [(ACCESS_LEVEL_FULL_ACCESS, MODULE_EMPLOYEES, None)], has_reports=False
    )
    out = await resolve_session_grants(session, employee_id=uuid.uuid4())
    assert out == [
        {"moduleKey": "employees", "accessLevel": "full_access"},
        SELF_GRANT,
    ]
    # Grants JOIN + direct-reports lookup, both keyed on this employee_id.
    assert session.execute.await_count == 2


def test_grant_source_defaults_to_db_and_rejects_unknown() -> None:
    assert Settings().rbac_grant_source == "db"
    with pytest.raises(ValidationError):
        Settings(RBAC_GRANT_SOURCE="entra")


def test_user_details_includes_access_grants_array() -> None:
    emp = SimpleNamespace(
        employee_id=uuid.uuid4(),
        first_name="Ada",
        last_name="Lovelace",
        email_id="ada@example.com",
        department="EMPLOYEE",
        status="ACTIVE",
        employment_type="FTE",
        employment_start_date=None,
        employment_end_date=None,
        company="Cognivance",
        role="EMPLOYEE",
        theme_preference="light",
        quick_actions_preference=None,
    )
    access = SimpleNamespace(
        create_access=False,
        edit_access=False,
        view_access=True,
        full_access=False,
    )
    grants = [
        {
            "moduleKey": "employeePortal",
            "submoduleKey": "self",
            "accessLevel": "full_access",
        }
    ]
    details = user_details_from_employee(emp, access, access_grants=grants)
    assert details["accessGrants"] == grants

    empty = user_details_from_employee(emp, access)
    assert empty["accessGrants"] == []
