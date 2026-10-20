import uuid
from datetime import date
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel


class LeaveRequestBody(CamelModel):
    leave_type_id: uuid.UUID = Field(..., alias="leaveTypeId")
    from_date: date = Field(..., alias="fromDate")
    to_date: date = Field(..., alias="toDate")
    half_days: list[date] = Field(default_factory=list, alias="halfDays")
    # Which half of a half day is taken; a half day without an entry here is the first half.
    half_day_parts: dict[date, Literal["first", "second"]] = Field(
        default_factory=dict, alias="halfDayParts"
    )
    reason: str | None = Field(None, max_length=500)

    @field_validator("reason", mode="before")
    @classmethod
    def _blank_reason_is_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class LeavePreviewBody(LeaveRequestBody):
    """Same shape as a submit; `excludeRequestId` skips the request being resubmitted."""

    exclude_request_id: uuid.UUID | None = Field(None, alias="excludeRequestId")
