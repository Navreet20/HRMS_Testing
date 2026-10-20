"""Unit tests for national ID identity apply + encryption."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core import field_crypto
from app.core.config import get_settings
from app.core.field_crypto import decrypt_field
from app.modules.employee.national_id_identity import (
    NATIONAL_ID_VERIFICATION_PENDING,
    apply_national_id_identity,
)


@pytest.fixture(autouse=True)
def _clear_crypto_caches(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-for-fernet")
    get_settings.cache_clear()
    field_crypto._fernet.cache_clear()
    yield
    get_settings.cache_clear()
    field_crypto._fernet.cache_clear()


def _emp(**overrides: object) -> MagicMock:
    emp = MagicMock()
    emp.work_mode = None
    emp.location_id = None
    emp.nationality = "US"
    emp.national_id_document_type = None
    emp.national_id_country = None
    for key, value in overrides.items():
        setattr(emp, key, value)
    return emp


@pytest.mark.asyncio
async def test_apply_encrypts_valid_ssn_and_sets_pending() -> None:
    emp = _emp()
    catalog = MagicMock()
    catalog.document_type_code = "SSN"
    catalog.number_format = None
    assert_type = AsyncMock(return_value=catalog)

    session = AsyncMock()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.modules.employee.national_id_identity.assert_active_national_id_document_type",
            assert_type,
        )
        await apply_national_id_identity(
            session,
            emp,
            {
                "nationality": "US",
                "nationalIdDocumentTypeId": "00000000-0000-0000-0000-000000000001",
                "nationalIdNumber": "123-45-6789",
            },
        )

    assert emp.national_id_country is None
    assert emp.national_id_document_type == "SSN"
    assert emp.national_id_last4 == "6789"
    assert emp.national_id_number_encrypted != "123-45-6789"
    # SSN is normalized (digits only) before encrypt.
    assert decrypt_field(emp.national_id_number_encrypted) == "123456789"
    assert emp.national_id_verification_status == NATIONAL_ID_VERIFICATION_PENDING
    assert assert_type.await_args.kwargs["country_code"] == "US"


@pytest.mark.asyncio
async def test_apply_uses_stored_nationality_when_body_omits_it() -> None:
    emp = _emp(nationality="IN")
    catalog = MagicMock()
    catalog.document_type_code = "AADHAAR"
    catalog.number_format = None
    assert_type = AsyncMock(return_value=catalog)

    session = AsyncMock()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.modules.employee.national_id_identity.assert_active_national_id_document_type",
            assert_type,
        )
        await apply_national_id_identity(
            session,
            emp,
            {
                "nationalIdDocumentTypeId": "00000000-0000-0000-0000-000000000001",
                "nationalIdNumber": "123412341234",
            },
        )

    assert assert_type.await_args.kwargs["country_code"] == "IN"
    assert emp.national_id_document_type == "AADHAAR"


@pytest.mark.asyncio
async def test_apply_rejects_document_type_without_nationality() -> None:
    emp = _emp(nationality=None)
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await apply_national_id_identity(
            session,
            emp,
            {
                "nationalIdDocumentTypeId": "00000000-0000-0000-0000-000000000001",
                "nationalIdNumber": "123-45-6789",
            },
        )
    assert exc.value.status_code == 400
    assert "nationality" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_apply_ignores_work_mode_and_national_id_country() -> None:
    emp = _emp(work_mode="REMOTE", location_id=None, nationality="US")
    catalog = MagicMock()
    catalog.document_type_code = "SSN"
    catalog.number_format = None
    assert_type = AsyncMock(return_value=catalog)

    session = AsyncMock()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.modules.employee.national_id_identity.assert_active_national_id_document_type",
            assert_type,
        )
        await apply_national_id_identity(
            session,
            emp,
            {
                "workMode": "REMOTE",
                "nationalIdCountry": "IN",
                "nationality": "US",
                "nationalIdDocumentTypeId": "00000000-0000-0000-0000-000000000001",
                "nationalIdNumber": "123-45-6789",
            },
        )

    assert assert_type.await_args.kwargs["country_code"] == "US"
    assert emp.national_id_country is None


@pytest.mark.asyncio
async def test_apply_rejects_invalid_ssn() -> None:
    emp = _emp()
    catalog = MagicMock()
    catalog.document_type_code = "SSN"
    catalog.number_format = None

    session = AsyncMock()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.modules.employee.national_id_identity.assert_active_national_id_document_type",
            AsyncMock(return_value=catalog),
        )
        with pytest.raises(HTTPException) as exc:
            await apply_national_id_identity(
                session,
                emp,
                {
                    "nationality": "US",
                    "nationalIdDocumentTypeId": "00000000-0000-0000-0000-000000000001",
                    "nationalIdNumber": "bad-id",
                },
            )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_apply_clears_number_when_document_type_changes() -> None:
    emp = _emp(
        national_id_document_type="PAN",
        national_id_last4="5692",
        national_id_number_encrypted="encrypted",
        national_id_verification_status=NATIONAL_ID_VERIFICATION_PENDING,
    )
    catalog = MagicMock()
    catalog.document_type_code = "AADHAAR"
    catalog.number_format = None

    session = AsyncMock()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.modules.employee.national_id_identity.assert_active_national_id_document_type",
            AsyncMock(return_value=catalog),
        )
        await apply_national_id_identity(
            session,
            emp,
            {
                "nationality": "IN",
                "nationalIdDocumentTypeId": "00000000-0000-0000-0000-000000000002",
            },
        )

    assert emp.national_id_document_type == "AADHAAR"
    assert emp.national_id_number_encrypted is None
    assert emp.national_id_last4 is None
    assert emp.national_id_verification_status is None


@pytest.mark.asyncio
async def test_apply_clears_number_and_verification() -> None:
    emp = _emp(national_id_document_type="SSN")
    catalog = MagicMock()
    catalog.document_type_code = "SSN"
    catalog.number_format = None

    session = AsyncMock()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.modules.employee.national_id_identity.assert_active_national_id_document_type",
            AsyncMock(return_value=catalog),
        )
        await apply_national_id_identity(
            session,
            emp,
            {
                "nationality": "US",
                "nationalIdDocumentTypeId": "00000000-0000-0000-0000-000000000001",
                "nationalIdNumber": "",
            },
        )

    assert emp.national_id_number_encrypted is None
    assert emp.national_id_last4 is None
    assert emp.national_id_verification_status is None
