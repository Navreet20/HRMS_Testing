"""New-schema timesheet tables (timesheets / timesheet_items / timesheet_day_entries)."""

from app.models.tables import TimesheetEntry, TimesheetHeader, TimesheetLine


def _column_names(model: type) -> set[str]:
    return {column.name for column in model.__table__.columns}


def test_timesheet_header_has_portal_columns() -> None:
    cols = _column_names(TimesheetHeader)
    assert TimesheetHeader.__tablename__ == "timesheets"
    assert {
        "id",
        "employee_id",
        "week_start_date",
        "status",
        "submitted_at",
        "decided_by_employee_id",
        "decided_at",
        "rejection_comment",
    }.issubset(cols)
    assert "week_end_date" not in cols
    assert "reopened_from_approved" not in cols


def test_timesheet_line_has_option_b_columns() -> None:
    cols = _column_names(TimesheetLine)
    assert TimesheetLine.__tablename__ == "timesheet_items"
    assert {
        "id",
        "timesheet_id",
        "category",
        "project_id",
        "activity_type",
        "leave_type_id",
        "other_type",
        "other_comment",
        "billable",
        "sort_order",
    }.issubset(cols)
    assert "project_code" not in cols
    assert "leave_type" not in cols


def test_timesheet_entry_has_portal_columns() -> None:
    cols = _column_names(TimesheetEntry)
    assert TimesheetEntry.__tablename__ == "timesheet_day_entries"
    assert {
        "id",
        "timesheet_item_id",
        "work_date",
        "hours",
        "comment",
    }.issubset(cols)


def test_timesheet_header_unique_employee_week() -> None:
    names = {constraint.name for constraint in TimesheetHeader.__table__.constraints}
    assert "uq_timesheets_employee_week" in names


def test_timesheet_entry_unique_item_date() -> None:
    names = {constraint.name for constraint in TimesheetEntry.__table__.constraints}
    assert "uq_timesheet_day_entries_item_date" in names
