"""Facade: ``from app.models.tables import X`` against the 37-table snake_case schema.

Re-exports real models and a few name aliases used by the live app services.
No compat_* stubs, no auth_sessions / auth_credentials / user_access tables.
"""
from __future__ import annotations

from sqlalchemy import case, func, text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship, synonym

from app.models.activity_log import ActivityLog
from app.models.assets import Asset, AssetAssignment, AssetCategory, AssetCategoryOsPlatform, asset_number_seq
from app.models.base import Base
from app.models.clients_projects import (
    Allocation,
    Client,
    ClientLocation,
    Project,
    ProjectMember,
    ProjectStakeholder,
    client_code_seq,
    project_number_seq,
)
from app.models.company_setup import (
    Company,
    CompanyHoliday,
    Department,
    Designation,
    EmailDelivery,
    LeavePolicy,
    LeavePolicyLine,
    LeaveType,
    Location,
)
from app.models.employee_master import (
    Address,
    EmergencyContact,
    Employee,
    EmployeeAccessGrant,
    EmployeeOnboardingPacketDocument,
    EmployeeSkill,
    Module,
    NationalIdDocumentType,
    Skill,
    Submodule,
    employee_number_seq,
)
from app.models.portal import (
    EmployeeLeaveBalance,
    EmployeeRequest,
    LeaveRequest,
    LeaveRequestDay,
    Timesheet,
    TimesheetDayEntry,
    TimesheetItem,
)

# ----------------------------------------------------------------------------------------------- aliases
RbacModule = Module
RbacSubmodule = Submodule
LeaveBalance = EmployeeLeaveBalance
TimesheetHeader = Timesheet
TimesheetLine = TimesheetItem
TimesheetEntry = TimesheetDayEntry
AssetAllocation = AssetAssignment


# STI aliases: live services still import ProfileUpdateRequest / AssetRequest /
# CorrectionRequest; they all live in employee_requests with request_kind.
class ProfileUpdateRequest(EmployeeRequest):
    __mapper_args__ = {"polymorphic_identity": "profile_update"}


class AssetRequest(EmployeeRequest):
    __mapper_args__ = {"polymorphic_identity": "asset"}


class CorrectionRequest(EmployeeRequest):
    __mapper_args__ = {"polymorphic_identity": "correction"}


# Legacy attribute names used by employee request services / serializers
EmployeeRequest.employee_id = synonym("requested_for_employee_id")
EmployeeRequest.field_changed = synonym("field_name")
EmployeeRequest.short_description = synonym("summary")
EmployeeRequest.long_description = synonym("details")
EmployeeRequest.requested_date = synonym("requested_at")
EmployeeRequest.created_date = synonym("requested_at")
EmployeeRequest.decided_date = synonym("decided_at")
EmployeeRequest.request_type = synonym("asset_request_type")
EmployeeRequest.system_asset_id = synonym("asset_id")
EmployeeRequest.requested_category_id = synonym("asset_category_id")
EmployeeRequest.new_asset_details = synonym("details")
EmployeeRequest.fulfilled_system_asset_id = synonym("fulfilled_asset_id")
EmployeeRequest.requested_value = synonym("new_value")
EmployeeRequest.note = synonym("details")
EmployeeRequest.created_at = synonym("requested_at")
EmployeeRequest.reviewed_by = synonym("decision_note")


@hybrid_property
def _employee_request_updated_date(self: EmployeeRequest):
    return self.decided_at or self.requested_at


@_employee_request_updated_date.setter  # type: ignore[no-redef]
def _employee_request_updated_date(self: EmployeeRequest, value) -> None:
    # Legacy create paths set updated_date=now; do not stamp decided_at on create.
    _ = value


@_employee_request_updated_date.expression  # type: ignore[no-redef]
def _employee_request_updated_date(cls: type[EmployeeRequest]):
    return func.coalesce(cls.decided_at, cls.requested_at)


EmployeeRequest.updated_date = _employee_request_updated_date
EmployeeRequest.updated_at = _employee_request_updated_date

EmployeeRequest.employee = relationship(
    Employee,
    foreign_keys=[EmployeeRequest.requested_for_employee_id],
    lazy="select",
)
EmployeeRequest.submitted_by_employee = relationship(
    Employee,
    foreign_keys=[EmployeeRequest.submitted_by_employee_id],
    lazy="select",
)
EmployeeRequest.requested_category = relationship(
    AssetCategory,
    foreign_keys=[EmployeeRequest.asset_category_id],
    lazy="select",
)

# Timesheet legacy attribute names used by week_service
Timesheet.timesheet_id = synonym("id")
Timesheet.lines = synonym("items")
TimesheetItem.line_id = synonym("id")
TimesheetItem.timesheet_line_id = synonym("id")
TimesheetItem.entries = synonym("day_entries")
TimesheetItem.project_code_category = synonym("category")
TimesheetDayEntry.entry_id = synonym("id")
TimesheetDayEntry.timesheet_line_id = synonym("timesheet_item_id")
TimesheetDayEntry.entry_date = synonym("work_date")

# Asset catalog legacy attribute names (services still expose camelCase API fields).
AssetCategory.category_id = synonym("id")
AssetCategory.category_name = synonym("name")
Asset.system_asset_id = synonym("id")
Asset.asset_id = synonym("asset_code")
Asset.category_id = synonym("asset_category_id")
Asset.warranty_plan = synonym("warranty_plan_number")
AssetAssignment.allocation_id = synonym("id")
AssetAssignment.system_asset_id = synonym("asset_id")
AssetAssignment.employee_id = synonym("assigned_to_employee_id")
AssetAssignment.allocated_date = synonym("assigned_date")
AssetAssignment.reason_for_return = synonym("return_reason")
AssetAssignment.return_notes = synonym("return_note")
AssetAssignment.swapped_with_allocation_id = synonym("replaces_assignment_id")

# Company / Client / Project / org legacy attribute names
Company.company_name = synonym("name")
Company.company_email = synonym("email")
Client.client_id = synonym("id")
Project.project_id = synonym("id")
Project.project_name = synonym("name")
Department.department_id = synonym("id")
Department.department_name = synonym("name")
Designation.designation_id = synonym("id")
Designation.title = synonym("name")
Location.location_id = synonym("id")
Location.location_name = synonym("name")
# Location uses postal_code; older code often said zip / country
if not hasattr(Location, "zip"):
    Location.zip = synonym("postal_code")
if not hasattr(Location, "country"):
    Location.country = synonym("country_code")

LeavePolicy.policy_id = synonym("id")
LeavePolicy.policy_name = synonym("name")
LeavePolicy.policy_start_year = synonym("start_year")
LeavePolicy.policy_end_year = synonym("end_year")
LeavePolicy.lines = relationship(
    LeavePolicyLine, back_populates="policy", lazy="selectin", cascade="all, delete-orphan"
)
LeavePolicyLine.policy = relationship(LeavePolicy, back_populates="lines")
LeavePolicyLine.policy_line_id = synonym("id")
LeavePolicyLine.policy_id = synonym("leave_policy_id")
LeaveType.leave_type_id = synonym("id")
LeaveType.leave_type_name = synonym("name")
Skill.skill_id = synonym("id")
Skill.skill_name = synonym("name")
CompanyHoliday.holiday_id = synonym("id")
CompanyHoliday.holiday_name = synonym("name")
LeaveRequest.leave_request_id = synonym("id")
LeaveRequest.submitted_date = synonym("submitted_at")
LeaveRequest.action_date = synonym("decided_at")
LeaveRequestDay.leave_request_day_id = synonym("id")
LeaveBalance.balance_id = synonym("id")


@hybrid_property
def _leave_policy_status(self: LeavePolicy) -> str:
    return "Active" if self.is_active else "Inactive"


@_leave_policy_status.expression  # type: ignore[no-redef]
def _leave_policy_status(cls: type[LeavePolicy]):
    return case((cls.is_active.is_(True), text("'Active'")), else_=text("'Inactive'"))


LeavePolicy.status = _leave_policy_status

# Address / EmergencyContact legacy attribute names
Address.address_id = synonym("id")
Address.address_line1 = synonym("address_line_1")
Address.address_line2 = synonym("address_line_2")
Address.zip_code = synonym("postal_code")
Address.country = synonym("country_code")
EmergencyContact.emergency_contact_id = synonym("id")

# Employee -> org master relationships under the names the live services use
Employee.org_department = relationship(Department, foreign_keys=[Employee.department_id], lazy="select")
Employee.org_designation = relationship(Designation, foreign_keys=[Employee.designation_id], lazy="select")
Employee.designation = relationship(Designation, foreign_keys=[Employee.designation_id], lazy="select", viewonly=True)
Employee.leave_policy = relationship(LeavePolicy, foreign_keys=[Employee.leave_policy_id], lazy="select", viewonly=True)
Employee.org_location = relationship(Location, foreign_keys=[Employee.location_id], lazy="select")
Employee.work_location = relationship(
    Location, foreign_keys=[Employee.location_id], lazy="select", viewonly=True)

# RBAC legacy attribute names (old API used module_id / module_name / status)
Module.module_id = synonym("id")
Module.module_name = synonym("display_name")
Submodule.submodule_id = synonym("id")
Submodule.submodule_name = synonym("display_name")


@hybrid_property
def _module_status(self: Module) -> str:
    return "Active" if self.is_active else "Inactive"


@_module_status.expression  # type: ignore[no-redef]
def _module_status(cls: type[Module]):
    return case((cls.is_active.is_(True), text("'Active'")), else_=text("'Inactive'"))


Module.status = _module_status


@hybrid_property
def _submodule_status(self: Submodule) -> str:
    return "Active" if self.is_active else "Inactive"


@_submodule_status.expression  # type: ignore[no-redef]
def _submodule_status(cls: type[Submodule]):
    return case((cls.is_active.is_(True), text("'Active'")), else_=text("'Inactive'"))


Submodule.status = _submodule_status

Module.submodules = relationship(
    Submodule, back_populates="module", order_by=Submodule.display_order, lazy="selectin"
)
Submodule.module = relationship(Module, back_populates="submodules")


@property
def _module_has_submodules(self: Module) -> bool:
    subs = self.__dict__.get("submodules")
    return bool(subs)


Module.has_submodules = _module_has_submodules

EmployeeAccessGrant.grant_id = synonym("id")
EmployeeAccessGrant.granted_by = synonym("granted_by_employee_id")
EmployeeAccessGrant.granted_date = synonym("granted_at")
EmployeeAccessGrant.module = relationship(
    Module, foreign_keys=[EmployeeAccessGrant.module_id], lazy="selectin"
)
EmployeeAccessGrant.submodule = relationship(
    Submodule,
    primaryjoin=(
        "and_(EmployeeAccessGrant.submodule_id==Submodule.id, "
        "EmployeeAccessGrant.module_id==Submodule.module_id)"
    ),
    foreign_keys=[EmployeeAccessGrant.submodule_id, EmployeeAccessGrant.module_id],
    viewonly=True,
    lazy="selectin",
)


@hybrid_property
def _grant_status(self: EmployeeAccessGrant) -> str:
    return "Revoked" if self.revoked_at is not None else "Active"


@_grant_status.expression  # type: ignore[no-redef]
def _grant_status(cls: type[EmployeeAccessGrant]):
    return case((cls.revoked_at.is_(None), text("'Active'")), else_=text("'Revoked'"))


EmployeeAccessGrant.status = _grant_status


__all__ = [
    "ActivityLog",
    "Address",
    "Allocation",
    "Asset",
    "AssetAssignment",
    "AssetAllocation",
    "AssetCategory",
    "AssetCategoryOsPlatform",
    "Base",
    "Client",
    "ClientLocation",
    "Company",
    "CompanyHoliday",
    "Department",
    "Designation",
    "EmailDelivery",
    "EmergencyContact",
    "Employee",
    "EmployeeAccessGrant",
    "EmployeeLeaveBalance",
    "EmployeeOnboardingPacketDocument",
    "EmployeeRequest",
    "ProfileUpdateRequest",
    "AssetRequest",
    "CorrectionRequest",
    "EmployeeSkill",
    "LeaveBalance",
    "LeavePolicy",
    "LeavePolicyLine",
    "LeaveRequest",
    "LeaveRequestDay",
    "LeaveType",
    "Location",
    "Module",
    "NationalIdDocumentType",
    "Project",
    "ProjectMember",
    "ProjectStakeholder",
    "RbacModule",
    "RbacSubmodule",
    "Skill",
    "Submodule",
    "Timesheet",
    "TimesheetDayEntry",
    "TimesheetEntry",
    "TimesheetHeader",
    "TimesheetItem",
    "TimesheetLine",
    "asset_number_seq",
    "client_code_seq",
    "employee_number_seq",
    "project_number_seq",
]
