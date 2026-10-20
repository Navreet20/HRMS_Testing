from datetime import date

from pydantic import Field, field_validator

from app.schemas.common import CamelModel

HOLIDAY_TYPES = (
    "Federal Holiday",
    "Observed Holiday",
    "Company Holiday",
    "Religious / Cultural Holiday",
    "State / Regional Holiday",
    "Other",
)


class HolidayBody(CamelModel):
    holiday_year: int = Field(..., alias="holidayYear")
    holiday_name: str = Field(..., alias="holidayName", min_length=1, max_length=100)
    holiday_type: str = Field(..., alias="holidayType", min_length=1, max_length=50)
    holiday_date: date = Field(..., alias="holidayDate")

    @field_validator("holiday_name", "holiday_type", mode="before")
    @classmethod
    def _strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("holiday_type")
    @classmethod
    def _known_type(cls, value: str) -> str:
        if value not in HOLIDAY_TYPES:
            raise ValueError("holidayType must be one of: " + ", ".join(HOLIDAY_TYPES))
        return value
