"""Pydantic bodies for Option A weekly timesheet Draft APIs."""

from __future__ import annotations

import uuid

from pydantic import Field, field_validator

from app.schemas.common import CamelModel


class TimesheetEntryInput(CamelModel):
    work_date: str = Field(..., alias="workDate")
    hours: float = 0
    comment: str | None = None

    @field_validator("work_date")
    @classmethod
    def validate_work_date(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) < 10:
            raise ValueError("workDate must be YYYY-MM-DD")
        return trimmed[:10]

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, value: float) -> float:
        if value < 0:
            raise ValueError("hours must be non-negative")
        return float(value)

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed[:255] if trimmed else None


class TimesheetLineInput(CamelModel):
    project_code_category: str = Field(..., alias="projectCodeCategory")
    project_code: str | None = Field(None, alias="projectCode")
    activity_type: str | None = Field(None, alias="activityType")
    leave_type: str | None = Field(None, alias="leaveType")
    other_type: str | None = Field(None, alias="otherType")
    other_comment: str | None = Field(None, alias="otherComment")
    billable: bool = True
    entries: list[TimesheetEntryInput] = Field(default_factory=list)


class SaveTimesheetWeekBody(CamelModel):
    lines: list[TimesheetLineInput] = Field(default_factory=list)


class ApproveWeeksBody(CamelModel):
    timesheet_ids: list[uuid.UUID] = Field(..., alias="timesheetIds")
