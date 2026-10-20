"""Human-readable client / location / stakeholder display ids (CLI/LOC/STK).

Stored in DB as prefixed strings, aligned with EMP##### / PRJ#####.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

CLIENT_DISPLAY_PREFIX = "CLI"
LOCATION_DISPLAY_PREFIX = "LOC"
STAKEHOLDER_DISPLAY_PREFIX = "STK"
DISPLAY_ID_WIDTH = 5
# First allocated id uses sequence 1001 → CLI01001 (matches prior integer scheme).
DISPLAY_ID_START = 1001


def format_display_id(prefix: str, sequence: int | None) -> str | None:
    if sequence is None:
        return None
    try:
        value = int(sequence)
    except (TypeError, ValueError):
        return None
    if value < 0:
        return None
    return f"{prefix}{value:0{DISPLAY_ID_WIDTH}d}"


def format_client_display_id(sequence: int | None) -> str | None:
    return format_display_id(CLIENT_DISPLAY_PREFIX, sequence)


def format_location_display_id(sequence: int | None) -> str | None:
    return format_display_id(LOCATION_DISPLAY_PREFIX, sequence)


def format_stakeholder_display_id(sequence: int | None) -> str | None:
    return format_display_id(STAKEHOLDER_DISPLAY_PREFIX, sequence)


def normalize_display_id(raw: Any, *, prefix: str) -> str | None:
    """Return a canonical PREFIX##### id, or None."""
    sequence = parse_display_sequence(raw, prefix=prefix)
    if sequence is None:
        return None
    return format_display_id(prefix, sequence)


def parse_display_sequence(raw: Any, *, prefix: str | None = None) -> int | None:
    """Parse a display id or plain int into the numeric sequence."""
    if raw in (None, ""):
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if raw >= 0 else None
    if isinstance(raw, float) and raw.is_integer():
        return int(raw) if raw >= 0 else None
    text = str(raw).strip().upper()
    if not text:
        return None
    prefixes = (
        (prefix,)
        if prefix
        else (CLIENT_DISPLAY_PREFIX, LOCATION_DISPLAY_PREFIX, STAKEHOLDER_DISPLAY_PREFIX)
    )
    for item in prefixes:
        if item and text.startswith(item):
            text = text[len(item) :]
            break
    if text.isdigit():
        return int(text)
    return None


async def next_display_id(db: AsyncSession, column: Any, prefix: str) -> str:
    """Allocate the next PREFIX##### value from existing column values."""
    result = await db.execute(
        select(column).where(column.is_not(None), column.like(f"{prefix}%"))
    )
    max_seq = DISPLAY_ID_START - 1
    for value in result.scalars().all():
        sequence = parse_display_sequence(value, prefix=prefix)
        if sequence is not None:
            max_seq = max(max_seq, sequence)
    # Also consider legacy plain integers still present during migration.
    result_all = await db.execute(select(column).where(column.is_not(None)))
    for value in result_all.scalars().all():
        sequence = parse_display_sequence(value, prefix=prefix)
        if sequence is not None:
            max_seq = max(max_seq, sequence)
    return format_display_id(prefix, max_seq + 1) or f"{prefix}{DISPLAY_ID_START:0{DISPLAY_ID_WIDTH}d}"


def allocate_display_id(
    raw: Any,
    current: str | int | None,
    next_id: str,
    *,
    prefix: str,
) -> tuple[str, str]:
    """Keep current id, honor client-supplied id, or take next_id.

    Returns (assigned_id, next_id_for_following_rows).
    """
    if current not in (None, ""):
        normalized_current = normalize_display_id(current, prefix=prefix)
        if normalized_current:
            current_seq = parse_display_sequence(normalized_current, prefix=prefix) or 0
            next_seq = parse_display_sequence(next_id, prefix=prefix) or DISPLAY_ID_START
            following = format_display_id(prefix, max(next_seq, current_seq + 1)) or next_id
            return normalized_current, following

    supplied = normalize_display_id(raw, prefix=prefix)
    if supplied:
        supplied_seq = parse_display_sequence(supplied, prefix=prefix) or 0
        next_seq = parse_display_sequence(next_id, prefix=prefix) or DISPLAY_ID_START
        following = format_display_id(prefix, max(next_seq, supplied_seq + 1)) or next_id
        return supplied, following

    next_seq = parse_display_sequence(next_id, prefix=prefix) or DISPLAY_ID_START
    following = format_display_id(prefix, next_seq + 1) or next_id
    return next_id, following
