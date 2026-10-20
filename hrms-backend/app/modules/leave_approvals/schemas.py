from pydantic import Field, field_validator

from app.schemas.common import CamelModel


class LeaveRejectBody(CamelModel):
    reason: str = Field(..., min_length=1, max_length=255)

    @field_validator("reason", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
