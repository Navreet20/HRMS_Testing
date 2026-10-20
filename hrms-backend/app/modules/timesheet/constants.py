"""Day-0 frozen Option A values for timesheet weeks (v12)."""

from __future__ import annotations

from decimal import Decimal

TIMESHEET_STATUS_DRAFT = "Draft"
TIMESHEET_STATUS_SUBMITTED = "Submitted"
TIMESHEET_STATUS_APPROVED = "Approved"
TIMESHEET_STATUS_REJECTED = "Rejected"

TIMESHEET_STATUSES: frozenset[str] = frozenset(
    {
        TIMESHEET_STATUS_DRAFT,
        TIMESHEET_STATUS_SUBMITTED,
        TIMESHEET_STATUS_APPROVED,
        TIMESHEET_STATUS_REJECTED,
    }
)

# TS-DATA-5 — employee may edit rows, then submit, from these statuses.
# Recall returns Submitted → Draft, so Recalled is covered by Draft.
TIMESHEET_EDITABLE_STATUSES: frozenset[str] = frozenset(
    {TIMESHEET_STATUS_DRAFT, TIMESHEET_STATUS_REJECTED}
)

PROJECT_CODE_CATEGORY_ALLOCATED = "Allocated Projects"
PROJECT_CODE_CATEGORY_INTERNAL = "Internal Project Codes"
PROJECT_CODE_CATEGORY_ON_LEAVE = "On Leave"
PROJECT_CODE_CATEGORY_OTHER = "Other"

PROJECT_CODE_CATEGORIES: frozenset[str] = frozenset(
    {
        PROJECT_CODE_CATEGORY_ALLOCATED,
        PROJECT_CODE_CATEGORY_INTERNAL,
        PROJECT_CODE_CATEGORY_ON_LEAVE,
        PROJECT_CODE_CATEGORY_OTHER,
    }
)

# Internal codes come from PROJECTS whose client is internal (CLIENT.IS_INTERNAL)
# or whose PROJECT_TYPE is Internal. There is no timesheet-only code table.

# API allows "Other" (legacy UI); DB check constraint uses "Custom".
OTHER_TYPES: tuple[str, ...] = (
    "Research",
    "Learning",
    "Conference",
    "Client Meeting",
    "Other",
    "Custom",
)

# Product activity list until an org activity catalog exists.
ACTIVITY_TYPES: tuple[str, ...] = (
    "Development",
    "Testing",
    "Documentation",
)

# Fallback only if LEAVE_TYPE table is empty (boot before seed).
# Live options come from Active LeaveType rows (LEAVE-DATA-1).
TIMESHEET_LEAVE_TYPES: tuple[str, ...] = (
    "Personal Leave",
    "Sick Leave",
    "Maternity Leave",
    "Paternity Leave",
    "Medical Leave",
    "Unpaid Leave",
)

# Day total cap across all lines for a single work date.
HOURS_MAX_PER_DAY = Decimal("24.00")

# Catch-all sub-option that requires other_comment (API "Other" or DB "Custom").
OTHER_TYPE_CATCH_ALL = "Other"
OTHER_TYPE_CATCH_ALL_DB = "Custom"


# Most rows (work items) one week can have. A week already saved with more can still be
# edited, but no row can be added beyond this.
MAX_TIMESHEET_LINES = 7
