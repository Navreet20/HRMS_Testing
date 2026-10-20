"""Dev 1 company profile: single-company GET/PATCH and employee name sync."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.company.router import router as company_router
from app.modules.company.service import (
    MULTI_COMPANY_NOT_SUPPORTED,
    get_current_company,
    get_company,
    reject_multi_company,
    sync_employee_company_name,
    update_company,
)


COMPANY_ID = uuid4()


def _company(*, name: str = "EAOVA"):
    row = MagicMock()
    row.id = COMPANY_ID
    row.company_name = name
    row.company_type = "LLC"
    row.company_email = "ops@eaova.test"
    row.company_phone = "+1 555 0100"
    row.company_website = "https://eaova.test"
    row.company_address_line1 = "1 Market Street"
    row.company_address_line2 = None
    row.city = "San Francisco"
    row.state = "CA"
    row.zipcode = "94105"
    row.country = "US"
    row.company_logo = None
    row.logo_object_key = None
    row.headquarters_location_id = None
    row.company_status = "ACTIVE"
    row.timesheet_reminder_weekday = 1
    row.timesheet_expected_weekly_hours = 40
    row.timesheet_hours_format = "clock"
    row.created_by = "Dev"
    row.updated_by = "Dev"
    row.created_date = None
    row.updated_date = None
    return row


def test_company_routes_keep_profile_and_legacy_paths() -> None:
    paths = {getattr(route, "path", "") for route in company_router.routes}
    assert "/companies/current" in paths
    assert "/companies/current/logo" in paths
    assert "/companies/{company_id}" in paths
    assert "/companies/{company_id}/logo" in paths
    assert "/companies" in paths


def test_reject_multi_company_returns_410() -> None:
    with pytest.raises(HTTPException) as exc:
        reject_multi_company()
    assert exc.value.status_code == 410
    assert MULTI_COMPANY_NOT_SUPPORTED in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_first_company_when_workspace_empty() -> None:
    from app.modules.company import service as svc

    db = AsyncMock()
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0
    db.execute = AsyncMock(return_value=count_result)
    db.add = MagicMock()
    db.flush = AsyncMock()

    payload = await svc.create_company(
        db,
        {"role": "SUPERADMIN", "superadminView": True},
        {
            "companyName": "Cognivance",
            "companyType": "LLC",
            "companyEmail": "ops@cognivance.test",
            "companyWebsite": "cognivance.com",
        },
    )
    assert payload["companyName"] == "Cognivance"
    assert payload["companyType"] == "LLC"
    assert payload["companyWebsite"] == "https://cognivance.com"
    assert payload["assetCodePrefix"] == "COG"
    db.add.assert_called_once()


def test_asset_code_prefix_from_company_name() -> None:
    from app.modules.company.service import asset_code_prefix_from_name

    assert asset_code_prefix_from_name("Cognivance") == "COG"
    assert asset_code_prefix_from_name("EAOVA Inc") == "EAO"
    assert asset_code_prefix_from_name("12") == "AST"


@pytest.mark.asyncio
async def test_legacy_list_and_second_create_are_not_supported() -> None:
    from app.modules.company import service as svc

    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await svc.list_companies(db)
    assert exc.value.status_code == 410

    # Second company is rejected when one already exists.
    count_result = MagicMock()
    count_result.scalar_one.return_value = 1
    db.execute = AsyncMock(return_value=count_result)
    with pytest.raises(HTTPException) as create_exc:
        await svc.create_company(
            db,
            {"role": "SUPERADMIN", "superadminView": True},
            {"companyName": "Other", "companyType": "LLC"},
        )
    assert create_exc.value.status_code == 410

    with pytest.raises(HTTPException):
        await svc.delete_company(db, COMPANY_ID)

    with pytest.raises(HTTPException):
        await svc.approve_company(db, COMPANY_ID)


@pytest.mark.asyncio
async def test_get_current_company_prefers_actor_company_id() -> None:
    company = _company()
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=result)
    actor = {"company": {"companyId": str(COMPANY_ID), "companyName": "EAOVA"}}

    payload = await get_current_company(db, actor)

    assert payload["companyId"] == str(COMPANY_ID)
    assert payload["companyName"] == "EAOVA"
    db.execute.assert_awaited()


@pytest.mark.asyncio
async def test_get_current_company_falls_back_to_first_row() -> None:
    company = _company()
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=result)

    payload = await get_current_company(db, {})

    assert payload["companyName"] == "EAOVA"


@pytest.mark.asyncio
async def test_get_company_by_id() -> None:
    company = _company()
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=result)

    payload = await get_company(db, COMPANY_ID)
    assert payload["companyEmail"] == "ops@eaova.test"


@pytest.mark.asyncio
async def test_update_company_renames_matching_employee_company_strings() -> None:
    company = _company(name="EAOVA")
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()
    actor = {"firstName": "Dev", "lastName": "Account", "role": "SUPERADMIN"}

    payload = await update_company(
        db,
        actor,
        COMPANY_ID,
        {"companyName": "EAOVA LLC", "companyEmail": "ops@eaova.test"},
    )

    assert company.company_name == "EAOVA LLC"
    assert payload["companyName"] == "EAOVA LLC"
    assert db.execute.await_count == 2
    assert company.updated_by == "Dev Account"


@pytest.mark.asyncio
async def test_update_company_skips_employee_sync_when_name_unchanged() -> None:
    company = _company(name="EAOVA")
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()

    await update_company(
        db,
        {"firstName": "Dev", "lastName": "Account", "role": "ADMIN"},
        COMPANY_ID,
        {"companyName": "EAOVA", "companyPhone": "+1 555 0199"},
    )

    assert company.company_phone == "+1 555 0199"
    assert db.execute.await_count == 1


@pytest.mark.asyncio
async def test_sync_employee_company_name_noops_on_blank_or_same() -> None:
    db = AsyncMock()
    await sync_employee_company_name(db, "", "EAOVA LLC")
    await sync_employee_company_name(db, "EAOVA", "EAOVA")
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_company_sets_timesheet_reminder_weekday() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()

    payload = await update_company(
        db,
        {"role": "HR"},
        COMPANY_ID,
        {"timesheetReminderWeekday": 3},
    )
    assert company.timesheet_reminder_weekday == 3
    assert payload["timesheetReminderWeekday"] == 3


@pytest.mark.asyncio
async def test_update_company_sets_timesheet_expected_weekly_hours() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()

    payload = await update_company(
        db,
        {"role": "HR"},
        COMPANY_ID,
        {"timesheetExpectedWeeklyHours": 37.5},
    )
    assert company.timesheet_expected_weekly_hours == 37.5
    assert payload["timesheetExpectedWeeklyHours"] == 37.5


@pytest.mark.asyncio
async def test_hr_cannot_patch_company_profile_fields() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)

    with pytest.raises(HTTPException) as exc:
        await update_company(
            db,
            {"role": "HR"},
            COMPANY_ID,
            {"companyName": "Nope"},
        )
    assert exc.value.status_code == 403
    db.flush.assert_not_called()


@pytest.mark.asyncio
async def test_update_company_rejects_unknown_type() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)

    with pytest.raises(HTTPException) as exc:
        await update_company(
            db,
            {"role": "ADMIN"},
            COMPANY_ID,
            {"companyType": "Trusteeship"},
        )
    assert exc.value.status_code == 400
    db.flush.assert_not_called()


@pytest.mark.asyncio
async def test_update_company_allows_empty_type() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()

    payload = await update_company(
        db,
        {"role": "ADMIN"},
        COMPANY_ID,
        {"companyType": ""},
    )
    assert company.company_type == ""
    assert payload["companyType"] == ""


@pytest.mark.asyncio
async def test_update_company_normalizes_website_without_scheme() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()

    payload = await update_company(
        db,
        {"role": "ADMIN"},
        COMPANY_ID,
        {"companyWebsite": "www.cognivance.com"},
    )
    assert company.company_website == "https://www.cognivance.com"
    assert payload["companyWebsite"] == "https://www.cognivance.com"


@pytest.mark.asyncio
async def test_update_company_sets_headquarters_from_location() -> None:
    company = _company()
    location_id = uuid4()
    location = MagicMock()
    location.location_id = location_id
    location.company_id = COMPANY_ID
    location.status = "Active"
    location.address_line_1 = "98 Tamarack Circle"
    location.address_line_2 = None
    location.city = "Montgomery Township"
    location.state = "NJ"
    location.zip = "08558"
    location.country = "US"

    db = AsyncMock()
    company_result = MagicMock()
    company_result.scalar_one_or_none.return_value = company
    location_result = MagicMock()
    location_result.scalar_one_or_none.return_value = location
    db.execute = AsyncMock(side_effect=[company_result, location_result])
    db.flush = AsyncMock()

    payload = await update_company(
        db,
        {"role": "ADMIN"},
        COMPANY_ID,
        {"headquartersLocationId": str(location_id)},
    )

    assert company.headquarters_location_id == location_id
    assert company.city == "Montgomery Township"
    assert payload["headquartersLocationId"] == str(location_id)





@pytest.mark.asyncio
async def test_update_company_sets_timesheet_hours_format() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()

    payload = await update_company(
        db, {"role": "HR"}, COMPANY_ID, {"timesheetHoursFormat": "Decimal"}
    )
    assert company.timesheet_hours_format == "decimal"
    assert payload["timesheetHoursFormat"] == "decimal"


@pytest.mark.asyncio
async def test_update_company_rejects_unknown_hours_format() -> None:
    company = _company()
    db = AsyncMock()
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = company
    db.execute = AsyncMock(return_value=select_result)
    db.flush = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await update_company(
            db, {"role": "HR"}, COMPANY_ID, {"timesheetHoursFormat": "minutes"}
        )
    assert exc.value.status_code == 400
