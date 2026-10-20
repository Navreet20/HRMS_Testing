"""Unit tests for asset allocation / return validation helpers."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.modules.assets.constants import (
    ASSET_CONDITIONS,
    ASSET_STATUSES,
    CATEGORY_SHORT_CODES,
    RETURN_REASONS,
    SEED_ASSET_CATEGORIES,
    SWAP_REASONS,
    WARRANTY_PLAN_TYPES,
    category_short_code,
    company_code_prefix,
    next_asset_id_from_existing,
)
from app.modules.assets.service import _parse_date, _parse_return_fields, _parse_uuid


def test_seed_categories_cover_hardware_types() -> None:
    assert "Laptop" in SEED_ASSET_CATEGORIES
    assert "Access Card" in SEED_ASSET_CATEGORIES
    assert len(SEED_ASSET_CATEGORIES) >= 6


def test_enum_sets_match_locked_sprint_decisions() -> None:
    assert RETURN_REASONS == frozenset({"Employee terminated", "Broken", "Other"})
    assert SWAP_REASONS == frozenset({"Broken", "Upgrade", "Other"})
    assert "Employee terminated" not in SWAP_REASONS
    assert "Terminated" not in SWAP_REASONS
    assert "In Stock" in ASSET_STATUSES
    assert "Assigned" in ASSET_STATUSES
    assert "Under Repair" in ASSET_STATUSES
    assert "Decommissioned" in ASSET_STATUSES
    assert "Lost" in ASSET_STATUSES
    assert "Warranty expired" not in ASSET_STATUSES
    assert ASSET_CONDITIONS == frozenset({"New", "Good", "Fair", "Poor"})
    assert WARRANTY_PLAN_TYPES == frozenset(
        {
            "AppleCare / AppleCare+",
            "Store / retailer protection",
            "Dell ProSupport",
            "HP Care Pack",
            "Other",
        }
    )


def test_action_swapped_constant_available() -> None:
    from app.modules.assets.constants import ACTION_SWAPPED, ACTION_UNDER_REPAIR

    assert ACTION_SWAPPED == "Swapped"
    assert ACTION_UNDER_REPAIR == "Under Repair"


def test_return_to_stock_from_decommissioned_or_under_repair() -> None:
    from types import SimpleNamespace

    from app.modules.assets.constants import ACTION_RETURNED_TO_STOCK
    from app.modules.assets.service import assert_return_to_stock_allowed

    assert ACTION_RETURNED_TO_STOCK == "Returned to stock"
    assert_return_to_stock_allowed(SimpleNamespace(status="Decommissioned"))
    assert_return_to_stock_allowed(SimpleNamespace(status="Under Repair"))
    for bad in ("Assigned", "In Stock"):
        with pytest.raises(HTTPException) as exc:
            assert_return_to_stock_allowed(SimpleNamespace(status=bad))
        assert exc.value.status_code == 400
        assert "Under Repair or Decommissioned" in str(exc.value.detail)


def _return_payload(reason: str, **extra: object) -> dict:
    body: dict = {
        "reasonForReturn": reason,
        "conditionAtReturn": "Good",
        **extra,
    }
    return body


def test_return_accepts_employee_terminated_and_terminated_alias() -> None:
    from datetime import date

    allocated = date(2026, 1, 1)
    reason, *_rest = _parse_return_fields(
        _return_payload("Employee terminated"),
        allocated_date=allocated,
    )
    assert reason == "Employee terminated"

    aliased, *_rest = _parse_return_fields(
        _return_payload("Terminated"),
        allocated_date=allocated,
    )
    assert aliased == "Employee terminated"


def test_swap_rejects_employee_terminated_and_terminated() -> None:
    from datetime import date

    allocated = date(2026, 1, 1)
    for bad in ("Employee terminated", "Terminated"):
        with pytest.raises(HTTPException) as exc:
            _parse_return_fields(
                _return_payload(bad),
                allocated_date=allocated,
                allowed_reasons=SWAP_REASONS,
            )
        assert exc.value.status_code == 400
        detail = str(exc.value.detail)
        assert "reasonForReturn must be one of" in detail
        assert "Broken" in detail
        assert "Upgrade" in detail
        assert "Other" in detail


def test_swap_accepts_broken_upgrade_other() -> None:
    from datetime import date

    allocated = date(2026, 1, 1)
    for reason in ("Broken", "Upgrade"):
        parsed, *_rest = _parse_return_fields(
            _return_payload(reason),
            allocated_date=allocated,
            allowed_reasons=SWAP_REASONS,
        )
        assert parsed == reason

    parsed_other, other_text, *_rest = _parse_return_fields(
        _return_payload("Other", reasonForReturnOther="Role change"),
        allocated_date=allocated,
        allowed_reasons=SWAP_REASONS,
    )
    assert parsed_other == "Other"
    assert other_text == "Role change"


def test_return_rejects_upgrade() -> None:
    from datetime import date

    with pytest.raises(HTTPException) as exc:
        _parse_return_fields(
            _return_payload("Upgrade"),
            allocated_date=date(2026, 1, 1),
        )
    assert exc.value.status_code == 400
    detail = str(exc.value.detail)
    assert "reasonForReturn must be one of" in detail
    assert "Employee terminated" in detail
    assert "Broken" in detail
    assert "Other" in detail
    # Swap-only Upgrade must not leak onto the return allow-list message.
    allowed = detail.split("one of:", 1)[-1]
    assert "Upgrade" not in allowed


def test_parse_uuid_rejects_invalid() -> None:
    with pytest.raises(HTTPException) as exc:
        _parse_uuid("not-a-uuid", "employeeId")
    assert exc.value.status_code == 400


def test_parse_date_iso() -> None:
    assert _parse_date("2026-09-10", "allocatedDate").isoformat() == "2026-09-10"


def test_parse_date_rejects_blank() -> None:
    with pytest.raises(HTTPException) as exc:
        _parse_date("", "returnedDate")
    assert exc.value.status_code == 400


def test_category_short_code_known_map() -> None:
    assert category_short_code("Laptop") == "LAP"
    assert category_short_code("Mobile") == "MOB"
    assert category_short_code("Access Card") == "ACC"
    assert CATEGORY_SHORT_CODES["Keyboard"] == "KEY"
    assert CATEGORY_SHORT_CODES["Mouse"] == "MOU"
    assert CATEGORY_SHORT_CODES["Monitor"] == "MON"


def test_category_short_code_fallback() -> None:
    assert category_short_code("Docking Station") == "DOC"
    assert category_short_code("AB") == "ABX"
    assert category_short_code("  headset mic ") == "HEA"


def test_company_code_prefix_from_company_name() -> None:
    assert company_code_prefix("EAOVA") == "EAO"
    assert company_code_prefix("Cognivance") == "COG"
    assert company_code_prefix("  cognivance llc ") == "COG"
    assert company_code_prefix("HP") == "HPX"
    assert company_code_prefix("") == "XXX"


def test_next_asset_id_starts_at_0001() -> None:
    assert next_asset_id_from_existing([], "LAP", "COG") == "COG-LAP-0001"
    assert next_asset_id_from_existing([], "LAP", "EAO") == "EAO-LAP-0001"


def test_next_asset_id_increments_highest_suffix() -> None:
    existing = ["COG-LAP-0001", "COG-LAP-0003", "COG-MOB-0009", "noise"]
    assert next_asset_id_from_existing(existing, "LAP", "COG") == "COG-LAP-0004"
    assert next_asset_id_from_existing(existing, "LAP", "EAO") == "EAO-LAP-0001"


def test_normalize_optional_os_platform_blank_is_none_for_mobile() -> None:
    """Mobile must not invent Android (or iOS) when OS is omitted/blank."""
    from app.modules.assets.constants import normalize_optional_os_platform

    assert normalize_optional_os_platform(None, "Mobile") is None
    assert normalize_optional_os_platform("", "Mobile") is None
    assert normalize_optional_os_platform("   ", "Mobile") is None
    assert normalize_optional_os_platform("Android", "Mobile") == "Android"
    assert normalize_optional_os_platform("iOS", "Mobile") == "iOS"


def test_normalize_optional_os_platform_rejects_wrong_category() -> None:
    from app.modules.assets.constants import normalize_optional_os_platform

    with pytest.raises(ValueError, match="not allowed"):
        normalize_optional_os_platform("Android", "Monitor")
    with pytest.raises(ValueError, match="must be one of"):
        normalize_optional_os_platform("Mac", "Mobile")


def test_serial_number_required_for_laptop_and_mobile() -> None:
    from app.modules.assets.constants import (
        normalize_optional_serial_number,
        serial_number_required_for_category,
    )

    assert serial_number_required_for_category("Laptop") is True
    assert serial_number_required_for_category("Mobile") is True
    assert serial_number_required_for_category("Keyboard") is False
    assert serial_number_required_for_category("Mouse") is False
    assert serial_number_required_for_category("Monitor") is False
    assert serial_number_required_for_category("Access Card") is False
    assert serial_number_required_for_category("Docking Station") is False

    assert normalize_optional_serial_number(" SN-1 ", "Laptop") == "SN-1"
    assert normalize_optional_serial_number("SN-2", "Keyboard") == "SN-2"
    assert normalize_optional_serial_number(None, "Monitor") is None
    assert normalize_optional_serial_number("", "Access Card") is None
    assert normalize_optional_serial_number("   ", "Mouse") is None

    with pytest.raises(ValueError, match="serialNumber is required for category Laptop"):
        normalize_optional_serial_number(None, "Laptop")
    with pytest.raises(ValueError, match="serialNumber is required for category Mobile"):
        normalize_optional_serial_number("  ", "Mobile")


def test_patch_purchase_date_immutable_once_set() -> None:
    from datetime import date

    from app.modules.assets.service import _resolve_patch_purchase_date

    existing = date(2026, 9, 10)
    assert _resolve_patch_purchase_date(None, date(2026, 1, 1)) == date(2026, 1, 1)
    assert _resolve_patch_purchase_date(None, None) is None
    assert _resolve_patch_purchase_date(existing, existing) == existing

    with pytest.raises(HTTPException) as changed:
        _resolve_patch_purchase_date(existing, date(2026, 1, 1))
    assert changed.value.status_code == 400
    assert "cannot be changed" in str(changed.value.detail)

    with pytest.raises(HTTPException) as cleared:
        _resolve_patch_purchase_date(existing, None)
    assert cleared.value.status_code == 400


def test_assignment_email_bodies_are_readable() -> None:
    from datetime import date

    from app.modules.assets.notifications import build_assignment_email_bodies

    text, html_body = build_assignment_email_bodies(
        employee_name="Avery Nguyen",
        company="EAOVA",
        asset_id="COG-LAP-0003",
        category_name="Laptop",
        model="ThinkPad X1",
        serial_number="SN-99",
        allocated_date=date(2026, 9, 11),
        assigned_by="HR",
        from_name="EAOVA",
        profile_assets_hint="You'll see it under Profile → Assets.",
    )
    assert "Hi Avery Nguyen" in text
    assert "confirms you now have the device" in text
    assert "COG-LAP-0003" in text
    assert "Category: Laptop" in text
    assert "Model: ThinkPad X1" in text
    assert "Serial number: SN-99" in text
    assert "Assigned on: 2026-09-11" in text
    assert "Profile → Assets" in text
    assert "My Assets" not in text
    assert "sticker matches" in text
    assert "please send these back" not in text.lower()
    assert "COG-LAP-0003" in html_body
    assert "<table" in html_body
    assert "ThinkPad X1" in html_body
    assert "Profile → Assets" in html_body
    # XSS-safe escaping for injected names
    evil_text, evil_html = build_assignment_email_bodies(
        employee_name='<script>alert(1)</script>',
        company="EAOVA",
        asset_id="COG-LAP-0001",
        category_name=None,
        model=None,
        serial_number=None,
        allocated_date=date(2026, 9, 11),
        assigned_by=None,
        from_name="EAOVA",
    )
    assert "<script>" not in evil_html
    assert "&lt;script&gt;" in evil_html
    assert "Serial number" not in evil_text
    assert "Model: —" in evil_text


def test_return_email_bodies_are_readable() -> None:
    from datetime import date

    from app.modules.assets.notifications import build_return_email_bodies

    text, html_body = build_return_email_bodies(
        employee_name="Avery Nguyen",
        company="EAOVA",
        asset_id="COG-LAP-0003",
        category_name="Laptop",
        model="ThinkPad X1",
        serial_number="SN-99",
        reason="Other",
        reason_other="Role change",
        condition_at_return="Good",
        returned_date=date(2026, 9, 12),
        returned_by="HR",
        from_name="EAOVA",
    )
    assert "return of a company asset" in text
    assert "You are no longer responsible for this device." in text
    assert "please send these back" not in text.lower()
    assert "Model: ThinkPad X1" in text
    assert "Serial number: SN-99" in text
    assert "Other — Role change" in text
    assert "Returned on: 2026-09-12" in text
    assert "COG-LAP-0003" in html_body
    assert "Role change" in html_body
    assert "ThinkPad X1" in html_body


def test_outgoing_status_broken_is_under_repair() -> None:
    from app.modules.assets.service import outgoing_status_for_return_reason

    assert outgoing_status_for_return_reason("Broken") == "Under Repair"
    assert outgoing_status_for_return_reason("broken") == "Under Repair"
    assert outgoing_status_for_return_reason("BROKEN") == "Under Repair"
    assert outgoing_status_for_return_reason("Other") == "In Stock"
    assert outgoing_status_for_return_reason("Employee terminated") == "In Stock"
    assert outgoing_status_for_return_reason("Upgrade") == "In Stock"


def test_normalize_optional_warranty_plan_type() -> None:
    from app.modules.assets.constants import normalize_optional_warranty_plan_type

    assert normalize_optional_warranty_plan_type(None) is None
    assert normalize_optional_warranty_plan_type("") is None
    assert normalize_optional_warranty_plan_type("   ") is None
    assert (
        normalize_optional_warranty_plan_type(" AppleCare / AppleCare+ ")
        == "AppleCare / AppleCare+"
    )
    with pytest.raises(ValueError, match="warrantyPlanType must be one of"):
        normalize_optional_warranty_plan_type("AppleCare+ AC-19")


def test_asset_to_dict_includes_optional_warranty_plan() -> None:
    from app.modules.assets.service import asset_to_dict

    row = _asset_ns(status="In Stock")
    row.warranty_plan_type = "  AppleCare / AppleCare+  "
    row.warranty_plan = "  AC-19  "
    payload = asset_to_dict(row)
    assert payload["warrantyPlanType"] == "AppleCare / AppleCare+"
    assert payload["warrantyPlan"] == "AC-19"
    row.warranty_plan_type = None
    row.warranty_plan = None
    payload = asset_to_dict(row)
    assert payload["warrantyPlanType"] is None
    assert payload["warrantyPlan"] is None
    row.warranty_plan_type = ""
    row.warranty_plan = ""
    payload = asset_to_dict(row)
    assert payload["warrantyPlanType"] is None
    assert payload["warrantyPlan"] is None


def _asset_ns(*, status: str, system_asset_id=None, category_id=None):
    import uuid
    from types import SimpleNamespace

    return SimpleNamespace(
        system_asset_id=system_asset_id or uuid.uuid4(),
        category_id=category_id or uuid.uuid4(),
        asset_id="COG-LAP-0001",
        serial_number="SN-1",
        model="X1",
        os_platform="Windows",
        specifications=None,
        purchase_date=None,
        warranty_expiry=None,
        warranty_plan_type=None,
        warranty_plan=None,
        condition="Good",
        status=status,
        updated_by=None,
        updated_date=None,
    )


def _allocation_ns(*, system_asset_id, employee_id=None):
    import uuid
    from datetime import date
    from types import SimpleNamespace

    return SimpleNamespace(
        allocation_id=uuid.uuid4(),
        system_asset_id=system_asset_id,
        employee_id=employee_id or uuid.uuid4(),
        allocated_date=date(2026, 1, 1),
        returned_date=None,
        condition_at_return=None,
        reason_for_return=None,
        reason_for_return_other=None,
        return_notes=None,
        swapped_with_allocation_id=None,
        updated_by=None,
        updated_date=None,
    )


def test_allocation_to_dict_includes_model_and_serial() -> None:
    from app.modules.assets.service import allocation_to_dict

    asset = _asset_ns(status="Assigned")
    payload = allocation_to_dict(
        _allocation_ns(system_asset_id=asset.system_asset_id),
        asset_id=asset.asset_id,
        category_name="Laptop",
        model=asset.model,
        serial_number=asset.serial_number,
    )
    assert payload["categoryName"] == "Laptop"
    assert payload["model"] == "X1"
    assert payload["serialNumber"] == "SN-1"
    assert payload["assetId"] == "COG-LAP-0001"


@pytest.mark.asyncio
async def test_return_broken_sets_under_repair(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    asset = _asset_ns(status="Assigned")
    allocation = _allocation_ns(system_asset_id=asset.system_asset_id)
    alloc_result = MagicMock()
    alloc_result.scalar_one_or_none.return_value = allocation
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = None
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[alloc_result, emp_result])
    db.flush = AsyncMock()
    db.add = MagicMock()
    monkeypatch.setattr(svc, "_require_asset", AsyncMock(return_value=asset))
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))

    result = await svc.return_allocation(
        db,
        {"firstName": "Pat", "lastName": "HR"},
        allocation.allocation_id,
        {"reasonForReturn": "Broken", "conditionAtReturn": "Poor"},
    )
    assert asset.status == "Under Repair"
    assert result["asset"]["status"] == "Under Repair"
    log = db.add.call_args.args[0]
    assert log.action_type == "Under Repair"


@pytest.mark.asyncio
async def test_return_other_sets_in_stock(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    asset = _asset_ns(status="Assigned")
    allocation = _allocation_ns(system_asset_id=asset.system_asset_id)
    alloc_result = MagicMock()
    alloc_result.scalar_one_or_none.return_value = allocation
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = None
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[alloc_result, emp_result])
    db.flush = AsyncMock()
    db.add = MagicMock()
    monkeypatch.setattr(svc, "_require_asset", AsyncMock(return_value=asset))
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))

    result = await svc.return_allocation(
        db,
        {"firstName": "Pat", "lastName": "HR"},
        allocation.allocation_id,
        {
            "reasonForReturn": "Other",
            "reasonForReturnOther": "Role change",
            "conditionAtReturn": "Good",
        },
    )
    assert asset.status == "In Stock"
    assert result["asset"]["status"] == "In Stock"
    log = db.add.call_args.args[0]
    assert log.action_type == "Returned"


@pytest.mark.asyncio
async def test_swap_broken_sets_old_asset_under_repair(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import uuid
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    new_id = uuid.uuid4()
    emp_id = uuid.uuid4()
    category_id = uuid.uuid4()
    old_asset = _asset_ns(status="Assigned", category_id=category_id)
    new_asset = _asset_ns(
        status="In Stock", system_asset_id=new_id, category_id=category_id
    )
    new_asset.asset_id = "COG-LAP-0002"
    old_allocation = _allocation_ns(
        system_asset_id=old_asset.system_asset_id, employee_id=emp_id
    )
    new_allocation = _allocation_ns(system_asset_id=new_id, employee_id=emp_id)
    employee = SimpleNamespace(
        employee_id=emp_id,
        first_name="Ada",
        last_name="Lovelace",
        email_id="ada@example.com",
    )

    alloc_result = MagicMock()
    alloc_result.scalar_one_or_none.return_value = old_allocation
    db = AsyncMock()
    db.execute = AsyncMock(return_value=alloc_result)
    db.flush = AsyncMock()
    db.add = MagicMock()

    assets = {
        old_asset.system_asset_id: old_asset,
        new_id: new_asset,
    }

    async def fake_require_asset(_db, system_asset_id):
        return assets[system_asset_id]

    async def fake_open(
        _db, _actor, asset, _employee, *, allocated_date, log_notes=None, write_log=True
    ):
        asset.status = "Assigned"
        new_allocation.allocated_date = allocated_date
        return new_allocation

    logged: list[str] = []

    async def capture_log(_db, *, system_asset_id, action_type, performed_by, notes=None):
        del system_asset_id, performed_by, notes
        logged.append(action_type)

    monkeypatch.setattr(svc, "_require_asset", fake_require_asset)
    monkeypatch.setattr(svc, "_assert_asset_assignable", AsyncMock())
    monkeypatch.setattr(
        svc, "_require_active_employee", AsyncMock(return_value=employee)
    )
    monkeypatch.setattr(svc, "_open_allocation_for_employee", fake_open)
    monkeypatch.setattr(svc, "_append_log", capture_log)
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))
    monkeypatch.setattr(svc, "notify_asset_swapped", AsyncMock())

    result = await svc.swap_asset(
        db,
        {"firstName": "Pat", "lastName": "HR"},
        old_allocation.allocation_id,
        {
            "systemAssetId": str(new_id),
            "reasonForReturn": "Broken",
            "conditionAtReturn": "Poor",
        },
    )
    assert old_asset.status == "Under Repair"
    assert result["returned"]["asset"]["status"] == "Under Repair"
    assert new_asset.status == "Assigned"
    assert logged[0] == "Under Repair"
    assert new_allocation.allocated_date is not None
    assert logged[1] == "Assigned"


@pytest.mark.asyncio
async def test_swap_same_category_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import uuid
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    new_id = uuid.uuid4()
    emp_id = uuid.uuid4()
    category_id = uuid.uuid4()
    old_asset = _asset_ns(status="Assigned", category_id=category_id)
    new_asset = _asset_ns(
        status="In Stock", system_asset_id=new_id, category_id=category_id
    )
    new_asset.asset_id = "COG-LAP-0002"
    old_allocation = _allocation_ns(
        system_asset_id=old_asset.system_asset_id, employee_id=emp_id
    )
    new_allocation = _allocation_ns(system_asset_id=new_id, employee_id=emp_id)
    employee = SimpleNamespace(
        employee_id=emp_id,
        first_name="Ada",
        last_name="Lovelace",
        email_id="ada@example.com",
    )

    alloc_result = MagicMock()
    alloc_result.scalar_one_or_none.return_value = old_allocation
    db = AsyncMock()
    db.execute = AsyncMock(return_value=alloc_result)
    db.flush = AsyncMock()
    db.add = MagicMock()

    assets = {
        old_asset.system_asset_id: old_asset,
        new_id: new_asset,
    }

    async def fake_require_asset(_db, system_asset_id):
        return assets[system_asset_id]

    async def fake_open(
        _db, _actor, asset, _employee, *, allocated_date, log_notes=None, write_log=True
    ):
        asset.status = "Assigned"
        new_allocation.allocated_date = allocated_date
        return new_allocation

    monkeypatch.setattr(svc, "_require_asset", fake_require_asset)
    monkeypatch.setattr(svc, "_assert_asset_assignable", AsyncMock())
    monkeypatch.setattr(
        svc, "_require_active_employee", AsyncMock(return_value=employee)
    )
    monkeypatch.setattr(svc, "_open_allocation_for_employee", fake_open)
    monkeypatch.setattr(svc, "_append_log", AsyncMock())
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))
    monkeypatch.setattr(svc, "notify_asset_swapped", AsyncMock())

    result = await svc.swap_asset(
        db,
        {"firstName": "Pat", "lastName": "HR"},
        old_allocation.allocation_id,
        {
            "systemAssetId": str(new_id),
            "reasonForReturn": "Upgrade",
            "conditionAtReturn": "Good",
        },
    )
    assert result["swapped"] is True
    assert old_asset.status == "In Stock"
    assert new_asset.status == "Assigned"
    assert old_asset.category_id == new_asset.category_id


@pytest.mark.asyncio
async def test_swap_rejects_different_category(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import uuid
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    new_id = uuid.uuid4()
    old_asset = _asset_ns(status="Assigned")
    new_asset = _asset_ns(status="In Stock", system_asset_id=new_id)
    old_allocation = _allocation_ns(system_asset_id=old_asset.system_asset_id)

    alloc_result = MagicMock()
    alloc_result.scalar_one_or_none.return_value = old_allocation
    db = AsyncMock()
    db.execute = AsyncMock(return_value=alloc_result)

    assets = {
        old_asset.system_asset_id: old_asset,
        new_id: new_asset,
    }

    async def fake_require_asset(_db, system_asset_id):
        return assets[system_asset_id]

    monkeypatch.setattr(svc, "_require_asset", fake_require_asset)
    monkeypatch.setattr(svc, "_assert_asset_assignable", AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await svc.swap_asset(
            db,
            {"firstName": "Pat", "lastName": "HR"},
            old_allocation.allocation_id,
            {
                "systemAssetId": str(new_id),
                "reasonForReturn": "Upgrade",
                "conditionAtReturn": "Good",
            },
        )
    assert exc.value.status_code == 400
    assert "same category" in str(exc.value.detail).lower()
    assert old_asset.status == "Assigned"
    assert new_asset.status == "In Stock"


@pytest.mark.asyncio
async def test_return_to_stock_from_under_repair(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    asset = _asset_ns(status="Under Repair")
    db = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    monkeypatch.setattr(svc, "_require_asset", AsyncMock(return_value=asset))
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))

    result = await svc.return_asset_to_stock(
        db, {"firstName": "Pat", "lastName": "HR"}, asset.system_asset_id
    )
    assert asset.status == "In Stock"
    assert result["status"] == "In Stock"
    log = db.add.call_args.args[0]
    assert log.action_type == "Returned to stock"


@pytest.mark.asyncio
async def test_return_to_stock_from_assigned_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import AsyncMock

    from app.modules.assets import service as svc

    asset = _asset_ns(status="Assigned")
    monkeypatch.setattr(svc, "_require_asset", AsyncMock(return_value=asset))
    with pytest.raises(HTTPException) as exc:
        await svc.return_asset_to_stock(
            AsyncMock(), {"firstName": "Pat", "lastName": "HR"}, asset.system_asset_id
        )
    assert exc.value.status_code == 400
    assert asset.status == "Assigned"


@pytest.mark.asyncio
async def test_decommission_from_under_repair(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    asset = _asset_ns(status="Under Repair")
    db = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    monkeypatch.setattr(svc, "_require_asset", AsyncMock(return_value=asset))
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))

    result = await svc.retire_asset(
        db, {"firstName": "Pat", "lastName": "HR"}, asset.system_asset_id
    )
    assert asset.status == "Decommissioned"
    assert result["status"] == "Decommissioned"
    log = db.add.call_args.args[0]
    assert log.action_type == "Decommissioned"


def test_warranty_expiring_soon_window_includes_within_excludes_expired_and_far() -> None:
    from datetime import date, timedelta

    from app.modules.assets.constants import WARRANTY_EXPIRING_SOON_DAYS
    from app.modules.assets.service import (
        _resolve_warranty_expiry_bounds,
        warranty_expiry_in_range,
    )

    today = date(2026, 9, 16)
    start, end = _resolve_warranty_expiry_bounds(
        warranty_expiring_soon=True,
        warranty_expiry_from="2020-01-01",
        warranty_expiry_to="2030-12-31",
        today=today,
    )
    assert start == today
    assert end == today + timedelta(days=WARRANTY_EXPIRING_SOON_DAYS)

    soon = today + timedelta(days=10)
    far = today + timedelta(days=90)
    expired = today - timedelta(days=1)

    assert warranty_expiry_in_range(soon, start, end)
    assert warranty_expiry_in_range(today, start, end)
    assert warranty_expiry_in_range(end, start, end)
    assert not warranty_expiry_in_range(far, start, end)
    assert not warranty_expiry_in_range(expired, start, end)
    assert not warranty_expiry_in_range(None, start, end)


def test_warranty_expiry_explicit_from_to_used_when_soon_flag_off() -> None:
    from datetime import date

    from app.modules.assets.service import _resolve_warranty_expiry_bounds

    start, end = _resolve_warranty_expiry_bounds(
        warranty_expiring_soon=False,
        warranty_expiry_from="2026-06-01",
        warranty_expiry_to="2027-06-01",
    )
    assert start == date(2026, 6, 1)
    assert end == date(2027, 6, 1)

    empty_start, empty_end = _resolve_warranty_expiry_bounds()
    assert empty_start is None
    assert empty_end is None


@pytest.mark.asyncio
async def test_list_assets_warranty_expiring_soon_compiles_today_window(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from datetime import date, timedelta
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc
    from app.modules.assets.constants import WARRANTY_EXPIRING_SOON_DAYS

    captured: list = []

    async def fake_execute(stmt):
        captured.append(stmt)
        result = MagicMock()
        scalars = MagicMock()
        scalars.all.return_value = []
        result.scalars.return_value = scalars
        return result

    db = AsyncMock()
    db.execute = fake_execute
    monkeypatch.setattr(svc, "seed_default_asset_categories", AsyncMock())
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))
    monkeypatch.setattr(
        svc, "_open_allocations_by_asset", AsyncMock(return_value={})
    )
    monkeypatch.setattr(svc, "_employees_by_id", AsyncMock(return_value={}))

    await svc.list_assets(
        db,
        warranty_expiring_soon=True,
        warranty_expiry_from="2020-01-01",
        warranty_expiry_to="2030-12-31",
    )

    assert captured
    compiled = captured[0].compile(compile_kwargs={"literal_binds": True})
    sql = str(compiled)
    today = date.today()
    end = today + timedelta(days=WARRANTY_EXPIRING_SOON_DAYS)
    assert today.isoformat() in sql
    assert end.isoformat() in sql
    assert "2020-01-01" not in sql
    assert "2030-12-31" not in sql


def test_warranty_expired_is_before_today_and_excludes_soon_window() -> None:
    from datetime import date, timedelta

    from app.modules.assets.constants import WARRANTY_EXPIRING_SOON_DAYS
    from app.modules.assets.service import (
        _resolve_warranty_expiry_bounds,
        warranty_expiry_in_range,
        warranty_expiry_is_expired,
    )

    today = date(2026, 9, 16)
    yesterday = today - timedelta(days=1)
    soon = today + timedelta(days=10)
    window_end = today + timedelta(days=WARRANTY_EXPIRING_SOON_DAYS)

    assert warranty_expiry_is_expired(yesterday, today)
    assert not warranty_expiry_is_expired(today, today)
    assert not warranty_expiry_is_expired(soon, today)
    assert not warranty_expiry_is_expired(window_end, today)
    assert not warranty_expiry_is_expired(None, today)

    soon_start, soon_end = _resolve_warranty_expiry_bounds(
        warranty_expiring_soon=True, today=today
    )
    assert warranty_expiry_in_range(today, soon_start, soon_end)
    assert warranty_expiry_in_range(soon, soon_start, soon_end)
    assert not warranty_expiry_in_range(yesterday, soon_start, soon_end)

    expired_start, expired_end = _resolve_warranty_expiry_bounds(
        warranty_expired=True,
        warranty_expiry_from="2020-01-01",
        warranty_expiry_to="2030-12-31",
        today=today,
    )
    assert expired_start is None
    assert expired_end is None

    with pytest.raises(HTTPException) as exc:
        _resolve_warranty_expiry_bounds(
            warranty_expiring_soon=True,
            warranty_expired=True,
            today=today,
        )
    assert exc.value.status_code == 400
    assert "cannot both be true" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_list_assets_warranty_expired_compiles_before_today(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from datetime import date
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    captured: list = []

    async def fake_execute(stmt):
        captured.append(stmt)
        result = MagicMock()
        scalars = MagicMock()
        scalars.all.return_value = []
        result.scalars.return_value = scalars
        return result

    db = AsyncMock()
    db.execute = fake_execute
    monkeypatch.setattr(svc, "seed_default_asset_categories", AsyncMock())
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))
    monkeypatch.setattr(
        svc, "_open_allocations_by_asset", AsyncMock(return_value={})
    )
    monkeypatch.setattr(svc, "_employees_by_id", AsyncMock(return_value={}))

    await svc.list_assets(
        db,
        warranty_expired=True,
        warranty_expiry_from="2020-01-01",
        warranty_expiry_to="2030-12-31",
    )

    assert captured
    compiled = captured[0].compile(compile_kwargs={"literal_binds": True})
    sql = str(compiled)
    today = date.today()
    assert today.isoformat() in sql
    assert "2020-01-01" not in sql
    assert "2030-12-31" not in sql


@pytest.mark.asyncio
async def test_list_assets_q_matches_category_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.modules.assets import service as svc

    captured: list = []

    async def fake_execute(stmt):
        captured.append(stmt)
        result = MagicMock()
        scalars = MagicMock()
        scalars.all.return_value = []
        result.scalars.return_value = scalars
        return result

    db = AsyncMock()
    db.execute = fake_execute
    monkeypatch.setattr(svc, "seed_default_asset_categories", AsyncMock())
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))
    monkeypatch.setattr(
        svc, "_open_allocations_by_asset", AsyncMock(return_value={})
    )
    monkeypatch.setattr(svc, "_employees_by_id", AsyncMock(return_value={}))

    await svc.list_assets(db, q="laptop", employee_name="laptop")

    assert captured
    compiled = captured[0].compile(compile_kwargs={"literal_binds": True})
    sql = str(compiled).lower()
    assert "%laptop%" in sql
    assert "category_name" in sql or "asset_category" in sql
    assert "first_name" in sql
    assert "model" in sql


@pytest.mark.asyncio
async def test_list_assets_rejects_both_warranty_flags() -> None:
    from unittest.mock import AsyncMock

    from app.modules.assets import service as svc

    with pytest.raises(HTTPException) as exc:
        await svc.list_assets(
            AsyncMock(),
            warranty_expiring_soon=True,
            warranty_expired=True,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_assign_from_under_repair_rejected() -> None:
    from unittest.mock import AsyncMock

    from app.modules.assets import service as svc

    asset = _asset_ns(status="Under Repair")
    with pytest.raises(HTTPException) as exc:
        await svc._assert_asset_assignable(AsyncMock(), asset)
    assert exc.value.status_code == 400
    assert "Under Repair" in str(exc.value.detail)
