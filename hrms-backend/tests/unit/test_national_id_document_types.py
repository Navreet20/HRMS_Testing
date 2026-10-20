"""Dev 1 national ID document-type catalog."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.national_id.router import router as nid_router
from app.modules.national_id.service import (
    CODE_TAKEN,
    TYPE_NOT_ACTIVE,
    TYPE_WRONG_COUNTRY,
    _parse_code,
    _parse_country,
    assert_active_national_id_document_type,
    create_document_type,
    list_document_types,
)


def test_routes_registered() -> None:
    paths = {getattr(route, "path", "") for route in nid_router.routes}
    assert "/national-id-document-types" in paths
    assert "/national-id-document-types/{document_type_id}" in paths


def test_code_normalized_and_rejects_junk() -> None:
    assert _parse_code("ssn") == "SSN"
    assert _parse_code("drivers-license") == "DRIVERS_LICENSE"
    with pytest.raises(HTTPException) as exc:
        _parse_code("??")
    assert exc.value.status_code == 400


def test_country_empty_is_global_two_letters_required() -> None:
    assert _parse_country("") is None
    assert _parse_country("in") == "IN"
    with pytest.raises(HTTPException) as exc:
        _parse_country("USA")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_requires_label() -> None:
    with pytest.raises(HTTPException) as exc:
        await create_document_type(AsyncMock(), {"firstName": "Pat"}, {"documentTypeCode": "ITIN"})
    assert exc.value.status_code == 400
    assert "Label" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_duplicate_code_is_409() -> None:
    found = MagicMock()
    found.scalar_one_or_none.return_value = uuid4()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)
    with pytest.raises(HTTPException) as exc:
        await create_document_type(
            session,
            {"firstName": "Pat"},
            {"documentTypeCode": "SSN", "documentTypeLabel": "Social Security Number"},
        )
    assert exc.value.status_code == 409
    assert exc.value.detail == CODE_TAKEN


@pytest.mark.asyncio
async def test_assert_rejects_inactive() -> None:
    row = MagicMock()
    row.status = "Inactive"
    row.country_code = "US"
    found = MagicMock()
    found.scalar_one_or_none.return_value = row
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)
    with pytest.raises(HTTPException) as exc:
        await assert_active_national_id_document_type(
            session, document_type_id=uuid4(), country_code="US"
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == TYPE_NOT_ACTIVE


@pytest.mark.asyncio
async def test_assert_rejects_wrong_country() -> None:
    row = MagicMock()
    row.status = "Active"
    row.country_code = "IN"
    found = MagicMock()
    found.scalar_one_or_none.return_value = row
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)
    with pytest.raises(HTTPException) as exc:
        await assert_active_national_id_document_type(
            session, document_type_id=uuid4(), country_code="US"
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == TYPE_WRONG_COUNTRY


@pytest.mark.asyncio
async def test_assert_allows_global_passport_for_any_country() -> None:
    row = MagicMock()
    row.status = "Active"
    row.country_code = None
    found = MagicMock()
    found.scalar_one_or_none.return_value = row
    session = AsyncMock()
    session.execute = AsyncMock(return_value=found)
    got = await assert_active_national_id_document_type(
        session, document_type_id=uuid4(), country_code="US"
    )
    assert got is row


@pytest.mark.asyncio
async def test_list_applies_country_or_global() -> None:
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    session.execute = AsyncMock(return_value=result)
    await list_document_types(session, country="US")
    session.execute.assert_awaited()
