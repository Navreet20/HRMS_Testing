"""Dev 1 org masters: Active list, soft-deactivate, inactive FK rejection."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService
from app.modules.org import router as org_router
from sqlalchemy.exc import IntegrityError

from app.modules.org.service import (
    DEPARTMENT_NAME_TAKEN,
    DESIGNATION_TITLE_TAKEN,
    INVALID_LOCATION_COUNTRY,
    INVALID_LOCATION_TIMEZONE,
    INVALID_US_ZIP,
    LOCATION_CODE_TAKEN,
    MASTER_STATUS_ACTIVE,
    MASTER_STATUS_INACTIVE,
    _assert_no_parent_cycle,
    _assert_unique_department_name,
    _assert_unique_designation_title,
    _assert_unique_location_code,
    _flush_unique,
    assert_active_master,
    create_location,
    deactivate_department,
    parse_location_country,
    parse_location_state,
    parse_location_timezone,
    parse_location_zip,
    update_department,
    update_location,
    viewer_sees_inactive,
)


DEPT_ID = uuid4()
LOC_ID = uuid4()
DESIG_ID = uuid4()
COMPANY_A_ID = uuid4()
COMPANY_B_ID = uuid4()


def _company_db_mock(*, company_id: uuid.UUID = COMPANY_A_ID, unique_hit: bool = False) -> AsyncMock:
    db = AsyncMock()
    company_result = MagicMock()
    company_result.scalar_one_or_none.return_value = company_id
    unique_result = MagicMock()
    unique_result.scalar_one_or_none.return_value = LOC_ID if unique_hit else None
    db.execute = AsyncMock(side_effect=[company_result, unique_result])
    db.flush = AsyncMock()
    return db


def _actor_with_company(company_id: uuid.UUID = COMPANY_A_ID) -> dict:
    return {
        "firstName": "Pat",
        "lastName": "Admin",
        "company": {"companyId": str(company_id), "companyName": "EAOVA"},
    }


def test_org_routes_registered() -> None:
    paths = {getattr(route, "path", "") for route in org_router.router.routes}
    assert "/departments" in paths
    assert "/locations" in paths
    assert "/designations" in paths


@pytest.mark.asyncio
async def test_create_location_requires_country_and_timezone() -> None:
    db = AsyncMock()
    actor = {"firstName": "Pat", "lastName": "Admin"}

    with pytest.raises(HTTPException) as missing_country:
        await create_location(
            db,
            actor,
            {
                "locationName": "HQ",
                "addressLine1": "1 Main",
                "city": "New York",
                "state": "NY",
                "zip": "10001",
                "timezone": "UTC",
            },
        )
    assert missing_country.value.status_code == 400
    assert "Country" in str(missing_country.value.detail)

    with pytest.raises(HTTPException) as missing_timezone:
        await create_location(
            db,
            actor,
            {
                "locationName": "HQ",
                "addressLine1": "1 Main",
                "city": "New York",
                "state": "NY",
                "zip": "10001",
                "country": "US",
            },
        )
    assert missing_timezone.value.status_code == 400
    assert "Timezone" in str(missing_timezone.value.detail)

    with pytest.raises(HTTPException) as missing_street:
        await create_location(
            db,
            actor,
            {
                "locationName": "HQ",
                "city": "New York",
                "state": "NY",
                "zip": "10001",
                "country": "US",
                "timezone": "UTC",
            },
        )
    assert missing_street.value.status_code == 400
    assert "Street" in str(missing_street.value.detail)

    with pytest.raises(HTTPException) as missing_zip:
        await create_location(
            db,
            actor,
            {
                "locationName": "HQ",
                "addressLine1": "1 Main",
                "city": "New York",
                "state": "NY",
                "country": "US",
                "timezone": "UTC",
            },
        )
    assert missing_zip.value.status_code == 400
    assert "ZIP" in str(missing_zip.value.detail)

    with pytest.raises(HTTPException) as missing_city:
        await create_location(
            db,
            actor,
            {
                "locationName": "HQ",
                "addressLine1": "1 Main",
                "state": "NY",
                "zip": "10001",
                "country": "US",
                "timezone": "UTC",
            },
        )
    assert missing_city.value.status_code == 400
    assert "City" in str(missing_city.value.detail)

    with pytest.raises(HTTPException) as missing_state:
        await create_location(
            db,
            actor,
            {
                "locationName": "HQ",
                "addressLine1": "1 Main",
                "city": "New York",
                "zip": "10001",
                "country": "US",
                "timezone": "UTC",
            },
        )
    assert missing_state.value.status_code == 400
    assert "State" in str(missing_state.value.detail)


def test_parse_location_timezone_rejects_garbage() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_location_timezone("fusgbseu")
    assert exc.value.status_code == 400
    assert exc.value.detail == INVALID_LOCATION_TIMEZONE


def test_parse_location_timezone_accepts_iana() -> None:
    assert parse_location_timezone("America/New_York") == "America/New_York"
    assert parse_location_timezone("UTC") == "UTC"


def test_parse_location_country_normalizes_alpha2_and_names() -> None:
    assert parse_location_country("US") == "US"
    assert parse_location_country("us") == "US"
    assert parse_location_country("United States") == "US"
    assert parse_location_country("India") == "IN"


def test_parse_location_country_rejects_garbage() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_location_country("fusgbseu")
    assert exc.value.status_code == 400
    assert exc.value.detail == INVALID_LOCATION_COUNTRY


def test_parse_location_country_accepts_full_iso_alpha2() -> None:
    assert parse_location_country("IS") == "IS"
    assert parse_location_country("GR") == "GR"


def test_parse_location_state_validates_us_list() -> None:
    assert parse_location_state("US", "NY") == "NY"
    assert parse_location_state("US", "New York") == "NY"
    assert parse_location_state("US", "ZZ") == "ZZ"


def test_parse_location_state_free_text_when_no_list() -> None:
    assert parse_location_state("SG", "Downtown Core") == "Downtown Core"
    assert parse_location_state("SG", "") is None
    assert parse_location_state("SG", None) is None
    assert parse_location_state("GB", "LND") == "LND"


def test_parse_location_zip_requires_us_five_digits() -> None:
    assert parse_location_zip("US", "10001") == "10001"
    assert parse_location_zip("US", "10001-1234") == "10001-1234"
    with pytest.raises(HTTPException) as missing:
        parse_location_zip("US", "")
    assert missing.value.status_code == 400
    assert "ZIP" in str(missing.value.detail)
    with pytest.raises(HTTPException) as invalid:
        parse_location_zip("US", "7870")
    assert invalid.value.status_code == 400
    assert invalid.value.detail == INVALID_US_ZIP
    assert parse_location_zip("SG", "") is None
    assert parse_location_zip("IN", "560001") == "560001"


def _valid_location_body(**overrides: object) -> dict:
    body: dict = {
        "locationName": "HQ",
        "addressLine1": "1 Main",
        "city": "New York",
        "state": "NY",
        "zip": "10001",
        "country": "US",
        "timezone": "America/New_York",
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_create_location_rejects_invalid_timezone() -> None:
    db = AsyncMock()
    actor = {"firstName": "Pat", "lastName": "Admin"}

    with pytest.raises(HTTPException) as exc:
        await create_location(db, actor, _valid_location_body(timezone="fusgbseu"))
    assert exc.value.status_code == 400
    assert exc.value.detail == INVALID_LOCATION_TIMEZONE
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_create_location_rejects_invalid_country() -> None:
    db = AsyncMock()
    actor = {"firstName": "Pat", "lastName": "Admin"}

    with pytest.raises(HTTPException) as exc:
        await create_location(db, actor, _valid_location_body(country="Narnia"))
    assert exc.value.status_code == 400
    assert exc.value.detail == INVALID_LOCATION_COUNTRY
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_create_location_stores_alpha2_when_name_sent() -> None:
    db = _company_db_mock()
    actor = _actor_with_company()

    body = await create_location(
        db, actor, _valid_location_body(country="United States")
    )
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert row.country == "US"
    assert row.state == "NY"
    assert row.timezone == "America/New_York"
    assert row.company_id == COMPANY_A_ID
    assert body["country"] == "US"
    assert body["timezone"] == "America/New_York"


@pytest.mark.asyncio
async def test_create_location_allows_omitting_postal_when_not_us() -> None:
    db = _company_db_mock()
    actor = _actor_with_company()

    body = await create_location(
        db,
        actor,
        {
            "locationName": "Singapore Hub",
            "addressLine1": "1 Raffles",
            "city": "Singapore",
            "country": "SG",
            "timezone": "Asia/Singapore",
        },
    )
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert row.country == "SG"
    assert row.state is None
    assert row.zip is None
    assert row.location_type is None
    assert body["zip"] is None
    assert body["locationType"] is None


@pytest.mark.asyncio
async def test_create_location_allows_empty_city_for_monaco() -> None:
    db = _company_db_mock()
    actor = _actor_with_company()

    body = await create_location(
        db,
        actor,
        {
            "locationName": "Monte Carlo",
            "addressLine1": "74 Boulevard d'Italie",
            "city": "",
            "country": "MC",
            "timezone": "Europe/Monaco",
            "zip": "98000",
        },
    )
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert row.country == "MC"
    assert row.city is None
    assert body["city"] is None


@pytest.mark.asyncio
async def test_create_location_stores_unlisted_state_as_text() -> None:
    db = _company_db_mock()
    actor = _actor_with_company()

    body = await create_location(db, actor, _valid_location_body(state="ZZ"))
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert row.state == "ZZ"
    assert body["state"] == "ZZ"


@pytest.mark.asyncio
async def test_update_location_rejects_invalid_timezone() -> None:
    row = MagicMock()
    row.location_id = LOC_ID
    row.company_id = COMPANY_A_ID
    found = MagicMock()
    found.scalar_one_or_none.return_value = row
    company_result = MagicMock()
    company_result.scalar_one_or_none.return_value = COMPANY_A_ID
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[company_result, found])

    with pytest.raises(HTTPException) as exc:
        await update_location(
            session,
            _actor_with_company(),
            LOC_ID,
            {"timezone": "fusgbseu"},
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == INVALID_LOCATION_TIMEZONE


@pytest.mark.asyncio
async def test_update_location_rejects_invalid_country() -> None:
    row = MagicMock()
    row.location_id = LOC_ID
    row.company_id = COMPANY_A_ID
    found = MagicMock()
    found.scalar_one_or_none.return_value = row
    company_result = MagicMock()
    company_result.scalar_one_or_none.return_value = COMPANY_A_ID
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[company_result, found])

    with pytest.raises(HTTPException) as exc:
        await update_location(
            session,
            _actor_with_company(),
            LOC_ID,
            {"country": "fusgbseu"},
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == INVALID_LOCATION_COUNTRY


@pytest.mark.asyncio
async def test_assert_active_master_not_found() -> None:
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await assert_active_master(session, "department", DEPT_ID)
    assert exc.value.status_code == 400
    assert exc.value.detail == "departmentId not found"


@pytest.mark.asyncio
async def test_assert_active_master_rejects_inactive() -> None:
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = MASTER_STATUS_INACTIVE
    session.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await assert_active_master(session, "location", LOC_ID)
    assert exc.value.status_code == 400
    assert exc.value.detail == "locationId is not Active"


@pytest.mark.asyncio
async def test_assert_active_master_accepts_active() -> None:
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = MASTER_STATUS_ACTIVE
    session.execute = AsyncMock(return_value=result)
    await assert_active_master(session, "designation", DESIG_ID)


@pytest.mark.asyncio
async def test_employee_create_rejects_inactive_department() -> None:
    svc = EmployeeService()
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = MASTER_STATUS_INACTIVE
    session.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await svc._validate_org_fks(
            session, department_id=DEPT_ID, check_department=True
        )
    assert exc.value.status_code == 400
    assert "not Active" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_deactivate_department_blocked_when_assigned() -> None:
    dept = MagicMock()
    dept.status = MASTER_STATUS_ACTIVE
    dept.department_name = "Delivery"
    dept.company_id = COMPANY_A_ID
    found = MagicMock()
    found.scalar_one_or_none.return_value = dept
    children = MagicMock()
    children.scalar_one_or_none.return_value = None
    counted = MagicMock()
    counted.scalar_one.return_value = 3
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[found, children, counted])

    with pytest.raises(HTTPException) as exc:
        await deactivate_department(session, _actor_with_company(), DEPT_ID)
    assert exc.value.status_code == 400
    assert "3 employee" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_deactivate_department_sets_inactive_when_unassigned() -> None:
    dept = MagicMock()
    dept.status = MASTER_STATUS_ACTIVE
    dept.department_name = "Delivery"
    dept.department_head_id = None
    dept.parent_department_id = None
    dept.department_id = DEPT_ID
    dept.company_id = COMPANY_A_ID
    dept.created_by = None
    dept.updated_by = None
    dept.created_date = None
    dept.updated_date = None
    found = MagicMock()
    found.scalar_one_or_none.return_value = dept
    children = MagicMock()
    children.scalar_one_or_none.return_value = None
    counted = MagicMock()
    counted.scalar_one.return_value = 0
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[found, children, counted])
    session.flush = AsyncMock()

    body = await update_department(
        session, _actor_with_company(), DEPT_ID, {"status": "Inactive"}
    )
    assert dept.status == MASTER_STATUS_INACTIVE
    assert body["status"] == MASTER_STATUS_INACTIVE


def test_admin_list_includes_inactive_hr_does_not() -> None:
    assert viewer_sees_inactive({"department": "ADMIN"}) is True
    assert viewer_sees_inactive({"department": "SUPERADMIN"}) is True
    assert viewer_sees_inactive({"department": "HR"}) is False
    assert viewer_sees_inactive({"department": "EMPLOYEE"}) is False
    assert viewer_sees_inactive({"role": "ADMIN", "department": "EMPLOYEE"}) is True
    assert viewer_sees_inactive({"role": "not-a-role", "department": "ADMIN"}) is True
    assert viewer_sees_inactive({"role": "HR", "department": "ADMIN"}) is False


@pytest.mark.asyncio
async def test_hr_get_hides_inactive_department() -> None:
    from app.modules.org.service import get_department

    dept = MagicMock()
    dept.status = MASTER_STATUS_INACTIVE
    found = MagicMock()
    found.scalar_one_or_none.return_value = dept
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    with pytest.raises(HTTPException) as exc:
        await get_department(session, _actor_with_company(), DEPT_ID, include_inactive=False)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_get_returns_inactive_department() -> None:
    from app.modules.org.service import get_department

    dept = MagicMock()
    dept.status = MASTER_STATUS_INACTIVE
    dept.department_id = DEPT_ID
    dept.company_id = COMPANY_A_ID
    dept.department_name = "Old"
    dept.department_head_id = None
    dept.parent_department_id = None
    dept.created_by = None
    dept.updated_by = None
    dept.created_date = None
    dept.updated_date = None
    found = MagicMock()
    found.scalar_one_or_none.return_value = dept
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    body = await get_department(session, _actor_with_company(), DEPT_ID, include_inactive=True)
    assert body["status"] == MASTER_STATUS_INACTIVE


@pytest.mark.asyncio
async def test_parent_cycle_rejected() -> None:
    """Engineering parent=Delivery, then Delivery parent=Engineering."""
    parent_id = uuid4()
    hop = MagicMock()
    hop.scalar_one_or_none.return_value = DEPT_ID
    session = AsyncMock()
    session.execute = AsyncMock(return_value=hop)

    with pytest.raises(HTTPException) as exc:
        await _assert_no_parent_cycle(session, DEPT_ID, parent_id)
    assert exc.value.status_code == 400
    assert "loop the org chart" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_parent_chain_without_cycle_allowed() -> None:
    hop = MagicMock()
    hop.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute = AsyncMock(return_value=hop)

    await _assert_no_parent_cycle(session, DEPT_ID, uuid4())


@pytest.mark.asyncio
async def test_duplicate_department_name_is_friendly_409() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = DEPT_ID
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    with pytest.raises(HTTPException) as exc:
        await _assert_unique_department_name(session, COMPANY_A_ID, "Finance")
    assert exc.value.status_code == 409
    assert exc.value.detail == DEPARTMENT_NAME_TAKEN


@pytest.mark.asyncio
async def test_duplicate_department_name_allowed_across_companies() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    await _assert_unique_department_name(session, COMPANY_B_ID, "Finance")


@pytest.mark.asyncio
async def test_duplicate_designation_title_is_friendly_409() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = DESIG_ID
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    with pytest.raises(HTTPException) as exc:
        await _assert_unique_designation_title(session, COMPANY_A_ID, "Engineer")
    assert exc.value.status_code == 409
    assert exc.value.detail == DESIGNATION_TITLE_TAKEN


@pytest.mark.asyncio
async def test_duplicate_designation_title_allowed_across_companies() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    await _assert_unique_designation_title(session, COMPANY_B_ID, "Engineer")


@pytest.mark.asyncio
async def test_duplicate_location_code_same_company_is_friendly_409() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = LOC_ID
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    with pytest.raises(HTTPException) as exc:
        await _assert_unique_location_code(session, COMPANY_A_ID, "HQ")
    assert exc.value.status_code == 409
    assert exc.value.detail == LOCATION_CODE_TAKEN


@pytest.mark.asyncio
async def test_duplicate_location_code_allowed_across_companies() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    await _assert_unique_location_code(session, COMPANY_B_ID, "HQ")


@pytest.mark.asyncio
async def test_flush_maps_location_company_unique_index_to_409() -> None:
    session = AsyncMock()
    session.flush = AsyncMock(
        side_effect=IntegrityError("stmt", {}, Exception("ux_location_code_company_lower"))
    )

    with pytest.raises(HTTPException) as exc:
        await _flush_unique(
            session,
            index_name="ux_location_code_company_lower",
            detail=LOCATION_CODE_TAKEN,
        )
    assert exc.value.status_code == 409
    assert exc.value.detail == LOCATION_CODE_TAKEN


@pytest.mark.asyncio
async def test_flush_maps_unique_index_to_409() -> None:
    session = AsyncMock()
    session.flush = AsyncMock(
        side_effect=IntegrityError("stmt", {}, Exception("ux_department_name_company_lower"))
    )

    with pytest.raises(HTTPException) as exc:
        await _flush_unique(
            session,
            index_name="ux_department_name_company_lower",
            detail=DEPARTMENT_NAME_TAKEN,
        )
    assert exc.value.status_code == 409
    assert exc.value.detail == DEPARTMENT_NAME_TAKEN
