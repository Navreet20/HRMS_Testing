"""Column types that translate between the legacy (API / service) vocabulary and the new schema's CHECK values.

The old services speak UPPERCASE codes (``ACTIVE``, ``FULL_TIME``, ``EMPLOYEE``); the 37-table schema stores
title-case values (``Active``, ``Full-time``, ``Employee``). ``CodeMap`` converts in both directions at the SQLAlchemy
boundary, so service code, filters and JSON keep the old vocabulary while the database only ever holds values the
CHECK constraints accept. The DDL is unchanged (impl is a plain String).

* writes: the legacy value (any case, spaces / dashes / underscores equivalent) is mapped to the stored value. A value
  with no mapping is passed through unchanged so the CHECK constraint (not this layer) rejects it.
* reads: the stored value is mapped back to the legacy code; unmapped values are upper-cased.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


def _token(value: Any) -> str:
    return str(value).strip().upper().replace(" ", "_").replace("-", "_")


class CodeMap(TypeDecorator):
    impl = String
    cache_ok = True

    def __init__(self, length: int, to_db: dict[str, str], from_db: dict[str, str] | None = None) -> None:
        super().__init__(length)
        self._to_db = {_token(k): v for k, v in to_db.items()}
        # Reverse map: explicit if given, else first legacy key wins per stored value.
        reverse = {_token(k): v for k, v in (from_db or {}).items()}
        for legacy, stored in self._to_db.items():
            reverse.setdefault(_token(stored), legacy)
        self._from_db = reverse
        self._key = (length, tuple(sorted(self._to_db.items())), tuple(sorted(self._from_db.items())))

    @property
    def cache_key_tuple(self):  # pragma: no cover - cache key helper
        return self._key

    def _get_cache_key_extra(self):  # type: ignore[no-untyped-def]
        return self._key

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return self._to_db.get(_token(value), value)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return self._from_db.get(_token(value), str(value).upper())


# employees.status: Draft is the app's NEW. 'New' (stored) also reads back as NEW.
EMPLOYEE_STATUS_TO_DB = {
    "NEW": "Draft", "DRAFT": "Draft", "PENDING": "Pending", "ACTIVE": "Active", "INACTIVE": "Inactive",
    "SUSPENDED": "Inactive", "EXITED": "Inactive", "REJECTED": "Inactive", "TERMINATED": "Inactive",
    "RESIGNED": "Inactive", "ERROR": "Inactive",
}
EMPLOYEE_STATUS_FROM_DB = {"Draft": "NEW", "New": "NEW", "Pending": "PENDING", "Active": "ACTIVE", "Inactive": "INACTIVE"}

# employees.role: the old access roles. Roles with no counterpart collapse onto the closest stored one.
EMPLOYEE_ROLE_TO_DB = {
    "EMPLOYEE": "Employee", "MANAGER": "Manager", "HR": "HR", "ADMIN": "Admin", "SUPERADMIN": "Admin",
    "IMMIGRATION": "HR", "ACCOUNTANT": "Employee", "ONBOARDING": "HR", "MARKETING": "Employee",
}
EMPLOYEE_ROLE_FROM_DB = {"Employee": "EMPLOYEE", "Manager": "MANAGER", "HR": "HR", "Admin": "ADMIN"}

# employees.employment_type
EMPLOYMENT_TYPE_TO_DB = {
    "FULL_TIME": "Full-time", "PART_TIME": "Part-time", "TEMPORARY": "Contract", "INTERN": "Intern",
    "UNPAID_INTERN": "Intern", "CONTRACTOR": "Contract", "CONTRACT_1099": "Contract",
}
EMPLOYMENT_TYPE_FROM_DB = {
    "Full-time": "FULL_TIME", "Part-time": "PART_TIME", "Contract": "CONTRACTOR", "Intern": "INTERN",
}

# employees.work_mode
WORK_MODE_TO_DB = {"ONSITE": "Onsite", "ON_SITE": "Onsite", "REMOTE": "Remote", "HYBRID": "Hybrid"}
WORK_MODE_FROM_DB = {"Onsite": "ONSITE", "Remote": "REMOTE", "Hybrid": "HYBRID"}
