"""Superadmin allowlist, sign-in identity linking, and the Superadmin / Employee views."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.bootstrap_admin import (
    ALLOWLIST_SUPERADMIN_CLAIM,
    SUPERADMIN_VIEW,
    allowlist_superadmin_user_details,
    apply_session_view,
    can_use_superadmin_view,
    _name_from_email,
    _split_display_name,
    is_allowlist_superadmin_claims,
    is_superadmin_email,
    is_unlisted_system_account,
    parse_superadmin_emails,
)
from app.modules.auth.service import AuthService


def test_split_display_name_single_token_has_empty_last() -> None:
    assert _split_display_name("Superadmin") == ("Superadmin", "")
    assert _split_display_name("  Superadmin  ") == ("Superadmin", "")


def test_split_display_name_empty_defaults_to_superadmin() -> None:
    assert _split_display_name("") == ("Superadmin", "")


def test_split_display_name_multi_token() -> None:
    assert _split_display_name("Ada Lovelace") == ("Ada", "Lovelace")


def test_parse_superadmin_emails_takes_any_number() -> None:
    assert parse_superadmin_emails(
        "ravi@x.com, Priya.Shah@x.com;asha@x.com  dev@x.com,,not-an-email, RAVI@x.com"
    ) == ["ravi@x.com", "priya.shah@x.com", "asha@x.com", "dev@x.com"]
    assert parse_superadmin_emails("") == []


def test_is_superadmin_email_ignores_case() -> None:
    settings = SimpleNamespace(superadmin_emails="durga@arohak.com, ravi@arohak.com")
    assert is_superadmin_email(settings, " Durga@Arohak.com ") is True  # type: ignore[arg-type]
    assert is_superadmin_email(settings, "someone@arohak.com") is False  # type: ignore[arg-type]


def test_name_from_email() -> None:
    assert _name_from_email("priya.shah@x.com") == "Priya Shah"
    assert _name_from_email("dev_ops-team@x.com") == "Dev Ops Team"


def test_allowlist_superadmin_user_details_has_no_employee_id() -> None:
    details = allowlist_superadmin_user_details(
        email="Navreet.Kaur@cognivance.com",
        display_name="Navreet Kaur",
    )
    assert details["employeeId"] is None
    assert details["emailId"] == "navreet.kaur@cognivance.com"
    assert details["firstName"] == "Navreet"
    assert details["lastName"] == "Kaur"
    assert details["role"] == "SUPERADMIN"
    assert details[ALLOWLIST_SUPERADMIN_CLAIM] is True
    assert details["isSystemAccount"] is False


def _employee(**fields: object) -> SimpleNamespace:
    base = {
        "id": uuid4(),
        "employee_id": None,
        "email_id": "durga@arohak.com",
        "official_email": "durga@arohak.com",
        "first_name": "Durga",
        "last_name": "Paruchuri",
        "is_system_account": False,
        "status": "Active",
        "role": "EMPLOYEE",
        "entra_oid": None,
    }
    base.update(fields)
    if base.get("employee_id") is None:
        base["employee_id"] = base["id"]
    if "email_id" in fields and "official_email" not in fields:
        base["official_email"] = fields["email_id"]
    return SimpleNamespace(**base)


def _allowlist(emails: str) -> SimpleNamespace:
    return SimpleNamespace(superadmin_emails=emails)


async def _sign_in(
    *,
    linked=None,
    by_email=None,
    allowlist="",
    invite_accept=None,
    **kwargs,
):
    auth = AuthService()
    issue_employee = AsyncMock(return_value={"via": "employee"})
    issue_allowlist = AsyncMock(return_value={"via": "allowlist"})
    settings = _allowlist(allowlist)
    with (
        patch("app.modules.auth.service.linked_employee", AsyncMock(return_value=linked)),
        patch("app.modules.auth.service._employee_by_email", AsyncMock(return_value=by_email)),
        patch("app.modules.auth.service.get_settings", return_value=settings),
        patch("app.core.bootstrap_admin.get_settings", return_value=settings),
        patch("app.modules.auth.service.mark_invite_accepted", invite_accept or AsyncMock()),
        patch.object(auth, "issue_session_for_employee", issue_employee),
        patch.object(auth, "issue_session_for_allowlist_superadmin", issue_allowlist),
    ):
        result = await auth.issue_session_for_identity(AsyncMock(), **kwargs)  # type: ignore[arg-type]
    return result, issue_employee, issue_allowlist


_ENTRA = {"provider": "entra", "subject": "oid-1"}


@pytest.mark.asyncio
async def test_first_sign_in_links_account_found_by_email() -> None:
    employee = _employee()
    result, issue_employee, issue_allowlist = await _sign_in(
        by_email=employee, email="Durga@Arohak.com", **_ENTRA
    )
    assert result == {"via": "employee"}
    assert employee.entra_oid == "oid-1"
    assert issue_employee.await_args.args[1] is employee
    assert issue_employee.await_args.kwargs["active_view"] is None
    issue_allowlist.assert_not_awaited()


@pytest.mark.asyncio
async def test_employee_sign_in_marks_outstanding_invite_accepted() -> None:
    employee = _employee()
    invite_accept = AsyncMock(return_value=True)
    await _sign_in(
        by_email=employee,
        invite_accept=invite_accept,
        email="durga@arohak.com",
        **_ENTRA,
    )
    assert invite_accept.await_args.args[1] is employee


@pytest.mark.asyncio
async def test_later_sign_in_uses_linked_account_even_after_email_change() -> None:
    employee = _employee()
    result, issue_employee, issue_allowlist = await _sign_in(
        linked=employee, email="new.address@arohak.com", **_ENTRA
    )
    assert result == {"via": "employee"}
    assert issue_employee.await_args.args[1] is employee
    issue_allowlist.assert_not_awaited()


@pytest.mark.asyncio
async def test_unknown_email_not_on_allowlist_is_not_provisioned() -> None:
    with pytest.raises(HTTPException) as exc:
        await _sign_in(allowlist="ravi@arohak.com", email="stranger@arohak.com", **_ENTRA)
    assert exc.value.detail == "not_provisioned"


@pytest.mark.asyncio
async def test_allowlisted_email_without_account_gets_pure_superadmin_session() -> None:
    result, issue_employee, issue_allowlist = await _sign_in(
        allowlist="navreet.kaur@cognivance.com",
        email="navreet.kaur@cognivance.com",
        display_name="Navreet Kaur",
        **_ENTRA,
    )
    assert result == {"via": "allowlist"}
    issue_employee.assert_not_awaited()
    assert issue_allowlist.await_args.kwargs["email"] == "navreet.kaur@cognivance.com"
    assert issue_allowlist.await_args.kwargs["display_name"] == "Navreet Kaur"


@pytest.mark.asyncio
async def test_legacy_system_account_on_allowlist_becomes_pure_superadmin() -> None:
    system = _employee(is_system_account=True, email_id="navreet.kaur@cognivance.com")
    result, issue_employee, issue_allowlist = await _sign_in(
        by_email=system,
        allowlist="navreet.kaur@cognivance.com",
        email="navreet.kaur@cognivance.com",
        **_ENTRA,
    )
    assert result == {"via": "allowlist"}
    issue_employee.assert_not_awaited()
    issue_allowlist.assert_awaited_once()


@pytest.mark.asyncio
async def test_system_account_removed_from_allowlist_cannot_sign_in() -> None:
    system = _employee(is_system_account=True, email_id="ravi@arohak.com")
    with pytest.raises(HTTPException) as exc:
        await _sign_in(
            by_email=system, allowlist="durga@arohak.com", email="ravi@arohak.com", **_ENTRA
        )
    assert exc.value.status_code == 401
    assert exc.value.detail == "not_provisioned"


def test_allowlist_superadmin_removed_is_refused_on_every_request() -> None:
    claims = {
        ALLOWLIST_SUPERADMIN_CLAIM: True,
        "emailId": "ravi@arohak.com",
        "role": "SUPERADMIN",
    }
    with patch("app.core.bootstrap_admin.get_settings", return_value=_allowlist("ravi@arohak.com")):
        assert is_unlisted_system_account(claims) is False
        assert is_allowlist_superadmin_claims(claims) is True
    with patch("app.core.bootstrap_admin.get_settings", return_value=_allowlist("durga@arohak.com")):
        assert is_unlisted_system_account(claims) is True
    legacy = {"isSystemAccount": True, "emailId": "ravi@arohak.com", "role": "SUPERADMIN"}
    with patch("app.core.bootstrap_admin.get_settings", return_value=_allowlist("durga@arohak.com")):
        assert is_unlisted_system_account(legacy) is True
        assert is_unlisted_system_account({**legacy, "isSystemAccount": False}) is False
    assert is_unlisted_system_account(None) is False


@pytest.mark.asyncio
async def test_allowlisted_employee_keeps_one_account_and_starts_in_superadmin_view() -> None:
    employee = _employee()
    result, issue_employee, issue_allowlist = await _sign_in(
        by_email=employee,
        allowlist="durga@arohak.com",
        email="durga@arohak.com",
        **_ENTRA,
    )
    assert result == {"via": "employee"}
    issue_allowlist.assert_not_awaited()
    assert issue_employee.await_args.args[1] is employee
    assert issue_employee.await_args.kwargs["active_view"] == SUPERADMIN_VIEW


@pytest.mark.asyncio
async def test_link_refuses_account_already_linked_to_another_person() -> None:
    from app.modules.auth.service import _link_entra_oid

    employee = _employee(entra_oid="oid-someone-else")
    with pytest.raises(HTTPException) as exc:
        _link_entra_oid(employee, "oid-1", "durga@arohak.com")  # type: ignore[arg-type]
    assert exc.value.detail == "account_mismatch"


def test_can_use_superadmin_view_only_for_allowlisted_employees() -> None:
    settings = _allowlist("durga@arohak.com")
    assert can_use_superadmin_view(settings, _employee()) is True  # type: ignore[arg-type]
    assert can_use_superadmin_view(settings, _employee(email_id="ravi@arohak.com")) is False  # type: ignore[arg-type]
    assert can_use_superadmin_view(settings, _employee(is_system_account=True)) is False  # type: ignore[arg-type]


def test_superadmin_view_applies_only_while_email_is_allowlisted() -> None:
    claims = {"emailId": "durga@arohak.com", "role": "EMPLOYEE", "department": "EMPLOYEE"}
    with patch("app.core.bootstrap_admin.get_settings", return_value=_allowlist("durga@arohak.com")):
        on = apply_session_view(claims, SUPERADMIN_VIEW)
        employee_view = apply_session_view(claims, None)
    assert on["role"] == "SUPERADMIN" and on["superadminView"] is True
    assert employee_view["role"] == "EMPLOYEE" and employee_view["superadminView"] is False
    with patch("app.core.bootstrap_admin.get_settings", return_value=_allowlist("")):
        removed = apply_session_view(claims, SUPERADMIN_VIEW)
    assert removed["role"] == "EMPLOYEE" and removed["superadminView"] is False


def test_allowlist_superadmin_session_stays_superadmin_while_listed() -> None:
    claims = {
        ALLOWLIST_SUPERADMIN_CLAIM: True,
        "emailId": "navreet.kaur@cognivance.com",
        "role": "SUPERADMIN",
    }
    with patch(
        "app.core.bootstrap_admin.get_settings",
        return_value=_allowlist("navreet.kaur@cognivance.com"),
    ):
        applied = apply_session_view(claims, SUPERADMIN_VIEW)
    assert applied["superadminView"] is True
    assert applied["fullAccess"] is True


@pytest.mark.asyncio
async def test_superadmin_view_passes_module_access_checks_without_grants() -> None:
    from app.modules.rbac.access import require_module_access

    checker = require_module_access("companySetup", min_level="full_access")
    session = AsyncMock()
    user = {"employeeId": str(uuid4()), "superadminView": True}
    assert await checker(user=user, db=session) is user
    session.execute.assert_not_called()

    with pytest.raises(HTTPException):
        with patch(
            "app.modules.rbac.access.resolve_module_access_level",
            AsyncMock(return_value=None),
        ):
            await checker(user={**user, "superadminView": False}, db=session)


@pytest.mark.asyncio
async def test_switch_view_refused_for_allowlist_only_superadmin() -> None:
    auth = AuthService()
    with pytest.raises(HTTPException) as exc:
        await auth.switch_view(
            AsyncMock(),
            {ALLOWLIST_SUPERADMIN_CLAIM: True, "emailId": "navreet.kaur@cognivance.com"},
            "employee",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_switch_view_sets_and_clears_superadmin_view() -> None:
    employee = _employee()
    auth = AuthService()
    session = AsyncMock()
    with (
        patch.object(auth, "_employee_from_claims", AsyncMock(return_value=employee)),
        patch.object(auth, "build_user_details", AsyncMock(return_value={"role": "EMPLOYEE"})),
        patch.object(auth, "_token_for", return_value="tok"),
        patch("app.modules.auth.service.get_settings", return_value=_allowlist("durga@arohak.com")),
        patch("app.core.bootstrap_admin.get_settings", return_value=_allowlist("durga@arohak.com")),
    ):
        on = await auth.switch_view(session, {"employeeId": str(employee.id)}, "superadmin")
        assert on["view"] == "superadmin"
        off = await auth.switch_view(session, {"employeeId": str(employee.id)}, "employee")
        assert off["view"] == "employee"


@pytest.mark.asyncio
async def test_switch_view_refused_when_not_allowlisted() -> None:
    employee = _employee(email_id="ravi@arohak.com", official_email="ravi@arohak.com")
    auth = AuthService()
    session = AsyncMock()
    with (
        patch.object(auth, "_employee_from_claims", AsyncMock(return_value=employee)),
        patch("app.modules.auth.service.get_settings", return_value=_allowlist("durga@arohak.com")),
        patch("app.core.bootstrap_admin.get_settings", return_value=_allowlist("durga@arohak.com")),
    ):
        with pytest.raises(HTTPException) as exc:
            await auth.switch_view(session, {"employeeId": str(employee.id)}, "superadmin")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_full_catalog_grants_come_from_the_database_catalog() -> None:
    from app.modules.rbac.session_grants import full_catalog_session_grants

    rows = [
        ("employees", True),
        ("assets", True),
        ("customers", False),
        ("unknownModule", True),
    ]
    db = AsyncMock()
    db.execute.return_value = SimpleNamespace(all=lambda: rows)

    grants = await full_catalog_session_grants(db)

    assert {"moduleKey": "employees", "accessLevel": "full_access"} in grants
    assert {"moduleKey": "assets", "accessLevel": "full_access"} in grants
    assert {"moduleKey": "unknownModule", "accessLevel": "full_access"} in grants
    assert not [g for g in grants if g["moduleKey"] == "customers"]
    portal = {g.get("submoduleKey") for g in grants if g["moduleKey"] == "employeePortal"}
    assert portal == {"self", "manage"}
    assert all(g["accessLevel"] == "full_access" for g in grants)


@pytest.mark.asyncio
async def test_issue_allowlist_superadmin_does_not_touch_employees_table() -> None:
    auth = AuthService()
    session = AsyncMock()
    session.add = MagicMock()
    with (
        patch.object(
            auth,
            "build_allowlist_superadmin_details",
            AsyncMock(
                return_value=allowlist_superadmin_user_details(
                    email="navreet.kaur@cognivance.com",
                    display_name="Navreet Kaur",
                )
            ),
        ),
        patch.object(auth, "_token_for", return_value="tok"),
    ):
        result = await auth.issue_session_for_allowlist_superadmin(
            session,
            email="navreet.kaur@cognivance.com",
            display_name="Navreet Kaur",
        )
    session.add.assert_not_called()
    assert result["token"] == "tok"
    assert result["userDetails"]["employeeId"] is None
    assert result["userDetails"][ALLOWLIST_SUPERADMIN_CLAIM] is True
