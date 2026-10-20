"""Unit tests for JWT dual-read: valid role first, else department."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.roles import Role, session_access_role, session_access_roles
from app.dependencies import require_roles


@pytest.fixture(autouse=True)
def _auth_bypass_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_BYPASS", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_session_access_role_prefers_valid_role_over_department() -> None:
    assert session_access_role({"role": "ADMIN", "department": "EMPLOYEE"}) == "ADMIN"
    assert session_access_role({"role": "hr", "department": "EMPLOYEE"}) == "HR"


def test_session_access_role_falls_back_when_role_unset_or_invalid() -> None:
    assert session_access_role({"role": "", "department": "ADMIN"}) == "ADMIN"
    assert session_access_role({"role": None, "department": "HR"}) == "HR"
    assert session_access_role({"role": "   ", "department": "ADMIN"}) == "ADMIN"
    assert session_access_role({"role": "not-a-role", "department": "ADMIN"}) == "ADMIN"
    assert session_access_role({"department": "HR"}) == "HR"
    assert session_access_role({"role": "not-a-role"}) is None
    assert session_access_roles({"role": "not-a-role", "department": "ADMIN"}) == {"ADMIN"}


@pytest.mark.asyncio
async def test_require_roles_authorizes_via_department_when_role_invalid() -> None:
    """Seed users always have both claims; this path is the rollback/legacy JWT case."""
    checker = require_roles(Role.ADMIN, Role.HR)

    for user in (
        {"role": "", "department": "ADMIN"},
        {"role": None, "department": "ADMIN"},
        {"role": "not-a-role", "department": "ADMIN"},
        {"role": "  ", "department": "HR"},
        {"department": "HR"},
    ):
        result = await checker(user)
        assert result is user


@pytest.mark.asyncio
async def test_require_roles_rejects_invalid_role_and_wrong_department() -> None:
    checker = require_roles(Role.ADMIN, Role.HR)

    for user in (
        {"role": "not-a-role", "department": "EMPLOYEE"},
        {"role": "not-a-role"},
        {"role": "", "department": "EMPLOYEE"},
        {"role": None, "department": ""},
        {},
    ):
        with pytest.raises(HTTPException) as exc:
            await checker(user)
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_roles_uses_role_when_it_conflicts_with_department() -> None:
    checker = require_roles(Role.ADMIN)
    allowed = {"role": "ADMIN", "department": "EMPLOYEE"}
    assert await checker(allowed) is allowed

    with pytest.raises(HTTPException) as exc:
        await checker({"role": "EMPLOYEE", "department": "ADMIN"})
    assert exc.value.status_code == 403
