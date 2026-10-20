from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import get_settings

# Argon2 for new hashes; bcrypt kept so Nest / legacy rows still verify.
password_hash = PasswordHash((Argon2Hasher(), BcryptHasher()))


def hash_password(plain: str) -> str:
    return password_hash.hash(plain)


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return password_hash.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(
    payload: dict[str, Any],
    *,
    jti: str | None = None,
    expires_at: datetime | None = None,
) -> str:
    settings = get_settings()
    to_encode = dict(payload)
    expire = expires_at or (
        datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode["exp"] = expire
    to_encode["jti"] = jti or uuid4().hex
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def access_token_ttl() -> timedelta:
    return timedelta(minutes=get_settings().jwt_expire_minutes)
