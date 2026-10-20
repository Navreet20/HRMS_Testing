from __future__ import annotations

import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

BILLING_TYPES = ("Per HR", "Fixed Bid", "Monthly", "Per-day rate")
PROJECT_STATUSES = ("ACTIVE", "ON_HOLD", "CLOSED")
PROJECT_REGIONS = ("NA", "EMEA", "APAC", "LATAM")
STAKEHOLDER_ROLES = ("PROJECT_MANAGER", "ACCOUNT_OWNER")
PROJECT_CODE_RE = re.compile(r"^[A-Za-z0-9]{0,8}$")
END_CUSTOMER_MAX = 100

# Master list for project classification dropdowns (served via GET /projects/meta).
# Keep values <= 30 chars to match PROJECTS.PROJECT_TYPE.
PROJECT_TYPES = (
    "Development",
    "Testing",
    "Consulting",
    "Implementation",
    "Support",
    "Staff Augmentation",
    "Managed Services",
    "Professional Services",
    "Training",
    "R&D",
    "Migration",
    "Integration",
    "Infrastructure",
    "Quality Assurance",
    "PMO",
    "Change Management",
    "Product",
)
# Legacy labels accepted on write and normalized to the canonical value.
PROJECT_TYPE_ALIASES = {
    "Developer": "Development",
    "Development": "Development",
    "QA": "Quality Assurance",
    "Research & Development": "R&D",
}

STAKEHOLDER_NAME_MAX = 100
STAKEHOLDER_TITLE_MAX = 100
STAKEHOLDER_DEPARTMENT_MAX = 100
STAKEHOLDER_EMAIL_MAX = 100
STAKEHOLDER_PHONE_MAX = 40
STAKEHOLDER_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


class ProjectClientStakeholderBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: uuid.UUID | None = None
    name: str
    title: str | None = None
    department: str | None = None
    email: str | None = None
    phone_number: str | None = Field(None, alias="phoneNumber")

    @field_validator("name", "title", "department", "email", "phone_number")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_fields(self) -> ProjectClientStakeholderBody:
        if not self.name:
            raise ValueError("Stakeholder name is required")
        if len(self.name) > STAKEHOLDER_NAME_MAX:
            raise ValueError(
                f"Stakeholder name must be at most {STAKEHOLDER_NAME_MAX} characters"
            )
        if self.title and len(self.title) > STAKEHOLDER_TITLE_MAX:
            raise ValueError(
                f"Stakeholder title must be at most {STAKEHOLDER_TITLE_MAX} characters"
            )
        if self.department and len(self.department) > STAKEHOLDER_DEPARTMENT_MAX:
            raise ValueError(
                f"Stakeholder department must be at most {STAKEHOLDER_DEPARTMENT_MAX} characters"
            )
        if self.email:
            if len(self.email) > STAKEHOLDER_EMAIL_MAX or not STAKEHOLDER_EMAIL_RE.fullmatch(
                self.email
            ):
                raise ValueError("Enter a valid stakeholder email")
        if self.phone_number and len(self.phone_number) > STAKEHOLDER_PHONE_MAX:
            raise ValueError(
                f"Stakeholder phone must be at most {STAKEHOLDER_PHONE_MAX} characters"
            )
        return self


class ProjectWriteBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    client_id: uuid.UUID | None = Field(None, alias="clientId")
    project_name: str | None = Field(None, alias="projectName")
    project_type: str | None = Field(None, alias="projectType")
    project_code: str | None = Field(None, alias="projectCode")
    region: str | None = None
    project_startdate: str | None = Field(None, alias="projectStartdate")
    project_enddate: str | None = Field(None, alias="projectEnddate")
    planned_end_date: str | None = Field(None, alias="plannedEndDate")
    actual_end_date: str | None = Field(None, alias="actualEndDate")
    billing_type: str | None = Field(None, alias="billingType")
    status: str | None = None
    invoice_period: str | None = Field(None, alias="invoicePeriod")
    end_client_name: str | None = Field(None, alias="endClientName")
    description: str | None = None
    project_manager_ids: list[uuid.UUID] = Field(default_factory=list, alias="projectManagerIds")
    account_owner_ids: list[uuid.UUID] = Field(default_factory=list, alias="accountOwnerIds")
    client_stakeholders: list[ProjectClientStakeholderBody] = Field(
        default_factory=list, alias="clientStakeholders"
    )

    @field_validator("project_name")
    @classmethod
    def trim_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("description")
    @classmethod
    def trim_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("end_client_name")
    @classmethod
    def trim_end_client_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if len(cleaned) > END_CUSTOMER_MAX:
            raise ValueError(f"End customer must be at most {END_CUSTOMER_MAX} characters")
        return cleaned or None

    @field_validator("project_code")
    @classmethod
    def validate_code(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        cleaned = value.strip()
        if not PROJECT_CODE_RE.fullmatch(cleaned):
            raise ValueError("Project code must be at most 8 alphanumeric characters")
        return cleaned.upper()

    @field_validator("project_type")
    @classmethod
    def validate_project_type(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        normalized = PROJECT_TYPE_ALIASES.get(cleaned, cleaned)
        if normalized not in PROJECT_TYPES:
            raise ValueError(
                f"projectType must be one of: {', '.join(PROJECT_TYPES)}"
            )
        if len(normalized) > 30:
            raise ValueError("projectType must be at most 30 characters")
        return normalized

    @field_validator("billing_type")
    @classmethod
    def validate_billing(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in BILLING_TYPES:
            raise ValueError(
                f"billingType must be one of: {', '.join(BILLING_TYPES)}"
            )
        return value

    @field_validator("region")
    @classmethod
    def validate_region(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if cleaned not in PROJECT_REGIONS:
            raise ValueError("Region must be NA, EMEA, APAC, or LATAM.")
        return cleaned

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        normalized = value.strip().upper().replace(" ", "_")
        if normalized == "INACTIVE":
            return "CLOSED"
        if normalized == "ONHOLD":
            return "ON_HOLD"
        if normalized not in PROJECT_STATUSES:
            raise ValueError("status must be ACTIVE, ON_HOLD, or CLOSED")
        return normalized

    @model_validator(mode="after")
    def validate_dates(self) -> ProjectWriteBody:
        planned = self.planned_end_date or self.project_enddate
        start = self.project_startdate
        if start and planned and planned <= start:
            raise ValueError("Planned end date must be after start date")
        if start and self.actual_end_date and self.actual_end_date <= start:
            raise ValueError("Actual end date must be after start date")
        return self

    def resolved_planned_end(self) -> str | None:
        return self.planned_end_date or self.project_enddate


class ProjectStakeholderOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    employee_id: str = Field(alias="employeeId")
    display_name: str = Field(alias="displayName")
    role: Literal["PROJECT_MANAGER", "ACCOUNT_OWNER"]


class AllocationWriteBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    allocation_id: uuid.UUID | None = Field(None, alias="allocationId")
    employee_id: uuid.UUID = Field(alias="employeeId")
    role_on_project: str = Field(alias="roleOnProject")
    allocation_percentage: float = Field(alias="allocationPercentage")
    start_date: str = Field(alias="startDate")
    end_date: str | None = Field(None, alias="endDate")
    billable: bool = False
    billability_percentage: float | None = Field(None, alias="billabilityPercentage")
    client_location_id: str | None = Field(None, alias="clientLocationId")
    work_location_id: str | None = Field(None, alias="workLocationId")
    work_location_kind: str | None = Field(None, alias="workLocationKind")

    @field_validator("role_on_project")
    @classmethod
    def trim_role(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("roleOnProject is required")
        if len(cleaned) > 50:
            raise ValueError("roleOnProject must be at most 50 characters")
        return cleaned

    @field_validator("start_date", mode="before")
    @classmethod
    def require_start_date(cls, value: object) -> str:
        if value is None:
            raise ValueError("startDate is required")
        cleaned = str(value).strip()
        if not cleaned:
            raise ValueError("startDate is required")
        return cleaned

    @field_validator("end_date")
    @classmethod
    def trim_end_date(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("client_location_id", "work_location_id")
    @classmethod
    def trim_location(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("work_location_kind")
    @classmethod
    def normalize_work_location_kind(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().upper()
        if not cleaned:
            return None
        if cleaned not in {"OFFICE", "RESIDENTIAL"}:
            raise ValueError("workLocationKind must be OFFICE or RESIDENTIAL")
        return cleaned

    @model_validator(mode="after")
    def validate_allocation_rules(self) -> AllocationWriteBody:
        if self.allocation_percentage < 0.01 or self.allocation_percentage > 100:
            raise ValueError("allocationPercentage must be between 0.01 and 100")
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("endDate must be on or after startDate")
        if self.billable:
            if self.billability_percentage is None:
                raise ValueError("billabilityPercentage is required when billable is true")
            if self.billability_percentage < 0.01 or self.billability_percentage > 100:
                raise ValueError("billabilityPercentage must be between 0.01 and 100")
            if self.billability_percentage > self.allocation_percentage:
                raise ValueError(
                    "billabilityPercentage must be less than or equal to allocationPercentage"
                )
        else:
            self.billability_percentage = None
        return self


class AllocationBatchBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    allocations: list[AllocationWriteBody] = Field(default_factory=list)


class AllocationEndBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    end_date: str = Field(alias="endDate")

    @field_validator("end_date")
    @classmethod
    def require_end_date(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("endDate is required")
        return cleaned
