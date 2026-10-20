"""Workday-style worker type / schedule / category ↔ employmentType mapping."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

WORKER_TYPES = frozenset({"EMPLOYEE", "CONTRACTOR"})
WORK_SCHEDULES = frozenset({"FULL_TIME", "PART_TIME"})
EMPLOYMENT_CATEGORIES_EMPLOYEE = frozenset(
    {"REGULAR", "TEMPORARY", "INTERN", "UNPAID_INTERN"}
)
EMPLOYMENT_CATEGORIES_CONTRACTOR = frozenset({"C2C", "CONTRACT_1099"})
EMPLOYMENT_CATEGORIES = EMPLOYMENT_CATEGORIES_EMPLOYEE | EMPLOYMENT_CATEGORIES_CONTRACTOR

# Stored employmentType codes (compat with payroll / filters).
EMPLOYMENT_TYPES = frozenset(
    {
        "FULL_TIME",
        "PART_TIME",
        "TEMPORARY",
        "INTERN",
        "UNPAID_INTERN",
        "CONTRACTOR",
        "CONTRACT_1099",
    }
)


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_token(value: Any) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    return text.upper().replace(" ", "_").replace("-", "_")


def parse_employment_type_to_ui(
    employment_type: Any,
) -> dict[str, str | None]:
    """Derive UI classification fields from a legacy/stored employmentType."""
    etype = _normalize_token(employment_type) or "FULL_TIME"
    if etype == "PART_TIME":
        return {
            "workerType": "EMPLOYEE",
            "workSchedule": "PART_TIME",
            "employmentCategory": "REGULAR",
        }
    if etype == "TEMPORARY":
        return {
            "workerType": "EMPLOYEE",
            "workSchedule": "FULL_TIME",
            "employmentCategory": "TEMPORARY",
        }
    if etype == "INTERN":
        return {
            "workerType": "EMPLOYEE",
            "workSchedule": "FULL_TIME",
            "employmentCategory": "INTERN",
        }
    if etype == "UNPAID_INTERN":
        return {
            "workerType": "EMPLOYEE",
            "workSchedule": "FULL_TIME",
            "employmentCategory": "UNPAID_INTERN",
        }
    if etype == "CONTRACTOR":
        return {
            "workerType": "CONTRACTOR",
            "workSchedule": None,
            "employmentCategory": "C2C",
        }
    if etype == "CONTRACT_1099":
        return {
            "workerType": "CONTRACTOR",
            "workSchedule": None,
            "employmentCategory": "CONTRACT_1099",
        }
    # FULL_TIME and unknown → employee / full-time / regular
    return {
        "workerType": "EMPLOYEE",
        "workSchedule": "FULL_TIME",
        "employmentCategory": "REGULAR",
    }


def derive_employment_type(
    *,
    worker_type: Any,
    work_schedule: Any = None,
    employment_category: Any = None,
) -> str:
    """Map the three UI fields to a stored employmentType code."""
    wtype = _normalize_token(worker_type) or "EMPLOYEE"
    category = _normalize_token(employment_category)
    schedule = _normalize_token(work_schedule)

    if wtype == "CONTRACTOR":
        if category == "CONTRACT_1099":
            return "CONTRACT_1099"
        return "CONTRACTOR"

    if category == "TEMPORARY":
        return "TEMPORARY"
    if category == "INTERN":
        return "INTERN"
    if category == "UNPAID_INTERN":
        return "UNPAID_INTERN"
    if schedule == "PART_TIME":
        return "PART_TIME"
    return "FULL_TIME"


def _require_enum(value: Any, *, field: str, allowed: frozenset[str]) -> str:
    normalized = _normalize_token(value)
    if normalized is None or normalized not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field}; allowed: {', '.join(sorted(allowed))}",
        )
    return normalized


def normalize_employment_classification(body: dict[str, Any]) -> None:
    """Normalize and sync classification fields + derived employmentType in-place.

    Accepts either the three UI fields and/or legacy ``employmentType``. Prefer
    explicit classification fields when present; otherwise parse from type.
    """
    has_worker = "workerType" in body
    has_schedule = "workSchedule" in body
    has_category = "employmentCategory" in body
    has_type = "employmentType" in body
    if not (has_worker or has_schedule or has_category or has_type):
        return

    if has_worker or has_schedule or has_category:
        worker_raw = body.get("workerType")
        if worker_raw is None and has_type:
            parsed = parse_employment_type_to_ui(body.get("employmentType"))
            worker = str(parsed["workerType"])
        elif worker_raw is None:
            worker = "EMPLOYEE"
        else:
            worker = _require_enum(
                worker_raw, field="workerType", allowed=WORKER_TYPES
            )

        if worker == "CONTRACTOR":
            category_raw = body.get("employmentCategory")
            if category_raw is None and has_type:
                parsed = parse_employment_type_to_ui(body.get("employmentType"))
                category = str(parsed["employmentCategory"] or "C2C")
            elif category_raw is None:
                category = "C2C"
            else:
                category = _require_enum(
                    category_raw,
                    field="employmentCategory",
                    allowed=EMPLOYMENT_CATEGORIES_CONTRACTOR,
                )
            body["workerType"] = worker
            body["workSchedule"] = None
            body["employmentCategory"] = category
            body["employmentType"] = derive_employment_type(
                worker_type=worker,
                work_schedule=None,
                employment_category=category,
            )
            return

        category_raw = body.get("employmentCategory")
        if category_raw is None and has_type:
            parsed = parse_employment_type_to_ui(body.get("employmentType"))
            category = str(parsed["employmentCategory"] or "REGULAR")
        elif category_raw is None:
            category = "REGULAR"
        else:
            category = _require_enum(
                category_raw,
                field="employmentCategory",
                allowed=EMPLOYMENT_CATEGORIES_EMPLOYEE,
            )

        schedule_raw = body.get("workSchedule")
        if schedule_raw is None and has_type:
            parsed = parse_employment_type_to_ui(body.get("employmentType"))
            schedule = str(parsed["workSchedule"] or "FULL_TIME")
        elif schedule_raw is None:
            schedule = "FULL_TIME"
        else:
            schedule = _require_enum(
                schedule_raw, field="workSchedule", allowed=WORK_SCHEDULES
            )

        body["workerType"] = worker
        body["workSchedule"] = schedule
        body["employmentCategory"] = category
        body["employmentType"] = derive_employment_type(
            worker_type=worker,
            work_schedule=schedule,
            employment_category=category,
        )
        return

    # employmentType only — validate and backfill UI fields
    etype = _require_enum(
        body.get("employmentType"),
        field="employmentType",
        allowed=EMPLOYMENT_TYPES,
    )
    parsed = parse_employment_type_to_ui(etype)
    body["employmentType"] = etype
    body["workerType"] = parsed["workerType"]
    body["workSchedule"] = parsed["workSchedule"]
    body["employmentCategory"] = parsed["employmentCategory"]


def classification_fields_from_employee(emp: Any) -> dict[str, str | None]:
    """Serialize classification fields, filling gaps from employmentType."""
    worker = _normalize_token(getattr(emp, "worker_type", None))
    schedule = _normalize_token(getattr(emp, "work_schedule", None))
    category = _normalize_token(getattr(emp, "employment_category", None))
    etype = getattr(emp, "employment_type", None)
    if worker and category and (schedule is not None or worker == "CONTRACTOR"):
        if worker == "CONTRACTOR":
            schedule = None
        return {
            "workerType": worker,
            "workSchedule": schedule,
            "employmentCategory": category,
        }
    parsed = parse_employment_type_to_ui(etype)
    return {
        "workerType": worker or parsed["workerType"],
        "workSchedule": (
            None
            if (worker or parsed["workerType"]) == "CONTRACTOR"
            else (schedule or parsed["workSchedule"])
        ),
        "employmentCategory": category or parsed["employmentCategory"],
    }


def apply_employment_classification(emp: Any, body: dict[str, Any]) -> None:
    """Write classification + employmentType onto an Employee ORM row."""
    if not any(
        key in body
        for key in (
            "workerType",
            "workSchedule",
            "employmentCategory",
            "employmentType",
        )
    ):
        return
    normalize_employment_classification(body)
    emp.employment_type = body["employmentType"]
    emp.worker_type = body.get("workerType")
    emp.work_schedule = body.get("workSchedule")
    emp.employment_category = body.get("employmentCategory")
