"""CSV import/export helpers for employees (Excel-compatible)."""

from __future__ import annotations

import csv
import io
from typing import Any

# Columns used for template, export, and import. Excel can open/save this CSV.
CSV_COLUMNS: tuple[str, ...] = (
    "firstName",
    "lastName",
    "emailId",
    "department",
    "company",
    "employmentType",
    "role",
    "employmentStartDate",
    "jobRank",
    "vendor",
    "phoneNumber",
    "employeeCode",
)

REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {"firstName", "lastName", "emailId", "department"}
)

_HEADER_ALIASES: dict[str, str] = {
    "firstname": "firstName",
    "first_name": "firstName",
    "lastname": "lastName",
    "last_name": "lastName",
    "email": "emailId",
    "emailid": "emailId",
    "email_id": "emailId",
    "workemail": "emailId",
    "work_email": "emailId",
    "employmenttype": "employmentType",
    "employment_type": "employmentType",
    "employmentstartdate": "employmentStartDate",
    "employment_start_date": "employmentStartDate",
    "startdate": "employmentStartDate",
    "start_date": "employmentStartDate",
    "jobrank": "jobRank",
    "job_rank": "jobRank",
    "phonenumber": "phoneNumber",
    "phone": "phoneNumber",
    "phone_number": "phoneNumber",
    "employeecode": "employeeCode",
    "employee_code": "employeeCode",
}


def _normalize_header(raw: str) -> str:
    key = (raw or "").strip()
    if not key:
        return ""
    lowered = key.lower().replace(" ", "")
    if key in CSV_COLUMNS:
        return key
    return _HEADER_ALIASES.get(lowered, key)


def build_template_csv() -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(CSV_COLUMNS), lineterminator="\n")
    writer.writeheader()
    writer.writerow(
        {
            "firstName": "Ada",
            "lastName": "Lovelace",
            "emailId": "ada.lovelace@example.com",
            "department": "Engineering",
            "company": "Default",
            "employmentType": "FULL_TIME",
            "role": "EMPLOYEE",
            "employmentStartDate": "2026-01-15",
            "jobRank": "RANK_7",
            "vendor": "",
            "phoneNumber": "",
            "employeeCode": "",
        }
    )
    return buffer.getvalue().encode("utf-8-sig")


def employees_to_csv(rows: list[dict[str, Any]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(CSV_COLUMNS), lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({col: row.get(col) or "" for col in CSV_COLUMNS})
    return buffer.getvalue().encode("utf-8-sig")


def parse_employee_csv(data: bytes) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    """Return (valid_row_dicts, parse_errors). Row numbers are 1-based data rows."""
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], [{"row": 0, "message": "CSV has no header row"}]

    field_map = {_normalize_header(name): name for name in reader.fieldnames if name}
    missing = sorted(REQUIRED_COLUMNS - set(field_map))
    if missing:
        return [], [
            {
                "row": 0,
                "message": f"Missing required column(s): {', '.join(missing)}",
            }
        ]

    rows: list[dict[str, str]] = []
    errors: list[dict[str, Any]] = []
    for index, raw in enumerate(reader, start=2):
        mapped: dict[str, str] = {}
        for canonical, original in field_map.items():
            if canonical not in CSV_COLUMNS:
                continue
            value = raw.get(original)
            mapped[canonical] = (value or "").strip()

        if not any(mapped.values()):
            continue

        row_errors: list[str] = []
        for col in REQUIRED_COLUMNS:
            if not mapped.get(col):
                row_errors.append(f"{col} is required")
        email = mapped.get("emailId", "")
        if email and "@" not in email:
            row_errors.append("emailId must be a valid email")

        if row_errors:
            errors.append({"row": index, "message": "; ".join(row_errors), "emailId": email})
            continue

        rows.append(mapped)

    return rows, errors
