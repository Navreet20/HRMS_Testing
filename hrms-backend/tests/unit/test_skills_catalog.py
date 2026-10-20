"""Shared skills catalog (migration-managed; no admin CRUD)."""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.skills.service import (
    CATALOG_LOCKED,
    SKILL_ALREADY_ATTACHED,
    assert_active_skill,
    assert_catalog_skill,
    attach_employee_skills,
    create_skill,
    employee_skill_to_dict,
    merge_skills,
    set_skill_certificate,
    clear_skill_certificate,
    update_employee_skill,
    _optional_certificate_expiry,
    _parse_skill_ids,
)
from app.modules.skills.router import router as skills_router


def test_skill_routes_registered() -> None:
    paths = {getattr(route, "path", "") for route in skills_router.routes}
    assert "/skills" in paths
    assert "/skills/{skill_id}" in paths
    assert "/skills/merge" in paths
    assert "/skills/proposals" not in paths
    assert "/skills/notifications" not in paths
    delete_skill_methods = {
        method
        for route in skills_router.routes
        if getattr(route, "path", "") == "/skills/{skill_id}"
        for method in (getattr(route, "methods", None) or set())
    }
    assert "DELETE" not in delete_skill_methods


@pytest.mark.asyncio
async def test_create_skill_is_locked() -> None:
    with pytest.raises(HTTPException) as exc:
        await create_skill(AsyncMock(), {"firstName": "Pat"}, {"skillName": "Python"})
    assert exc.value.status_code == 403
    assert exc.value.detail == CATALOG_LOCKED


@pytest.mark.asyncio
async def test_merge_skills_is_locked() -> None:
    with pytest.raises(HTTPException) as exc:
        await merge_skills(AsyncMock(), {"firstName": "Pat"}, {})
    assert exc.value.status_code == 403
    assert exc.value.detail == CATALOG_LOCKED


@pytest.mark.asyncio
async def test_assert_catalog_skill_accepts_any_status() -> None:
    skill = MagicMock()
    skill.status = "Inactive"
    found = MagicMock()
    found.scalar_one_or_none.return_value = skill
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    row = await assert_catalog_skill(session, uuid4())
    assert row is skill
    # Alias still works and does not reject Inactive.
    row2 = await assert_active_skill(session, uuid4())
    assert row2 is skill


@pytest.mark.asyncio
async def test_assert_catalog_skill_missing() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)

    with pytest.raises(HTTPException) as exc:
        await assert_catalog_skill(session, uuid4())
    assert exc.value.status_code == 400


def test_parse_skill_ids_from_list_or_single() -> None:
    skill_id = uuid4()
    assert _parse_skill_ids({"skillIds": [str(skill_id)]}) == [skill_id]
    assert _parse_skill_ids({"skillId": str(skill_id)}) == [skill_id]


@pytest.mark.asyncio
async def test_attach_accepts_catalog_skill_without_status_gate() -> None:
    employee_id = uuid4()
    skill_id = uuid4()
    skill = MagicMock()
    skill.status = "Inactive"
    skill.skill_id = skill_id

    exists = MagicMock()
    exists.scalar_one_or_none.return_value = employee_id
    skill_found = MagicMock()
    skill_found.scalar_one_or_none.return_value = skill
    already = MagicMock()
    already.scalar_one_or_none.return_value = None
    empty_list = MagicMock()
    empty_list.scalars.return_value.all.return_value = []

    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[
            exists,
            skill_found,
            already,
            empty_list,
            empty_list,
            empty_list,
            empty_list,
        ]
    )
    session.flush = AsyncMock()
    session.add = MagicMock()

    with patch(
        "app.modules.skills.service.snapshot_skills",
        new=AsyncMock(return_value=[]),
    ), patch(
        "app.modules.skills.service.record_profile_audit",
        new=AsyncMock(),
    ), patch(
        "app.modules.skills.service.list_employee_skills",
        new=AsyncMock(return_value=[]),
    ):
        await attach_employee_skills(
            session,
            {"firstName": "Pat"},
            employee_id,
            {"skillIds": [str(skill_id)]},
        )
    session.add.assert_called()


@pytest.mark.asyncio
async def test_attach_rejects_duplicate() -> None:
    employee_id = uuid4()
    skill_id = uuid4()
    skill = MagicMock()
    skill.status = "Active"

    exists = MagicMock()
    exists.scalar_one_or_none.return_value = employee_id
    skill_found = MagicMock()
    skill_found.scalar_one_or_none.return_value = skill
    already = MagicMock()
    already.scalar_one_or_none.return_value = uuid4()

    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[exists, skill_found, already])

    with patch(
        "app.modules.skills.service.snapshot_skills",
        new=AsyncMock(return_value=[]),
    ):
        with pytest.raises(HTTPException) as exc:
            await attach_employee_skills(
                session,
                {"firstName": "Pat"},
                employee_id,
                {"skillIds": [str(skill_id)]},
            )
    assert exc.value.status_code == 409
    assert exc.value.detail == SKILL_ALREADY_ATTACHED


def test_optional_certificate_expiry_future() -> None:
    future = (date.today() + timedelta(days=30)).isoformat()
    assert _optional_certificate_expiry({"certificateExpiresOn": future}) is not None


def test_optional_certificate_expiry_rejects_past() -> None:
    past = (date.today() - timedelta(days=1)).isoformat()
    with pytest.raises(HTTPException) as exc:
        _optional_certificate_expiry({"certificateExpiresOn": past})
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_update_employee_skill_proficiency() -> None:
    row = MagicMock()
    row.proficiency = None
    row.years_experience = None
    with patch(
        "app.modules.skills.service.get_employee_skill",
        new=AsyncMock(return_value=row),
    ):
        session = AsyncMock()
        session.flush = AsyncMock()
        with patch(
            "app.modules.skills.service.employee_skill_to_dict",
            return_value={"skillId": "x"},
        ):
            result = await update_employee_skill(
                session,
                {"firstName": "Pat"},
                uuid4(),
                uuid4(),
                {"proficiency": "EXPERT"},
            )
    assert result["skillId"] == "x"
    assert row.proficiency == "EXPERT"


@pytest.mark.asyncio
async def test_set_and_clear_certificate() -> None:
    row = MagicMock()
    row.certificate_object_key = None
    row.certificate_file_name = None
    row.certificate_name = None
    row.certificate_expires_on = None

    with patch(
        "app.modules.skills.service.get_employee_skill",
        new=AsyncMock(return_value=row),
    ), patch(
        "app.modules.skills.service.employee_skill_to_dict",
        return_value={"hasCertificate": True},
    ), patch(
        "app.modules.skills.service._remove_certificate_object"
    ):
        session = AsyncMock()
        session.flush = AsyncMock()
        payload, previous = await set_skill_certificate(
            session,
            {"firstName": "Pat"},
            uuid4(),
            uuid4(),
            "obj-key",
            "cert.pdf",
        )
        assert payload["hasCertificate"] is True
        assert previous is None
        assert row.certificate_object_key == "obj-key"

        row.certificate_object_key = "obj-key"
        with patch(
            "app.modules.skills.service.employee_skill_to_dict",
            return_value={"hasCertificate": False},
        ):
            cleared = await clear_skill_certificate(
                session, {"firstName": "Pat"}, uuid4(), uuid4()
            )
        assert cleared["hasCertificate"] is False
