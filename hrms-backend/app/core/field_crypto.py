"""Fernet encryption for account numbers and document numbers at rest."""

from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache
def _fernet() -> Fernet:
    settings = get_settings()
    secret = settings.field_encryption_key or settings.jwt_secret
    return Fernet(_derive_fernet_key(secret))


def encrypt_field(plain: str | None) -> str | None:
    if plain is None or plain == "":
        return None
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_field(token: str | None) -> str | None:
    if token is None or token == "":
        return None
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt field") from exc


def last4(account_number: str) -> str:
    """Last 4 digits — for bank / numeric account numbers (zero-padded if short)."""
    digits = "".join(ch for ch in account_number if ch.isdigit())
    if len(digits) < 4:
        return (digits or "0000").rjust(4, "0")[-4:]
    return digits[-4:]


def identifier_last4(value: str) -> str:
    """Last 4 alphanumeric characters — passports, licenses, national IDs.

    Corporate HRMS portals mask by trailing characters (letters or digits),
    not digits-only. Empty input returns \"\".
    """
    chars = "".join(ch for ch in value if ch.isalnum())
    if not chars:
        return ""
    return chars[-4:]
