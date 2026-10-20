"""Unit tests for field encryption helpers."""

from __future__ import annotations

import pytest

from app.core import field_crypto
from app.core.config import get_settings
from app.core.field_crypto import decrypt_field, encrypt_field, last4


@pytest.fixture(autouse=True)
def _clear_crypto_caches(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-for-fernet")
    get_settings.cache_clear()
    field_crypto._fernet.cache_clear()
    yield
    get_settings.cache_clear()
    field_crypto._fernet.cache_clear()


def test_encrypt_roundtrip() -> None:
    token = encrypt_field("123456789012")
    assert token is not None
    assert token != "123456789012"
    assert decrypt_field(token) == "123456789012"
    assert last4("123456789012") == "9012"


def test_last4_pads_short() -> None:
    assert last4("12") == "0012"


def test_identifier_last4_keeps_letters() -> None:
    from app.core.field_crypto import identifier_last4

    assert identifier_last4("KDHFKDHFK") == "DHFK"
    assert identifier_last4("A12345678") == "5678"
    assert identifier_last4("AB-12") == "AB12"
    assert identifier_last4("") == ""
