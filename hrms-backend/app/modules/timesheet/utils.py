import re
from datetime import datetime

from fastapi import HTTPException

DATE_ONLY_PATTERN = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
HOURS_PATTERN = re.compile(r"^\d+(\.\d{1,2})?$")

WEEKDAY_HOUR_LIMIT = 8
SATURDAY_HOUR_LIMIT = 24
SUNDAY_HOUR_LIMIT = 24
WEEKEND_TOTAL_HOUR_LIMIT = 48


def cleared_decision_fields() -> dict:
    return {
        "last_decision_stage": None,
        "last_decision_comments": None,
        "last_decision_at": None,
        "last_decision_by": None,
    }


def decision_fields(stage: str, comments: str, actor_name: str, at: datetime | None = None) -> dict:
    return {
        "last_decision_stage": stage,
        "last_decision_comments": comments,
        "last_decision_at": at or datetime.utcnow(),
        "last_decision_by": actor_name,
    }


def actor_display_name(user: dict) -> str:
    return f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()


def to_date_only(value: str | datetime) -> str:
    if isinstance(value, str):
        trimmed = value.strip()
        match = DATE_ONLY_PATTERN.match(trimmed[:10])
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
        raise HTTPException(status_code=400, detail=f"Invalid date: {trimmed}")
    return value.strftime("%Y-%m-%d")


def get_local_weekday(date_only: str) -> int:
    match = DATE_ONLY_PATTERN.match(date_only)
    if not match:
        raise HTTPException(status_code=400, detail=f"Invalid date-only value: {date_only}")
    y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
    return datetime(y, m, d).weekday()  # Mon=0 ... Sun=6 -> convert: Python weekday Mon=0, Sun=6


def parse_hours_worked(raw: str | float) -> float:
    if isinstance(raw, (int, float)):
        n = float(raw)
    else:
        trimmed = str(raw).strip()
        if not HOURS_PATTERN.match(trimmed):
            raise HTTPException(status_code=400, detail="hoursWorked must be a non-negative number with at most 2 decimal places")
        n = float(trimmed)
    if n < 0:
        raise HTTPException(status_code=400, detail="hoursWorked must be non-negative")
    return n


def validate_hours_policy(entries: list[dict]) -> None:
    errors: list[str] = []
    weekend_total = 0.0
    for entry in entries:
        date_only = to_date_only(entry["date"])
        hours = parse_hours_worked(entry["hoursWorked"])
        weekday = get_local_weekday(date_only)
        # Python: Mon=0..Sun=6; Nest uses getDay() Sun=0..Sat=6
        nest_weekday = (weekday + 1) % 7
        if 1 <= nest_weekday <= 5 and hours > WEEKDAY_HOUR_LIMIT:
            errors.append(f"{date_only}: exceeds weekday limit ({WEEKDAY_HOUR_LIMIT})")
        elif nest_weekday == 6 and hours > SATURDAY_HOUR_LIMIT:
            errors.append(f"{date_only}: exceeds Saturday limit ({SATURDAY_HOUR_LIMIT})")
        elif nest_weekday == 0 and hours > SUNDAY_HOUR_LIMIT:
            errors.append(f"{date_only}: exceeds Sunday limit ({SUNDAY_HOUR_LIMIT})")
        if nest_weekday in (0, 6):
            weekend_total += hours
    if weekend_total > WEEKEND_TOTAL_HOUR_LIMIT:
        errors.append(f"Combined weekend hours {weekend_total} exceed limit ({WEEKEND_TOTAL_HOUR_LIMIT})")
    if errors:
        raise HTTPException(status_code=400, detail={"message": "Hour validation failed", "errors": errors})
