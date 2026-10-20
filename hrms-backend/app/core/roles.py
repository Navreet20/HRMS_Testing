from enum import StrEnum
from typing import Any


class Role(StrEnum):
    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    HR = "HR"
    EMPLOYEE = "EMPLOYEE"
    IMMIGRATION = "IMMIGRATION"
    ACCOUNTANT = "ACCOUNTANT"
    ONBOARDING = "ONBOARDING"
    MARKETING = "MARKETING"


def normalize_role_key(value: str) -> str:
    """Normalize a role/department claim to uppercase."""
    return value.strip().upper()


_VALID_ROLE_VALUES = frozenset(member.value for member in Role)


def _normalized_claim_keys(value: Any) -> list[str]:
    if isinstance(value, Role):
        return [value.value]
    if isinstance(value, str):
        text = value.strip()
        return [normalize_role_key(text)] if text else []
    if isinstance(value, list):
        keys: list[str] = []
        for item in value:
            keys.extend(_normalized_claim_keys(item))
        return keys
    return []


def session_access_role(user: dict[str, Any] | None) -> str | None:
    """JWT permission bucket: valid ``role`` first, else ``department``.

    Empty, whitespace, and ``None`` role are unset. A role that is not a
    :class:`Role` member also falls back to department so legacy JWTs still
    authorize. JWT continues to send both claims; this only chooses the reader.
    """
    if not user:
        return None
    for key in _normalized_claim_keys(user.get("role")):
        if key in _VALID_ROLE_VALUES:
            return key
    dept_keys = _normalized_claim_keys(user.get("department"))
    return dept_keys[0] if dept_keys else None


def session_access_roles(user: dict[str, Any] | None) -> set[str]:
    """Permission keys from dual-read (valid role first, else department list)."""
    if not user:
        return set()
    valid_roles = {
        key
        for key in _normalized_claim_keys(user.get("role"))
        if key in _VALID_ROLE_VALUES
    }
    if valid_roles:
        return valid_roles
    return set(_normalized_claim_keys(user.get("department")))


class Status(StrEnum):
    NEW = "NEW"
    SUCCESS = "SUCCESS"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    TERMINATED = "TERMINATED"
    RESIGNED = "RESIGNED"
    SUSPENDED = "SUSPENDED"
    EXITED = "EXITED"
    ERROR = "ERROR"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
