from decimal import Decimal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel


class PolicyLineCreate(CamelModel):
    leave_type_id: str = Field(..., alias="leaveTypeId", min_length=1)
    days_allowed: Decimal = Field(..., alias="daysAllowed")
    rollover_allowed: bool = Field(False, alias="rolloverAllowed")
    max_rollover_days: Decimal | None = Field(None, alias="maxRolloverDays")


class LeavePolicyCreateBody(CamelModel):
    policy_name: str = Field(..., alias="policyName", min_length=1, max_length=100)
    policy_start_year: int = Field(..., alias="policyStartYear", ge=2000, le=2100)
    policy_end_year: int = Field(..., alias="policyEndYear", ge=2000, le=2100)
    lines: list[PolicyLineCreate] = Field(default_factory=list)

    @field_validator("policy_name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PolicyLineDaysUpdate(CamelModel):
    policy_line_id: str = Field(..., alias="policyLineId", min_length=1)
    days_allowed: Decimal = Field(..., alias="daysAllowed")


class LeavePolicyDaysUpdateBody(CamelModel):
    lines: list[PolicyLineDaysUpdate] = Field(default_factory=list)


class LeavePolicyStatusBody(CamelModel):
    status: str = Field(..., min_length=1, max_length=10)

    @field_validator("status", mode="before")
    @classmethod
    def _strip_status(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
