"""EMP-1.1 employee_code generation: department + join year + sequence.

Format: ``{DEPT}-{YYYY}-{NNNN}`` (e.g. ``HR-2026-0001``).

Department token (never cost-center):
1. Department name — initials if multi-word (Human Resources → HR),
   else the first 6 alphanumeric characters (Delivery → DELIVE)
2. Legacy EMPLOYEE.DEPARTMENT access string
3. Fallback ``GEN``
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Employee

_NON_ALNUM = re.compile(r"[^A-Z0-9]+")
_SEQ_WIDTH = 4
_DEPT_MAX = 6


def normalize_dept_token(
    *,
    department_name: str | None = None,
    department_legacy: str | None = None,
) -> str:
    """Build a short uppercase department token for employee codes."""
    name = (department_name or "").strip().upper()
    if name:
        parts = [p for p in _NON_ALNUM.split(name) if p]
        if len(parts) >= 2:
            token = "".join(p[0] for p in parts)
        else:
            token = parts[0] if parts else ""
        token = _NON_ALNUM.sub("", token)
        if token:
            return token[:_DEPT_MAX]

    legacy = (department_legacy or "").strip().upper()
    if legacy:
        legacy = _NON_ALNUM.sub("", legacy)
        if legacy:
            return legacy[:_DEPT_MAX]

    return "GEN"


def join_year_from(employment_start_date: str | None) -> str:
    """Extract YYYY from an employment start date; fall back to current UTC year."""
    raw = (employment_start_date or "").strip()
    if len(raw) >= 4 and raw[:4].isdigit():
        year = int(raw[:4])
        if 1900 <= year <= 2100:
            return f"{year:04d}"
    return str(datetime.now(timezone.utc).year)


def format_employee_code(dept_token: str, year: str, sequence: int) -> str:
    if sequence < 1:
        raise ValueError("sequence must be >= 1")
    dept = normalize_dept_token(department_legacy=dept_token)
    return f"{dept}-{year}-{sequence:0{_SEQ_WIDTH}d}"


def next_sequence_from_codes(codes: list[str | None], prefix: str) -> int:
    """Return the next sequence number given existing codes with the same prefix."""
    max_seq = 0
    for code in codes:
        if not code or not code.startswith(prefix):
            continue
        suffix = code[len(prefix) :]
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))
    return max_seq + 1


async def allocate_employee_code(
    session: AsyncSession,
    *,
    dept_token: str,
    year: str,
) -> str:
    """Allocate the next unique ``{DEPT}-{YYYY}-{NNNN}`` code for the prefix."""
    dept = normalize_dept_token(department_legacy=dept_token)
    prefix = f"{dept}-{year}-"
    result = await session.execute(
        select(Employee.employee_code).where(Employee.employee_code.like(f"{prefix}%"))
    )
    sequence = next_sequence_from_codes(list(result.scalars().all()), prefix)
    return format_employee_code(dept, year, sequence)


_NAME_PART = re.compile(r"[^A-Z]+")


def name_based_code_stem(first_name: str, last_name: str) -> str:
    """Draft employee_code stem from names (e.g. SAT_HEG)."""
    first = _NAME_PART.sub("", (first_name or "").strip().upper())[:3] or "XXX"
    last = _NAME_PART.sub("", (last_name or "").strip().upper())[:3] or "XXX"
    return f"{first}_{last}"


async def allocate_name_based_employee_code(
    session: AsyncSession,
    *,
    first_name: str,
    last_name: str,
) -> str:
    """Unique name-based draft code; suffix -2, -3… on collision."""
    stem = name_based_code_stem(first_name, last_name)
    result = await session.execute(
        select(Employee.employee_code).where(
            (Employee.employee_code == stem)
            | (Employee.employee_code.like(f"{stem}-%"))
        )
    )
    existing = {c for c in result.scalars().all() if c}
    if stem not in existing:
        return stem
    n = 2
    while f"{stem}-{n}" in existing:
        n += 1
    return f"{stem}-{n}"


_BUSINESS_PREFIX = "EMP"
_BUSINESS_WIDTH = 5


async def allocate_business_employee_id(session: AsyncSession) -> str:
    """Final business employee id (e.g. EMP10001) when status becomes Active."""
    prefix = _BUSINESS_PREFIX
    result = await session.execute(
        select(Employee.business_employee_id).where(
            Employee.business_employee_id.is_not(None),
            Employee.business_employee_id.like(f"{prefix}%"),
        )
    )
    max_seq = 0
    for value in result.scalars().all():
        if not value or not value.startswith(prefix):
            continue
        suffix = value[len(prefix) :]
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))
    return f"{prefix}{max_seq + 1:0{_BUSINESS_WIDTH}d}"
