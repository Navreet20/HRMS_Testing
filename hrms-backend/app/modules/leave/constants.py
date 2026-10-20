"""Leave domain constants aligned with Leave Module user stories v1 Final."""

from __future__ import annotations

MASTER_STATUS_ACTIVE = "Active"
MASTER_STATUS_INACTIVE = "Inactive"

LEAVE_STATUS_PENDING = "Pending"
LEAVE_STATUS_APPROVED = "Approved"
LEAVE_STATUS_REJECTED = "Rejected"

UNPAID_LEAVE_TYPE_NAME = "Unpaid Leave"
PERSONAL_LEAVE_TYPE_NAME = "Personal Leave"

# Seeded leave types (name → description). Order matches the PDF reference table.
DEFAULT_LEAVE_TYPES: tuple[tuple[str, str], ...] = (
    (
        "Personal Leave",
        "Paid time off for planned personal use, e.g. vacation or personal matters",
    ),
    ("Sick Leave", "Absence due to the employee's own short-term illness"),
    ("Maternity Leave", "Leave for a birthing parent before and after childbirth"),
    ("Paternity Leave", "Leave for a non-birthing parent following a birth or adoption"),
    ("Medical Leave", "Extended absence for a medical condition or procedure"),
    ("Unpaid Leave", "Leave without pay; no day limit"),
)

# Earlier short names, renamed to the reference-table names on startup.
LEGACY_LEAVE_TYPE_NAMES: dict[str, str] = {
    "Personal": "Personal Leave",
    "Sick": "Sick Leave",
    "Maternity": "Maternity Leave",
    "Paternity": "Paternity Leave",
    "Medical": "Medical Leave",
    "Unpaid": "Unpaid Leave",
}
