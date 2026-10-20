import json
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, case, delete, func, inspect as sa_inspect, or_, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.role_groups import (
    ESS_FUNCTIONAL_QUEUE_ROLES,
    LEAVE_ADMIN_ROLES,
    TIMESHEET_ORG_APPROVER_ROLES,
)
from app.core.roles import Role, Status, session_access_roles
from app.core.security import hash_password, verify_password
from app.mail.invite import issue_and_send_invite
from app.core.serialize import (
    asset_request_to_dict,
    correction_request_to_dict,
    employee_to_dict,
    it_request_to_dict,
    preferred_personal_address,
    profile_change_to_dict,
    profile_update_request_to_dict,
    project_data_to_dict,
)
from app.modules.leave.policy_assignment import (
    assign_or_change_leave_policy,
    require_leave_policy_on_body,
)
from app.models.awaiting import (BankVerificationAttempt, ComplianceDocument, EmployeeBankAccount, EmployeeLeaveOpening, EmployeeOnboarding, OnboardingActivity, OnboardingChecklistItem)
from app.models.tables import (Address, Allocation, Asset, AssetAllocation, AssetCategory, Department, Designation, EmergencyContact, Employee, EmployeeSkill, Location, NationalIdDocumentType, Timesheet)
from app.models.awaiting import (
    EmployeeDocument,
    EmployeeFieldAudit,
    EmployeeProfileChange,
    EmployeeProjectData,
    ITRequest,
    TimesheetDetails,
)
from app.models.tables import AssetRequest, CorrectionRequest, ProfileUpdateRequest
# TODO(stateless-auth): removed dead imports ['AuthSession', 'UserAccess']
from app.modules.onboarding.service import (
    ensure_onboarding_for_employee,
    get_onboarding_for_employee,
)
from app.modules.org.service import assert_active_master
from app.modules.employee.access import can_view_full_national_id
from app.modules.employee.access_fields import (
    apply_synced_access_role_fields,
    force_create_access_role_employee,
    resolve_company_for_write,
    sync_access_role_fields,
)
from app.modules.employee.directory_clause import directory_employee_clause
from app.modules.employee.employee_code import (
    allocate_business_employee_id,
    allocate_employee_code,
    allocate_name_based_employee_code,
    join_year_from,
    normalize_dept_token,
)
from app.modules.employee.status import EMPLOYEE_INACTIVE_ALIASES
from app.modules.employee.employment_updates import (
    SYSTEM_AUDIT_ACTOR,
    assert_can_apply_emp14,
    body_has_emp14_fields,
    normalize_emp14_status,
)
from app.modules.employee.profile_audit import (
    list_profile_audit,
    record_field_change,
    record_profile_audit,
    snapshot_profile,
    snapshot_projects,
    snapshot_skills,
)
from app.modules.employee.joining_status import (
    joining_iso_or_default,
    parse_joining_date,
    resolve_joining_raw,
    resolve_payroll_start_date,
    status_from_joining_date,
    utc_today,
)
from app.modules.employee.national_id_identity import apply_national_id_identity
from app.modules.employee.profile_fields import (
    apply_profile_fields,
    extract_address_emergency_payload,
    normalize_official_email_alias,
    validate_common_fields,
    validate_common_fields_for_draft,
    validate_create_required,
    validate_draft_required,
)

_DRAFT_EMAIL_DOMAIN = "@hrms.local"
_DRAFT_EMAIL_PREFIX = "draft+"
_RESEND_INVITE_BLOCKED_STATUSES = frozenset(
    {Status.NEW.value, *EMPLOYEE_INACTIVE_ALIASES}
)

_ALLOWED_PROFILE_CHANGE_KEYS = frozenset(
    {
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "postalCode",
        "country",
        "emergencyName",
        "emergencyPhone",
        "emergencyRelation",
        "emergencyEmail",
        "emergencyEmployeeId",
        "emergencyContactName",
        "emergencyContactPhone",
        "emergencyContactRelation",
        "emergencyContactEmail",
        "linkedEmployeeId",
        "alternateEmergencyName",
        "alternateEmergencyPhone",
        "alternateEmergencyRelation",
        "alternateEmergencyEmail",
        "personalEmail",
        "alternatePhone",
        "gender",
        "phone",
        "phoneNumber",
        "maritalStatus",
        "nationality",
        "ethnicity",
    }
)

_NOT_LOADED: Any = object()


class EmployeeService:
    @staticmethod
    def _directory_employee_clause():
        """Exclude bootstrap/system logins from directory-style listings."""
        return directory_employee_clause()

    async def _reporting_manager_names_by_id(
        self,
        session: AsyncSession,
        manager_ids: set[uuid.UUID],
    ) -> dict[uuid.UUID, str]:
        if not manager_ids:
            return {}
        result = await session.execute(
            select(
                Employee.employee_id,
                Employee.first_name,
                Employee.last_name,
            ).where(Employee.employee_id.in_(manager_ids))
        )
        names: dict[uuid.UUID, str] = {}
        for emp_id, first_name, last_name in result.all():
            label = f"{first_name or ''} {last_name or ''}".strip()
            if label:
                names[emp_id] = label
        return names

    async def _get(self, session: AsyncSession, employee_id: uuid.UUID) -> Employee:
        result = await session.execute(
            select(Employee)
            .where(Employee.employee_id == employee_id)
            .options(
                joinedload(Employee.org_department),
                joinedload(Employee.work_location),
                joinedload(Employee.designation),
                joinedload(Employee.leave_policy),
            )
        )
        emp = result.scalar_one_or_none()
        if emp is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        return emp

    def _parse_optional_uuid(self, value: Any, field: str) -> uuid.UUID | None:
        if value is None or value == "":
            return None
        try:
            return uuid.UUID(str(value))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid {field}") from exc

    async def _validate_org_fks(
        self,
        session: AsyncSession,
        *,
        department_id: uuid.UUID | None = None,
        location_id: uuid.UUID | None = None,
        designation_id: uuid.UUID | None = None,
        reporting_manager_id: uuid.UUID | None = None,
        employee_id: uuid.UUID | None = None,
        check_department: bool = False,
        check_location: bool = False,
        check_designation: bool = False,
        check_manager: bool = False,
    ) -> None:
        if check_department and department_id is not None:
            await assert_active_master(session, "department", department_id)
        if check_location and location_id is not None:
            await assert_active_master(session, "location", location_id)
        if check_designation and designation_id is not None:
            await assert_active_master(session, "designation", designation_id)
        if check_manager and reporting_manager_id is not None:
            if employee_id is not None and reporting_manager_id == employee_id:
                raise HTTPException(
                    status_code=400, detail="reportingManagerId cannot be self"
                )
            found = await session.execute(
                select(Employee).where(Employee.employee_id == reporting_manager_id)
            )
            manager = found.scalar_one_or_none()
            if manager is None:
                raise HTTPException(status_code=400, detail="reportingManagerId not found")
            if str(manager.status) != Status.ACTIVE.value:
                raise HTTPException(
                    status_code=400,
                    detail="reportingManagerId must reference an Active employee",
                )
            if employee_id is not None:
                await self._assert_no_manager_cycle(
                    session, employee_id, reporting_manager_id
                )

    async def _assert_no_manager_cycle(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        new_manager_id: uuid.UUID,
    ) -> None:
        """Reject A→B when B's manager chain already includes A (EMP-1.4)."""
        seen: set[uuid.UUID] = set()
        current: uuid.UUID | None = new_manager_id
        while current is not None:
            if current == employee_id:
                raise HTTPException(
                    status_code=400,
                    detail="reportingManagerId would create a circular reporting chain",
                )
            if current in seen:
                break
            seen.add(current)
            row = await session.execute(
                select(Employee.reporting_manager_id).where(
                    Employee.employee_id == current
                )
            )
            current = row.scalar_one_or_none()

    def _manager_from_body(self, body: dict) -> Any:
        if "reportingManagerId" in body:
            return body.get("reportingManagerId")
        if "supervisorId" in body:
            return body.get("supervisorId")
        return ...

    async def _ensure_business_employee_id(self, session: AsyncSession, emp: Employee) -> None:
        """Old schema minted businessEmployeeId; new schema uses DB-generated ``emp_id`` (already set)."""
        _ = (session, emp)
        return

    async def _resolve_dept_token(self, session: AsyncSession, body: dict) -> str:
        """Resolve the department token used in EMP-1.1 employee_code generation."""
        raw_id = body.get("departmentId")
        if raw_id not in (None, ""):
            dept_id = self._parse_optional_uuid(raw_id, "departmentId")
            if dept_id is not None:
                row = (
                    await session.execute(
                        select(Department).where(Department.department_id == dept_id)
                    )
                ).scalar_one_or_none()
                if row is not None:
                    return normalize_dept_token(department_name=getattr(row, "name", None) or getattr(row, "department_name", None))
        return normalize_dept_token(
            department_name=(
                str(body["departmentName"]).strip()
                if body.get("departmentName")
                else None
            ),
            department_legacy=str(body.get("department") or "EMPLOYEE"),
        )

    async def _assign_employee_code(
        self,
        session: AsyncSession,
        body: dict,
        *,
        employment_start_date: str,
    ) -> str:
        """Draft employee_code: name-based when first/last exist; else DEPT-YYYY."""
        provided = body.get("employeeCode")
        if provided is not None and str(provided).strip():
            code = str(provided).strip()
            existing = (
                await session.execute(
                    select(Employee.employee_id).where(Employee.employee_code == code)
                )
            ).scalar_one_or_none()
            if existing is not None:
                raise HTTPException(
                    status_code=400, detail="employeeCode already exists"
                )
            return code
        first = str(body.get("firstName") or "").strip()
        last = str(body.get("lastName") or "").strip()
        if first and last:
            return await allocate_name_based_employee_code(
                session, first_name=first, last_name=last
            )
        dept = await self._resolve_dept_token(session, body)
        year = join_year_from(employment_start_date)
        return await allocate_employee_code(session, dept_token=dept, year=year)

    async def _apply_master_fields(
        self, session: AsyncSession, emp: Employee, body: dict
    ) -> None:
        if "departmentId" in body:
            dept_id = self._parse_optional_uuid(body.get("departmentId"), "departmentId")
            await self._validate_org_fks(
                session, department_id=dept_id, check_department=True
            )
            emp.department_id = dept_id
        if "locationId" in body:
            loc_id = self._parse_optional_uuid(body.get("locationId"), "locationId")
            await self._validate_org_fks(session, location_id=loc_id, check_location=True)
            emp.location_id = loc_id
        if "designationId" in body:
            des_id = self._parse_optional_uuid(body.get("designationId"), "designationId")
            await self._validate_org_fks(
                session, designation_id=des_id, check_designation=True
            )
            emp.designation_id = des_id
            if des_id is not None:
                des = (
                    await session.execute(
                        select(Designation).where(Designation.designation_id == des_id)
                    )
                ).scalar_one_or_none()
                # New schema Designation has ``name`` only (no title / job_description on Employee).
            _ = des
        manager_raw = self._manager_from_body(body)
        if manager_raw is not ...:
            mgr_id = self._parse_optional_uuid(manager_raw, "reportingManagerId")
            await self._validate_org_fks(
                session,
                reporting_manager_id=mgr_id,
                employee_id=getattr(emp, "employee_id", None),
                check_manager=True,
            )
            emp.reporting_manager_id = mgr_id
        if "personalEmail" in body:
            personal = body.get("personalEmail")
            emp.personal_email = (
                (str(personal).strip() or None) if personal is not None else None
            )
        joining_raw = resolve_joining_raw(body)
        if joining_raw is not None and (
            "dateOfJoining" in body or "employmentStartDate" in body or "startDate" in body
        ):
            join_iso = joining_iso_or_default(joining_raw)
            emp.date_of_joining = parse_joining_date(join_iso)
            if "payrollStartDate" not in body and not getattr(emp, "payroll_start_date", None):
                payroll_iso = resolve_payroll_start_date(
                    joining_iso=join_iso,
                    payroll_raw=None,
                    employment_type=getattr(emp, "employment_type", None),
                )
                emp.payroll_start_date = (
                    parse_joining_date(payroll_iso) if payroll_iso else None
                )
            elif "payrollStartDate" in body:
                payroll_iso = resolve_payroll_start_date(
                    joining_iso=join_iso,
                    payroll_raw=body.get("payrollStartDate"),
                    employment_type=body.get(
                        "employmentType", getattr(emp, "employment_type", None)
                    ),
                )
                emp.payroll_start_date = (
                    parse_joining_date(payroll_iso) if payroll_iso else None
                )
        await apply_national_id_identity(session, emp, body)
        apply_profile_fields(emp, body)
        # Profile fields may still assign ISO strings to DATE columns — coerce.
        for attr in ("date_of_birth", "date_of_joining", "payroll_start_date"):
            val = getattr(emp, attr, None)
            if isinstance(val, str):
                setattr(emp, attr, parse_joining_date(val))

    async def _pending_profile_change_ids(self, session: AsyncSession) -> set[uuid.UUID]:
        try:
            stmt = select(EmployeeProfileChange.employee_id).where(
                EmployeeProfileChange.status == Status.PENDING
            )
        except HTTPException:
            return set()  # no table (Awaiting Refinement)
        result = await session.execute(stmt)
        return {row for row in result.scalars().all()}

    @staticmethod
    def _session_has_writes(session: AsyncSession) -> bool:
        try:
            return bool(len(session.new) or len(session.dirty) or len(session.deleted))
        except Exception:
            return False

    async def _recover_session_after_read_error(self, session: AsyncSession) -> None:
        """Rollback only when the session has no in-flight writes.

        Contact / pending-profile reads must not undo an uncommitted PATCH.
        """
        # A Python-level error (missing attribute, placeholder 501) leaves the transaction healthy: rolling back
        # would silently undo rows that are flushed but not yet committed.
        failure = sys.exc_info()[1]
        if failure is not None and not isinstance(failure, SQLAlchemyError):
            return
        if self._session_has_writes(session):
            return
        try:
            await session.rollback()
        except Exception:
            pass

    async def _empty_contact(
        self,
        phone: str | None,
        personal_email: str | None,
        alternate_phone: str | None = None,
    ) -> dict[str, Any]:
        return {
            "personalEmail": personal_email or "",
            "phone": phone or "",
            "alternatePhone": alternate_phone or "",
            "addressLine1": "",
            "addressLine2": "",
            "city": "",
            "state": "",
            "postalCode": "",
            "country": "",
            "addressId": None,
            "emergencyName": "",
            "emergencyPhone": "",
            "emergencyRelation": "",
            "emergencyEmail": "",
            "emergencyEmployeeId": None,
            "emergencyContactName": "",
            "emergencyContactPhone": "",
            "emergencyContactRelation": "",
            "emergencyContactEmail": "",
            "linkedEmployeeId": None,
            "alternateEmergencyName": "",
            "alternateEmergencyPhone": "",
            "alternateEmergencyRelation": "",
            "alternateEmergencyEmail": "",
        }

    async def _emergency_contacts_ordered(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
    ) -> list[EmergencyContact]:
        """Primary is first row; optional alternate is the second (by created_date)."""
        result = await session.execute(
            select(EmergencyContact)
            .where(EmergencyContact.employee_id == employee_id)
            .order_by(EmergencyContact.contact_order.asc())  # 1 = primary, 2 = alternate
        )
        return list(result.scalars().all())

    @staticmethod
    def _emergency_row_display(emerg: EmergencyContact | None) -> dict[str, Any]:
        from app.modules.employee.profile_fields import (
            is_emergency_name_placeholder,
            is_phone_placeholder,
        )

        if emerg is None:
            return {
                "name": "",
                "phone": "",
                "relation": "",
                "email": "",
                "linkedEmployeeId": None,
            }
        raw_name = emerg.name or ""
        name = "" if is_emergency_name_placeholder(raw_name) else raw_name
        raw_phone = emerg.phone_number or ""
        phone = "" if is_phone_placeholder(raw_phone) else raw_phone
        linked = None  # the new emergency_contacts table has no linked employee
        return {
            "name": name,
            "phone": phone,
            "relation": emerg.relation or "",
            "email": emerg.email or "",
            "linkedEmployeeId": linked,
        }

    async def _contact_for_employee(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        phone: str | None,
        personal_email: str | None,
        alternate_phone: str | None = None,
    ) -> dict[str, Any]:
        try:
            addr_result = await session.execute(
                select(Address).where(Address.employee_id == employee_id)
            )
            addr = preferred_personal_address(addr_result.scalars().all())
            contacts = await self._emergency_contacts_ordered(session, employee_id)
        except Exception:
            # Schema drift must not break employee directory listing — but
            # never roll back an in-flight Personal-tab PATCH.
            await self._recover_session_after_read_error(session)
            return await self._empty_contact(phone, personal_email, alternate_phone)

        return self._contact_from_rows(
            addr, contacts, phone, personal_email, alternate_phone
        )

    def _contact_from_rows(
        self,
        addr: Address | None,
        contacts: list[EmergencyContact],
        phone: str | None,
        personal_email: str | None,
        alternate_phone: str | None = None,
    ) -> dict[str, Any]:
        primary = self._emergency_row_display(contacts[0] if contacts else None)
        alternate = self._emergency_row_display(contacts[1] if len(contacts) > 1 else None)
        linked = primary["linkedEmployeeId"]
        return {
            "personalEmail": personal_email or "",
            "phone": phone or "",
            "alternatePhone": alternate_phone or "",
            "addressLine1": (addr.address_line1 if addr else None) or "",
            "addressLine2": (addr.address_line2 if addr else None) or "",
            "city": (addr.city if addr else None) or "",
            "state": (addr.state if addr else None) or "",
            "postalCode": (addr.zip_code if addr else None) or "",
            "country": (addr.country if addr else None) or "",
            "addressId": str(addr.address_id) if addr else None,
            "emergencyName": primary["name"],
            "emergencyPhone": primary["phone"],
            "emergencyRelation": primary["relation"],
            "emergencyEmail": primary["email"],
            "emergencyEmployeeId": linked,
            "emergencyContactName": primary["name"],
            "emergencyContactPhone": primary["phone"],
            "emergencyContactRelation": primary["relation"],
            "emergencyContactEmail": primary["email"],
            "linkedEmployeeId": linked,
            "alternateEmergencyName": alternate["name"],
            "alternateEmergencyPhone": alternate["phone"],
            "alternateEmergencyRelation": alternate["relation"],
            "alternateEmergencyEmail": alternate["email"],
        }

    async def _contacts_by_employee(
        self,
        session: AsyncSession,
        employees: list[Employee],
    ) -> dict[uuid.UUID, dict[str, Any]]:
        """Contact blocks for many employees in two queries (addresses, emergency).

        Returns an empty map on a read error so callers fall back to the
        per-employee path, which already tolerates schema drift.
        """
        ids = [e.employee_id for e in employees]
        if not ids:
            return {}
        try:
            addr_result = await session.execute(
                select(Address).where(Address.employee_id.in_(ids))
            )
            addresses: dict[uuid.UUID, list[Address]] = {}
            for row in addr_result.scalars().all():
                addresses.setdefault(row.employee_id, []).append(row)
            emergency_result = await session.execute(
                select(EmergencyContact)
                .where(EmergencyContact.employee_id.in_(ids))
                .order_by(
                    EmergencyContact.created_date.asc().nulls_first(),
                    EmergencyContact.emergency_contact_id.asc(),
                )
            )
            emergency: dict[uuid.UUID, list[EmergencyContact]] = {}
            for row in emergency_result.scalars().all():
                emergency.setdefault(row.employee_id, []).append(row)
        except Exception:
            await self._recover_session_after_read_error(session)
            return {}
        return {
            e.employee_id: self._contact_from_rows(
                preferred_personal_address(addresses.get(e.employee_id, [])),
                emergency.get(e.employee_id, []),
                e.phone_number,
                e.personal_email,
                getattr(e, "alternate_phone_number", None),
            )
            for e in employees
        }

    async def _national_id_type_ids_by_code(
        self,
        session: AsyncSession,
        codes: set[str],
    ) -> dict[str, str]:
        codes = {c.strip().lower() for c in codes if c and c.strip()}
        if not codes:
            return {}
        result = await session.execute(
            select(
                func.lower(NationalIdDocumentType.document_type_code),
                NationalIdDocumentType.national_id_document_type_id,
            ).where(func.lower(NationalIdDocumentType.document_type_code).in_(codes))
        )
        found: dict[str, str] = {}
        for code, type_id in result.all():
            found.setdefault(code, str(type_id))
        return found

    async def _serialize_directory_rows(
        self,
        session: AsyncSession,
        employees: list[Employee],
        user: dict,
        pending_ids: set[uuid.UUID],
    ) -> list[dict]:
        """Directory rows for many employees with a fixed number of queries.

        Contact details, the actor's grant level, national-id types, onboarding
        and manager names are each loaded once for the whole page instead of
        once per employee.
        """
        from app.modules.employee.access import actor_employees_grant_level

        onboarding_map = await self._onboarding_by_employee_ids(
            session, [e.employee_id for e in employees]
        )
        manager_ids = {
            e.reporting_manager_id
            for e in employees
            if getattr(e, "reporting_manager_id", None) is not None
        }
        manager_names = await self._reporting_manager_names_by_id(session, manager_ids)
        contacts = await self._contacts_by_employee(session, employees)
        grant_level = await actor_employees_grant_level(session, user)
        type_ids = await self._national_id_type_ids_by_code(
            session,
            {
                str(getattr(e, "national_id_document_type", "") or "")
                for e in employees
            },
        )
        return [
            await self._to_dict(
                session,
                e,
                pending_ids=pending_ids,
                actor=user,
                onboarding=onboarding_map.get(e.employee_id),
                invite_meta_loaded=True,
                manager_names=manager_names,
                contact=contacts.get(e.employee_id),
                employees_grant_level=grant_level,
                national_id_type_ids=type_ids,
            )
            for e in employees
        ]

    async def _ensure_org_rels(self, session: AsyncSession, emp: Employee) -> None:
        """Eager-load org FKs so serialize never sync-lazy-loads (async)."""
        try:
            unloaded = sa_inspect(emp).unloaded
        except Exception:
            return
        need = [
            name
            for name in (
                "org_department",
                "work_location",
                "designation",
                "leave_policy",
            )
            if name in unloaded
        ]
        if need:
            await session.refresh(emp, attribute_names=need)

    async def _national_id_document_type_id(
        self,
        session: AsyncSession,
        document_type_code: str,
    ) -> str | None:
        result = await session.execute(
            select(NationalIdDocumentType.national_id_document_type_id).where(
                func.lower(NationalIdDocumentType.document_type_code)
                == document_type_code.strip().lower()
            ).limit(1)
        )
        row = result.scalar_one_or_none()
        return str(row) if row is not None else None

    async def _to_dict(
        self,
        session: AsyncSession,
        emp: Employee,
        *,
        pending_ids: set[uuid.UUID] | None = None,
        actor: dict[str, Any] | None = None,
        onboarding: EmployeeOnboarding | None = None,
        invite_meta_loaded: bool = False,
        manager_names: dict[uuid.UUID, str] | None = None,
        contact: dict[str, Any] | None = None,
        employees_grant_level: Any = _NOT_LOADED,
        national_id_type_ids: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Serialize one employee; list callers pass the pre-loaded pieces."""
        await self._ensure_org_rels(session, emp)
        if contact is None:
            contact = await self._contact_for_employee(
                session,
                emp.employee_id,
                emp.phone_number,
                emp.personal_email,
                getattr(emp, "alternate_phone_number", None),
            )
        if pending_ids is None:
            try:
                pending = await session.execute(
                    select(EmployeeProfileChange.id).where(
                        EmployeeProfileChange.employee_id == emp.employee_id,
                        EmployeeProfileChange.status == Status.PENDING,
                    ).limit(1)
                )
                has_pending = pending.scalar_one_or_none() is not None
            except HTTPException:
                # employee_profile_changes has no table (Awaiting Refinement): never pending. No rollback here,
                # it would undo the uncommitted insert.
                has_pending = False
            except Exception:
                await self._recover_session_after_read_error(session)
                has_pending = False
        else:
            has_pending = emp.employee_id in pending_ids
        if employees_grant_level is _NOT_LOADED:
            employees_grant_level = None
            if actor is not None:
                from app.modules.employee.access import actor_employees_grant_level

                employees_grant_level = await actor_employees_grant_level(
                    session, actor
                )
        data = employee_to_dict(
            emp,
            contact=contact,
            pending_profile_change=has_pending,
            include_full_national_id=can_view_full_national_id(
                actor,
                str(emp.employee_id),
                employees_grant_level=employees_grant_level,
            ),
        )
        type_code = data.get("nationalIdDocumentType")
        if type_code and not data.get("nationalIdDocumentTypeId"):
            if national_id_type_ids is not None:
                type_id = national_id_type_ids.get(str(type_code).strip().lower())
            else:
                type_id = await self._national_id_document_type_id(
                    session,
                    str(type_code),
                )
            if type_id:
                data["nationalIdDocumentTypeId"] = type_id
        if not invite_meta_loaded:
            onboarding = await get_onboarding_for_employee(session, emp.employee_id)
        data.update(self._invite_meta_payload(emp, onboarding))
        mgr_id = getattr(emp, "reporting_manager_id", None)
        if mgr_id:
            if manager_names is not None:
                manager_name = manager_names.get(mgr_id)
            else:
                resolved = await self._reporting_manager_names_by_id(
                    session,
                    {mgr_id},
                )
                manager_name = resolved.get(mgr_id)
            if manager_name:
                data["reportingManagerName"] = manager_name
        return data

    @staticmethod
    def _iso_dt(value: datetime | None) -> str | None:
        return value.isoformat() if value else None

    @classmethod
    def _invite_meta_payload(
        cls,
        emp: Employee,
        onboarding: EmployeeOnboarding | None,
    ) -> dict[str, Any]:
        has_password = bool(getattr(emp, "password", None))
        accepted_at = (
            onboarding.invite_accepted_at if onboarding is not None else None
        )
        sent_at = onboarding.invite_sent_at if onboarding is not None else None
        status_val = str(getattr(emp, "status", "") or "")
        invite_outstanding = (
            status_val not in _RESEND_INVITE_BLOCKED_STATUSES
            and not has_password
            and accepted_at is None
        )
        return {
            "hasLoginPassword": has_password,
            "inviteSentAt": cls._iso_dt(sent_at),
            "inviteAcceptedAt": cls._iso_dt(accepted_at),
            "inviteOutstanding": invite_outstanding,
        }

    async def _onboarding_by_employee_ids(
        self,
        session: AsyncSession,
        employee_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, EmployeeOnboarding]:
        if not employee_ids:
            return {}
        try:
            stmt = select(EmployeeOnboarding).where(
                EmployeeOnboarding.employee_id.in_(employee_ids)
            )
        except HTTPException:
            return {}  # onboarding tables are Awaiting Refinement
        result = await session.execute(stmt)
        return {row.employee_id: row for row in result.scalars().all()}

    async def list_all(self, session: AsyncSession, user: dict) -> list[dict]:
        result = await session.execute(
            select(Employee)
            .where(
                Employee.status != Status.INACTIVE,
                self._directory_employee_clause(),
            )
            .options(
                selectinload(Employee.org_department),
                selectinload(Employee.work_location),
                selectinload(Employee.designation),
                selectinload(Employee.leave_policy),
            )
        )
        try:
            pending_ids = await self._pending_profile_change_ids(session)
        except Exception:
            await session.rollback()
            pending_ids = set()
        employees = list(result.scalars().all())
        return await self._serialize_directory_rows(
            session, employees, user, pending_ids
        )

    async def list_filtered(
        self,
        session: AsyncSession,
        user: dict,
        *,
        status: str | None = None,
        q: str | None = None,
        client_id: str | None = None,
        vendor_id: str | None = None,
        vendor_name: str | None = None,
        project_id: str | None = None,
        reports_to: str | None = None,
        job_rank: str | None = None,
        department_id: str | None = None,
        location_id: str | None = None,
        designation_id: str | None = None,
        sort: str | None = None,
        sort_dir: str = "asc",
        page: int | None = None,
        page_size: int | None = None,
    ) -> list[dict] | dict:
        """Unified list for GET /employees query filters."""
        employee_filters = [
            status,
            q,
            client_id,
            vendor_id,
            vendor_name,
            reports_to,
            job_rank,
            department_id,
            location_id,
            designation_id,
        ]
        paginated = page is not None
        if project_id is not None and not any(v is not None for v in employee_filters) and not paginated:
            return await self.by_project(session, project_id)

        if project_id is not None:
            raise HTTPException(
                status_code=400,
                detail="projectId cannot be combined with other employee list filters",
            )

        if not any(v is not None for v in employee_filters) and not paginated and sort is None:
            return await self.list_all(session, user)

        clauses: list[Any] = [self._directory_employee_clause()]
        if status is not None:
            if status == Status.INACTIVE.value:
                clauses.append(Employee.status.in_(EMPLOYEE_INACTIVE_ALIASES))
            else:
                clauses.append(Employee.status == status)
        if q is not None:
            pattern = f"{q}%"
            name_and_code = (
                (Employee.first_name.ilike(pattern))
                | (Employee.last_name.ilike(pattern))
                | (Employee.employee_code.ilike(pattern))
            )
            if status == Status.NEW.value:
                clauses.append(name_and_code)
            else:
                clauses.append(
                    name_and_code
                    | (Employee.email_id.ilike(pattern))
                    | (Employee.business_employee_id.ilike(pattern))
                )
        if client_id is not None:
            clauses.append(Employee.company == client_id)
        if vendor_id is not None:
            clauses.append(Employee.vendor == vendor_id)
        if vendor_name is not None:
            clauses.append(Employee.vendor == vendor_name)
        if reports_to is not None:
            clauses.append(
                Employee.reporting_manager_id == self._parse_optional_uuid(reports_to, "reportsTo")
            )
        if job_rank is not None:
            clauses.append(Employee.job_rank == job_rank)
            if status is None:
                clauses.append(Employee.status == Status.ACTIVE)
        if department_id is not None:
            clauses.append(
                Employee.department_id
                == self._parse_optional_uuid(department_id, "departmentId")
            )
        if location_id is not None:
            clauses.append(
                Employee.location_id == self._parse_optional_uuid(location_id, "locationId")
            )
        if designation_id is not None:
            clauses.append(
                Employee.designation_id
                == self._parse_optional_uuid(designation_id, "designationId")
            )

        descending = sort_dir == "desc"
        join_department = sort == "department"
        stmt = select(Employee).where(*clauses)
        if join_department:
            stmt = stmt.outerjoin(Department, Employee.department_id == Department.department_id)

        last_activity = func.coalesce(Employee.updated_date, Employee.created_date)
        order_cols: list[Any]
        if sort == "email":
            order_cols = [Employee.email_id]
        elif sort == "status":
            order_cols = [Employee.status]
        elif sort == "department":
            order_cols = [Department.department_name, Employee.last_name, Employee.first_name]
        elif sort == "lastupdated":
            order_cols = [last_activity, Employee.last_name, Employee.first_name]
        else:
            order_cols = [Employee.last_name, Employee.first_name]
        if q is not None:
            pattern = f"{q}%"
            search_rank = case(
                (Employee.first_name.ilike(pattern), 0),
                (Employee.last_name.ilike(pattern), 1),
                (Employee.employee_code.ilike(pattern), 2),
                else_=3,
            )
            rank_order = search_rank.asc().nulls_last()
            if descending:
                order_cols = [rank_order] + [
                    col.desc().nulls_last() for col in order_cols
                ]
            else:
                order_cols = [rank_order] + [
                    col.asc().nulls_last() for col in order_cols
                ]
        elif descending:
            order_cols = [col.desc().nulls_last() for col in order_cols]
        else:
            order_cols = [col.asc().nulls_last() for col in order_cols]
        stmt = stmt.order_by(*order_cols)

        count_stmt = select(func.count()).select_from(Employee).where(*clauses)
        total = int(await session.scalar(count_stmt) or 0)

        if paginated:
            size = page_size or 10
            current_page = max(1, page or 1)
            stmt = stmt.offset((current_page - 1) * size).limit(size)

        result = await session.execute(
            stmt.options(
                selectinload(Employee.org_department),
                selectinload(Employee.work_location),
                selectinload(Employee.designation),
                selectinload(Employee.leave_policy),
            )
        )
        try:
            pending_ids = await self._pending_profile_change_ids(session)
        except Exception:
            await session.rollback()
            pending_ids = set()
        employees = list(result.scalars().unique().all())
        rows = await self._serialize_directory_rows(
            session, employees, user, pending_ids
        )
        if not paginated:
            return rows
        size = page_size or 10
        current_page = max(1, page or 1)
        return {
            "items": rows,
            "total": total,
            "page": current_page,
            "pageSize": size,
        }

    async def apply_transition(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID | None,
        action: str,
        *,
        comments: str | None = None,
        email_id: str | None = None,
        patch: dict | None = None,
        actor: dict | None = None,
    ) -> dict:
        """Single lifecycle entrypoint: draft|invite|resend_invite|approve|…"""
        normalized = action.strip().lower().replace("-", "_")
        if normalized == "draft":
            if employee_id is None:
                raise HTTPException(status_code=400, detail="employee id required for draft")
            return await self.draft(session, employee_id, patch or {}, actor=actor)
        if normalized == "invite":
            if employee_id is None:
                raise HTTPException(status_code=400, detail="employee id required for invite")
            invite_body = dict(patch or {})
            lookup = (email_id or "").strip()
            if lookup and not str(invite_body.get("emailId") or "").strip():
                invite_body["emailId"] = lookup
            return await self.invite_draft(
                session, employee_id, invite_body, actor=actor or {}
            )
        if normalized == "resend_invite":
            if employee_id is None:
                raise HTTPException(
                    status_code=400, detail="employee id required for resend_invite"
                )
            return await self.resend_invite(
                session, employee_id, actor=actor or {}
            )
        if normalized == "approve":
            if employee_id is None:
                raise HTTPException(status_code=400, detail="employee id required for approve")
            return await self.approve(session, employee_id, actor=actor)
        if normalized == "reject":
            if employee_id is None:
                raise HTTPException(status_code=400, detail="employee id required for reject")
            if not comments or not comments.strip():
                raise HTTPException(status_code=400, detail="comments must not be empty")
            return await self.reject(session, employee_id, comments.strip(), actor=actor)
        if normalized in {"toggle_status", "status"}:
            if employee_id is None:
                raise HTTPException(status_code=400, detail="employee id required for toggle_status")
            return await self.status_update(session, employee_id, actor=actor)
        if normalized in {"offboard", "deactivate"}:
            if employee_id is None:
                raise HTTPException(status_code=400, detail="employee id required for offboard")
            body = patch or {}
            end_date = body.get("endDate") or body.get("end_date")
            if not end_date or not str(end_date).strip():
                raise HTTPException(status_code=400, detail="endDate is required to offboard")
            return await self.offboard(
                session, employee_id, str(end_date).strip(), actor=actor
            )
        if normalized in {"rehire", "reactivate"}:
            lookup = (email_id or "").strip()
            if not lookup and employee_id is not None:
                emp = await self._get(session, employee_id)
                lookup = str(getattr(emp, "email_id", None) or "").strip()
            if not lookup:
                raise HTTPException(status_code=400, detail="emailId is required for rehire")
            return await self.rehire(session, lookup, patch or {}, actor=actor)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown action '{action}'. "
                "Allowed: draft, invite, resend_invite, approve, "
                "reject, toggle_status, offboard, rehire"
            ),
        )

    @staticmethod
    def _is_draft_placeholder_email(email: str | None) -> bool:
        text = (email or "").strip().lower()
        return text.startswith(_DRAFT_EMAIL_PREFIX) and text.endswith(_DRAFT_EMAIL_DOMAIN)

    @staticmethod
    def _reject_immutable_identity_fields(body: dict) -> None:
        if "employeeCode" in body:
            raise HTTPException(
                status_code=400,
                detail="employeeCode is system-generated and read-only",
            )
        if "businessEmployeeId" in body:
            raise HTTPException(
                status_code=400,
                detail="businessEmployeeId is system-generated and read-only",
            )

    async def update(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        body: dict,
        *,
        actor: dict | None = None,
    ) -> dict:
        emp = await self._get(session, employee_id)
        body = normalize_official_email_alias(dict(body))
        self._reject_immutable_identity_fields(body)
        apply_synced_access_role_fields(body, only_if_present=True)
        validate_common_fields(body, is_create=False)
        if "emailId" in body:
            email = str(body.get("emailId") or "").strip()
            if not email:
                raise HTTPException(
                    status_code=400, detail="officialEmail/emailId cannot be empty"
                )
            existing = await session.execute(
                select(Employee.employee_id).where(
                    Employee.email_id == email,
                    Employee.employee_id != employee_id,
                )
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(status_code=400, detail="officialEmail already in use")
            emp.email_id = email
        if "status" in body and body.get("status") == Status.ACTIVE:
            await self._require_onboarding_completed_for_active(session, employee_id)
        for field, attr in [
            ("firstName", "first_name"),
            ("lastName", "last_name"),
            ("dateOfBirth", "date_of_birth"),
            ("company", "company"),
            ("department", "department"),
            ("status", "status"),
            ("role", "role"),
            ("phoneNumber", "phone_number"),
            ("jobDescription", "job_description"),
            ("jobRank", "job_rank"),
            ("gender", "gender"),
            ("middleName", "middle_name"),
            ("employmentType", "employment_type"),
        ]:
            if field in body:
                setattr(emp, attr, body[field])
        await self._apply_master_fields(session, emp, body)
        emp.updated_date = datetime.now(timezone.utc)
        await session.flush()
        if "leavePolicyId" in body:
            await assign_or_change_leave_policy(
                session,
                emp,
                body.get("leavePolicyId"),
                actor=actor,
                required=True,
            )
        contact_payload = extract_address_emergency_payload(body)
        if contact_payload:
            await self._apply_profile_payload(session, employee_id, contact_payload)
        return await self._to_dict(session, emp, actor=actor)

    async def patch_employee(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        body: dict,
        *,
        actor: dict | None = None,
    ) -> dict:
        """PATCH merge: profile fields and optional accessFlags / employment access fields."""
        access_only_keys = {
            "accessFlags",
            "role",
            "employmentType",
            "jobRank",
            "jobDescription",
            "startDate",
            "vendorId",
            "reportingManagerId",
            "departmentId",
            "locationId",
            "designationId",
        }
        emp14 = body_has_emp14_fields(body)
        if emp14:
            assert_can_apply_emp14(actor or {})
        before = await snapshot_profile(session, await self._get(session, employee_id))

        update_body = dict(body)
        if "status" in update_body:
            if emp14:
                update_body["status"] = normalize_emp14_status(update_body.get("status"))
            else:
                # Lifecycle statuses belong on /transitions, not generic PATCH.
                update_body.pop("status", None)

        result = await self.update(session, employee_id, update_body, actor=actor)
        if any(k in body for k in access_only_keys):
            result = await self.update_access(session, employee_id, body)

        after = await snapshot_profile(session, await self._get(session, employee_id))
        reason = body.get("reason") or body.get("comments")
        await record_profile_audit(
            session,
            employee_id=employee_id,
            before=before,
            after=after,
            actor=actor,
            reason=str(reason) if reason is not None else None,
        )
        if actor:
            name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
            emp = await self._get(session, employee_id)
            if name:
                emp.updated_by = name
            emp.updated_date = datetime.now(timezone.utc)
            await session.flush()
            result = await self._to_dict(session, await self._get(session, employee_id), actor=actor)
        return result

    async def list_field_audit(
        self,
        session: AsyncSession,
        *,
        employee_id: uuid.UUID | None = None,
        q: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        return await list_profile_audit(
            session,
            employee_id=employee_id,
            q=q,
            from_date=from_date,
            to_date=to_date,
            page=page,
            page_size=page_size,
        )
    async def get_by_id(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        *,
        actor: dict[str, Any] | None = None,
        employees_grant_level: Any = _NOT_LOADED,
    ) -> dict:
        emp = await self._get(session, employee_id)
        return await self._profile_dict(
            session, emp, actor=actor, employees_grant_level=employees_grant_level
        )

    async def _profile_dict(
        self,
        session: AsyncSession,
        emp: Employee,
        *,
        actor: dict[str, Any] | None,
        employees_grant_level: Any = _NOT_LOADED,
    ) -> dict:
        """One employee's full profile; onboarding is a single light select."""
        onboarding = (
            await self._onboarding_by_employee_ids(session, [emp.employee_id])
        ).get(emp.employee_id)
        return await self._to_dict(
            session,
            emp,
            actor=actor,
            onboarding=onboarding,
            invite_meta_loaded=True,
            employees_grant_level=employees_grant_level,
        )

    async def get_by_email(self, session: AsyncSession, email: str) -> dict:
        result = await session.execute(select(Employee).where(Employee.email_id == email))
        emp = result.scalar_one_or_none()
        if emp is None or bool(getattr(emp, "is_system_account", False)):
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee_to_dict(emp)

    async def search(self, session: AsyncSession, q: str) -> list[dict]:
        return await self.list_filtered(session, {}, q=q)

    async def get_role(self, session: AsyncSession, employee_id: uuid.UUID) -> dict:
        emp = await self._get(session, employee_id)
        return {"employeeId": str(emp.employee_id), "department": emp.department, "role": emp.role}

    async def _require_onboarding_completed_for_active(
        self, session: AsyncSession, employee_id: uuid.UUID
    ) -> None:
        """Previously blocked ACTIVE until Onboarding -> Activate completed.

        Disabled while the Onboarding module sits in Awaiting refinement and is
        not part of the Employee demo. Call sites kept so we can re-enable the
        gate without rewriting approve / rehire / status_update paths.
        """
        _ = (session, employee_id)
        return

    async def create(
        self,
        session: AsyncSession,
        body: dict,
        actor: dict,
        *,
        send_invite: bool = True,
    ) -> dict:
        if body.get("asDraft") is True or str(body.get("status") or "").upper() == Status.NEW.value:
            return await self.create_draft(session, body, actor)
        body = normalize_official_email_alias(dict(body))
        self._reject_immutable_identity_fields(body)
        # Hire/create never accepts a caller-chosen role (RBAC later).
        force_create_access_role_employee(body)
        validate_create_required(body)
        validate_common_fields(body, is_create=True)
        leave_policy_id = require_leave_policy_on_body(body)
        email = str(body["emailId"]).strip()
        existing = await session.execute(
            select(Employee.employee_id).where(Employee.email_id == email)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="officialEmail already in use")

        now = datetime.now(timezone.utc)
        actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
        joining_raw = resolve_joining_raw(body)
        if not joining_raw:
            raise HTTPException(
                status_code=400,
                detail="dateOfJoining is required",
            )
        start_date = joining_iso_or_default(joining_raw)
        joining = parse_joining_date(start_date)
        initial_status = status_from_joining_date(joining, today=utc_today())
        employee_code = await self._assign_employee_code(
            session, body, employment_start_date=str(start_date)
        )
        payroll_start_date = resolve_payroll_start_date(
            joining_iso=start_date,
            payroll_raw=body.get("payrollStartDate"),
            employment_type=body.get("employmentType", "FULL_TIME"),
        )
        # New schema: no password / vendor / job_rank / audit columns on employees.
        # emp_id is DB-generated; dates are real Date columns (not strings).
        join_date = parse_joining_date(start_date)
        payroll_date = (
            parse_joining_date(str(payroll_start_date)) if payroll_start_date else None
        )
        dob_raw = body.get("dateOfBirth")
        dob = parse_joining_date(str(dob_raw)) if dob_raw not in (None, "") else None
        # Org FKs must be on the INSERT: Active/Pending rows hit ck_employees_complete_unless_draft.
        dept_id = self._parse_optional_uuid(body.get("departmentId"), "departmentId")
        loc_id = self._parse_optional_uuid(body.get("locationId"), "locationId")
        des_id = self._parse_optional_uuid(body.get("designationId"), "designationId")
        await self._validate_org_fks(
            session,
            department_id=dept_id,
            location_id=loc_id,
            designation_id=des_id,
            check_department=dept_id is not None,
            check_location=loc_id is not None,
            check_designation=des_id is not None,
        )
        work_mode = body.get("workMode") or body.get("work_mode")
        emp = Employee(
            employee_code=employee_code,
            first_name=body["firstName"],
            last_name=body["lastName"],
            middle_name=body.get("middleName"),
            official_email=email,
            personal_email=body.get("personalEmail") or None,
            department_label=body.get("department") or None,
            company_name=resolve_company_for_write(body.get("company"), actor),
            role=body["role"],
            phone_number=body.get("phoneNumber") or None,
            date_of_birth=dob,
            employment_type=body.get("employmentType", "FULL_TIME"),
            work_mode=work_mode,
            status=initial_status,
            date_of_joining=join_date,
            payroll_start_date=payroll_date,
            department_id=dept_id,
            location_id=loc_id,
            designation_id=des_id,
        )
        apply_profile_fields(emp, body)
        # apply_profile_fields may re-assign DOB as an ISO string — keep a real date for Postgres.
        if isinstance(getattr(emp, "date_of_birth", None), str):
            emp.date_of_birth = parse_joining_date(emp.date_of_birth)
        if isinstance(getattr(emp, "date_of_joining", None), str):
            emp.date_of_joining = parse_joining_date(emp.date_of_joining)
        if isinstance(getattr(emp, "payroll_start_date", None), str):
            emp.payroll_start_date = parse_joining_date(emp.payroll_start_date)
        incomplete = [
            label
            for label, ok in (
                ("departmentId", emp.department_id is not None),
                ("locationId", emp.location_id is not None),
                ("designationId", emp.designation_id is not None),
                ("employmentType", bool(emp.employment_type)),
                ("workMode", bool(emp.work_mode)),
                ("dateOfJoining", emp.date_of_joining is not None),
                ("role", bool(emp.role)),
            )
            if not ok
        ]
        if incomplete:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required field(s) for hire: {', '.join(incomplete)}",
            )
        session.add(emp)
        await session.flush()
        await self._apply_master_fields(session, emp, body)
        await session.flush()
        await assign_or_change_leave_policy(
            session,
            emp,
            leave_policy_id,
            actor=actor,
            required=True,
        )
        contact_payload = extract_address_emergency_payload(body)
        if contact_payload:
            await self._apply_profile_payload(session, emp.employee_id, contact_payload)
        # Legacy EMPLOYEE_ONBOARDING table is not in the 37-table schema.
        onboarding = None
        try:
            onboarding = await ensure_onboarding_for_employee(
                session, employee_id=emp.employee_id, actor=actor
            )
        except HTTPException as exc:
            if exc.status_code != 501:
                raise
        try:
            await record_field_change(
                session,
                employee_id=emp.employee_id,
                field_name="lifecycle",
                old_value=None,
                new_value="Created",
                actor=actor,
            )
        except HTTPException as exc:
            if exc.status_code != 501:
                raise
        payload = await self._to_dict(session, emp, actor=actor)
        payload["onboardingId"] = str(onboarding.id) if onboarding is not None else None
        payload["onboardingStatus"] = (
            onboarding.status if onboarding is not None else None
        )
        if send_invite and onboarding is not None:
            await issue_and_send_invite(session, employee=emp, onboarding=onboarding)
        return payload

    async def preview_employee_code(
        self, session: AsyncSession, body: dict
    ) -> dict[str, str]:
        """Read-only next name-based employee_code. No INSERT and no reservation."""
        first = str(body.get("firstName") or "").strip()
        last = str(body.get("lastName") or "").strip()
        if not first or not last:
            raise HTTPException(
                status_code=400, detail="firstName and lastName are required"
            )
        employee_code = await allocate_name_based_employee_code(
            session, first_name=first, last_name=last
        )
        return {"employeeCode": employee_code}

    async def create_draft(self, session: AsyncSession, body: dict, actor: dict) -> dict:
        """EMP-DATA-11: save incomplete hire as NEW with employee_code, no businessEmployeeId."""
        body = normalize_official_email_alias(dict(body))
        self._reject_immutable_identity_fields(body)
        # Hire/create never accepts a caller-chosen role (RBAC later).
        force_create_access_role_employee(body)
        validate_draft_required(body)
        validate_common_fields_for_draft(body)

        now = datetime.now(timezone.utc)
        actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
        draft_id = uuid.uuid4()
        provided_email = str(body.get("emailId") or "").strip()
        if provided_email and not self._is_draft_placeholder_email(provided_email):
            existing = await session.execute(
                select(Employee.employee_id).where(Employee.email_id == provided_email)
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(status_code=400, detail="officialEmail already in use")
            email = provided_email
        else:
            # UNIQUE NOT NULL email — placeholder until Invite (EMP-DATA-9).
            email = f"{_DRAFT_EMAIL_PREFIX}{draft_id.hex}{_DRAFT_EMAIL_DOMAIN}"

        personal = body.get("personalEmail")
        joining_raw = resolve_joining_raw(body)
        start_date = joining_iso_or_default(joining_raw) if joining_raw else "2099-01-01"
        employee_code = await self._assign_employee_code(
            session, body, employment_start_date=str(start_date)
        )
        # New schema: a Draft needs only the name. emp_id is generated by the database (never supplied) and the
        # official email may stay NULL until Invite, so no placeholder address is stored.
        emp = Employee(
            id=draft_id,
            employee_code=employee_code,
            first_name=body["firstName"],
            last_name=body["lastName"],
            middle_name=body.get("middleName"),
            official_email=None if self._is_draft_placeholder_email(email) else email,
            personal_email=personal if personal not in (None, "") else None,
            company_name=resolve_company_for_write(body.get("company"), actor),
            role=body.get("role"),
            employment_type=body.get("employmentType") or None,
            status=Status.NEW.value,
        )
        apply_profile_fields(emp, body)
        session.add(emp)
        await session.flush()
        await self._apply_master_fields(session, emp, body)
        await session.flush()
        if "leavePolicyId" in body:
            await assign_or_change_leave_policy(
                session,
                emp,
                body.get("leavePolicyId"),
                actor=actor,
                required=False,
            )
        contact_payload = extract_address_emergency_payload(body)
        if contact_payload:
            await self._apply_profile_payload(session, emp.employee_id, contact_payload)
        await record_field_change(
            session,
            employee_id=emp.employee_id,
            field_name="lifecycle",
            old_value=None,
            new_value="Created (draft)",
            actor=actor,
        )
        return await self._to_dict(session, emp, actor=actor)

    async def activate_due(
        self, session: AsyncSession, *, actor: dict | None = None
    ) -> dict[str, Any]:
        """Pending → Active when joining date ≤ today.

        Stub for a scheduled job / cron. Call POST /employees/activate-due.
        Full scheduler wiring is deferred. Each activation is audited with the
        calling user, or "system" when a scheduler runs it without one.
        """
        today = utc_today()
        result = await session.execute(
            select(Employee).where(Employee.status == Status.PENDING)
        )
        activated: list[str] = []
        for emp in result.scalars().all():
            joining = parse_joining_date(emp.employment_start_date)
            if status_from_joining_date(joining, today=today) != Status.ACTIVE.value:
                continue
            before_status = str(emp.status or "") or None
            emp.status = Status.ACTIVE
            if not getattr(emp, "payroll_start_date", None):
                emp.payroll_start_date = emp.employment_start_date
            await self._ensure_business_employee_id(session, emp)
            emp.updated_date = datetime.now(timezone.utc)
            await record_field_change(
                session,
                employee_id=emp.employee_id,
                field_name="lifecycle",
                old_value=before_status,
                new_value="Activated",
                actor=actor or SYSTEM_AUDIT_ACTOR,
            )
            activated.append(str(emp.employee_id))
        await session.flush()
        return {
            "activatedCount": len(activated),
            "activatedEmployeeIds": activated,
            "asOf": today.isoformat(),
        }

    async def import_rows(
        self,
        session: AsyncSession,
        rows: list[dict[str, str]],
        actor: dict,
    ) -> dict[str, Any]:
        created: list[dict] = []
        skipped: list[dict[str, Any]] = []
        for index, row in enumerate(rows, start=1):
            email = row["emailId"]
            existing = await session.execute(select(Employee).where(Employee.email_id == email))
            if existing.scalar_one_or_none() is not None:
                skipped.append(
                    {"row": index, "emailId": email, "reason": "email already exists"}
                )
                continue
            body = {
                "firstName": row["firstName"],
                "lastName": row["lastName"],
                "emailId": email,
                "personalEmail": row.get("personalEmail") or email,
                "dateOfBirth": row.get("dateOfBirth") or "1990-01-01",
                "department": row.get("department") or None,
                "company": resolve_company_for_write(row.get("company"), actor),
                "employmentType": row.get("employmentType") or "FULL_TIME",
                "role": row.get("role") or None,
                "dateOfJoining": row.get("dateOfJoining")
                or row.get("employmentStartDate")
                or "2024-01-01",
                "employmentStartDate": row.get("employmentStartDate") or "2024-01-01",
                "jobRank": row.get("jobRank") or None,
                "vendor": row.get("vendor") or None,
                "phoneNumber": row.get("phoneNumber") or "1000000000",
            }
            if row.get("employeeCode"):
                body["employeeCode"] = row["employeeCode"]
            if row.get("leavePolicyId"):
                body["leavePolicyId"] = row["leavePolicyId"]
            created.append(await self.create(session, body, actor, send_invite=False))
        return {
            "createdCount": len(created),
            "skippedCount": len(skipped),
            "created": created,
            "skipped": skipped,
        }

    async def soft_delete(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        *,
        actor: dict | None = None,
    ) -> dict:
        emp = await self._get(session, employee_id)
        if bool(getattr(emp, "is_system_account", False)):
            raise HTTPException(
                status_code=403,
                detail="System accounts cannot be offboarded or deleted",
            )
        before_status = str(emp.status or "") or None
        emp.status = Status.INACTIVE
        await session.flush()
        await record_field_change(
            session,
            employee_id=employee_id,
            field_name="status",
            old_value=before_status,
            new_value=str(emp.status or "") or None,
            actor=actor,
        )
        return employee_to_dict(emp)

    async def list_projects(self, session: AsyncSession, employee_id: uuid.UUID) -> list[dict]:
        result = await session.execute(
            select(EmployeeProjectData).where(EmployeeProjectData.employee_id == employee_id)
        )
        return [project_data_to_dict(p) for p in result.scalars().all()]

    async def add_project(self, session: AsyncSession, employee_id: uuid.UUID, body: dict) -> dict:
        before = await snapshot_projects(session, employee_id)
        row = EmployeeProjectData(
            employee_id=employee_id,
            project_name=body.get("projectName"),
            project_start_date=body.get("projectStartDate"),
            project_end_date=body.get("projectEndDate"),
            project_role=body.get("projectRole"),
            status=body.get("status", Status.ACTIVE),
        )
        session.add(row)
        await session.flush()
        after = await snapshot_projects(session, employee_id)
        await record_profile_audit(
            session,
            employee_id=employee_id,
            before=before,
            after=after,
            actor=None,
        )
        return project_data_to_dict(row)

    async def inactive_list(self, session: AsyncSession) -> list[dict]:
        result = await session.execute(
            select(Employee).where(
                Employee.status == Status.INACTIVE,
                self._directory_employee_clause(),
            )
        )
        return [employee_to_dict(e) for e in result.scalars().all()]

    async def upload_document(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        meta: dict,
        url: str,
        document_id: uuid.UUID | None = None,
        *,
        actor: dict | None = None,
    ) -> dict:
        doc_label = (
            meta.get("documentName")
            or meta.get("fileName")
            or meta.get("documentType")
            or "document"
        )
        doc = EmployeeDocument(
            id=document_id or uuid.uuid4(),
            employee_id=employee_id,
            document_tab=meta.get("documentTab"),
            document_type=meta.get("documentType"),
            document_name=meta.get("documentName") or meta.get("fileName"),
            file_name=meta.get("fileName"),
            url=url,
            status=Status.ACTIVE,
        )
        session.add(doc)
        await session.flush()
        await record_field_change(
            session,
            employee_id=employee_id,
            field_name="document",
            old_value=None,
            new_value=str(doc_label),
            actor=actor,
        )
        return {
            "id": str(doc.id),
            "url": doc.url,
            "objectKey": doc.url,
            "fileName": doc.file_name,
            "documentName": doc.document_name,
            "employeeId": str(employee_id),
            "status": doc.status,
        }

    async def list_documents(self, session: AsyncSession, employee_id: uuid.UUID) -> list[dict]:
        await self._get(session, employee_id)
        result = await session.execute(
            select(EmployeeDocument).where(
                EmployeeDocument.employee_id == employee_id,
                EmployeeDocument.status != Status.INACTIVE,
            )
        )
        rows = result.scalars().all()
        return [
            {
                "id": str(doc.id),
                "employeeId": str(doc.employee_id) if doc.employee_id else None,
                "url": doc.url,
                "objectKey": doc.url,
                "fileName": doc.file_name,
                "documentName": doc.document_name,
                "documentTab": doc.document_tab,
                "documentType": doc.document_type,
                "status": doc.status,
                "createdDate": doc.created_date.isoformat() if doc.created_date else None,
            }
            for doc in rows
        ]

    async def update_access(self, session: AsyncSession, employee_id: uuid.UUID, body: dict) -> dict:
        emp = await self._get(session, employee_id)
        access_body = dict(body)
        apply_synced_access_role_fields(access_body, only_if_present=True)
        if "department" in access_body or "role" in access_body:
            emp.department = access_body["department"]
            emp.role = access_body["role"]

        field_map = [
            ("company", "company"),
            ("jobRank", "job_rank"),
            ("jobDescription", "job_description"),
            ("startDate", "employment_start_date"),
            ("vendorId", "vendor"),
        ]
        for field, attr in field_map:
            if field in body and body[field] is not None:
                setattr(emp, attr, body[field])

        if any(
            key in body
            for key in (
                "employmentType",
                "workerType",
                "workSchedule",
                "employmentCategory",
            )
        ):
            from app.modules.employee.employment_classification import (
                apply_employment_classification,
            )

            apply_employment_classification(emp, access_body)

        await self._apply_master_fields(session, emp, body)
        flags = body.get("accessFlags")
        if isinstance(flags, dict):
            result = await session.execute(
                select(UserAccess).where(UserAccess.employee_id == employee_id)
            )
            access = result.scalar_one_or_none()
            create = bool(flags.get("createAccess", False))
            view = bool(flags.get("viewAccess", False))
            edit = bool(flags.get("editAccess", False))
            full = bool(flags.get("fullAccess", False))
            if access is None:
                session.add(
                    UserAccess(
                        employee_id=employee_id,
                        create_access=create,
                        view_access=view,
                        edit_access=edit,
                        full_access=full,
                        status=Status.ACTIVE.value,
                    )
                )
            else:
                access.create_access = create
                access.view_access = view
                access.edit_access = edit
                access.full_access = full
                access.status = Status.ACTIVE.value

        await session.flush()
        return {
            **employee_to_dict(emp),
            "userAccess": body.get("accessFlags") or body,
        }

    async def rehire(self, session: AsyncSession, email: str, body: dict, *, actor: dict | None = None) -> dict:
        result = await session.execute(select(Employee).where(Employee.email_id == email))
        emp = result.scalar_one_or_none()
        if emp is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        before_status = str(emp.status or "") or None
        await self._require_onboarding_completed_for_active(session, emp.employee_id)
        emp.status = Status.ACTIVE
        if body.get("employmentEndDate"):
            emp.employment_end_date = body["employmentEndDate"]
        await session.flush()
        await record_field_change(
            session,
            employee_id=emp.employee_id,
            field_name="lifecycle",
            old_value=before_status,
            new_value="Rehired",
            actor=actor,
        )
        await record_field_change(
            session,
            employee_id=emp.employee_id,
            field_name="status",
            old_value=before_status,
            new_value=Status.ACTIVE.value,
            actor=actor,
        )
        return await self._to_dict(session, emp)

    async def reactivate(self, session: AsyncSession, email: str, body: dict, *, actor: dict | None = None) -> dict:
        """Compatibility alias for rehire."""
        return await self.rehire(session, email, body, actor=actor)

    async def get_supervisor(self, session: AsyncSession, project_name: str, rank: str) -> list[dict]:
        result = await session.execute(
            select(Employee).where(
                Employee.job_rank == rank,
                Employee.status == Status.ACTIVE,
                self._directory_employee_clause(),
            )
        )
        return [employee_to_dict(e) for e in result.scalars().all()]

    async def by_customer(self, session: AsyncSession, client_id: str) -> list[dict]:
        result = await session.execute(
            select(Employee).where(
                Employee.company == client_id,
                self._directory_employee_clause(),
            )
        )
        return [employee_to_dict(e) for e in result.scalars().all()]

    async def by_vendor(self, session: AsyncSession, vendor_id: str) -> list[dict]:
        result = await session.execute(
            select(Employee).where(
                Employee.vendor == vendor_id,
                self._directory_employee_clause(),
            )
        )
        return [employee_to_dict(e) for e in result.scalars().all()]

    async def by_reporting(self, session: AsyncSession, employee_id: str) -> list[dict]:
        mgr = self._parse_optional_uuid(employee_id, "employeeId")
        result = await session.execute(
            select(Employee).where(
                self._directory_employee_clause(),
                Employee.reporting_manager_id == mgr,
            )
        )
        employees = list(result.scalars().all())
        contacts = await self._contacts_by_employee(session, employees)
        return [
            await self._to_dict(session, e, contact=contacts.get(e.employee_id))
            for e in employees
        ]

    async def has_direct_reports(
        self, session: AsyncSession, employee_id: str
    ) -> bool:
        """True when at least one directory employee reports to this manager."""
        mgr = self._parse_optional_uuid(employee_id, "employeeId")
        if mgr is None:
            return False
        result = await session.execute(
            select(Employee.employee_id)
            .where(
                self._directory_employee_clause(),
                Employee.reporting_manager_id == mgr,
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    def _can_manage_functional_queues(user: dict) -> bool:
        """ESS-DATA-5: HR/ADMIN/SUPERADMIN own Profile/Asset/IT Manage queues."""
        allowed = {r.value for r in ESS_FUNCTIONAL_QUEUE_ROLES}
        return bool(session_access_roles(user).intersection(allowed))

    @staticmethod
    def _requester_display_name(employee: Employee | None) -> str:
        if employee is None:
            return ""
        return f"{employee.first_name or ''} {employee.last_name or ''}".strip()

    @staticmethod
    def _employee_party_payload(employee: Employee | None) -> dict[str, str]:
        if employee is None:
            return {"firstName": "", "lastName": "", "businessEmployeeId": ""}
        business_id = (
            (employee.business_employee_id or "").strip()
            or (employee.employee_code or "").strip()
        )
        return {
            "firstName": (employee.first_name or "").strip(),
            "lastName": (employee.last_name or "").strip(),
            "businessEmployeeId": business_id,
        }

    def _enrich_profile_update_request_dict(
        self, row: ProfileUpdateRequest
    ) -> dict:
        payload = profile_update_request_to_dict(row)
        requester = (
            row.submitted_by_employee
            if isinstance(row.submitted_by_employee_id, uuid.UUID)
            and row.submitted_by_employee is not None
            else row.employee
        )
        payload["requesterName"] = self._requester_display_name(requester)
        payload["subjectName"] = self._requester_display_name(row.employee)
        payload["requester"] = self._employee_party_payload(requester)
        payload["subject"] = self._employee_party_payload(row.employee)
        return payload

    def _enrich_asset_request_dict(self, row: AssetRequest) -> dict:
        payload = asset_request_to_dict(row)
        requester = (
            row.submitted_by_employee
            if isinstance(row.submitted_by_employee_id, uuid.UUID)
            and row.submitted_by_employee is not None
            else row.employee
        )
        payload["requesterName"] = self._requester_display_name(requester)
        payload["subjectName"] = self._requester_display_name(row.employee)
        payload["requester"] = self._employee_party_payload(requester)
        payload["subject"] = self._employee_party_payload(row.employee)
        return payload

    async def manage_counts(self, session: AsyncSession, user: dict) -> dict[str, int]:
        """How many things wait for this person in each Manage tab (for the tab badges)."""
        from app.modules.leave_approvals import service as leave_approvals
        from app.modules.timesheet import week_service

        option = await self.managing_option(session, user)
        counts = {"timesheets": 0, "leaves": 0, "requests": 0}
        if option["hasDirectReports"] or option["canManageTimesheets"]:
            counts["timesheets"] = await week_service.count_waiting(session, user)
        if option["hasDirectReports"] or option["canManageLeaves"]:
            counts["leaves"] = await leave_approvals.count_waiting(session, user)
        if option["canManageProfileUpdates"] or option["canManageAssetRequests"]:
            waiting = ("open", "pending")
            for model in (ProfileUpdateRequest, AssetRequest):
                counts["requests"] += int(
                    (
                        await session.execute(
                            select(func.count())
                            .select_from(model)
                            .where(func.lower(model.status).in_(waiting))
                        )
                    ).scalar_one()
                )
        return counts

    async def managing_option(
        self, session: AsyncSession, user: dict
    ) -> dict[str, bool]:
        """ESS-DATA-1/5: direct-report Manage plus functional queue flags."""
        raw_id = user.get("employeeId")
        if not isinstance(raw_id, str) or not raw_id.strip():
            raise HTTPException(status_code=401, detail="Invalid token")
        can_functional = self._can_manage_functional_queues(user)
        return {
            "hasDirectReports": await self.has_direct_reports(
                session, raw_id.strip()
            ),
            "canManageProfileUpdates": can_functional,
            "canManageAssetRequests": can_functional,
            "canManageItRequests": can_functional,
            # Same roles the timesheet approval queue lets review everyone.
            "canManageTimesheets": bool(
                session_access_roles(user).intersection(
                    {role.value for role in TIMESHEET_ORG_APPROVER_ROLES}
                )
            ),
            "canManageLeaves": bool(
                session_access_roles(user).intersection(
                    {role.value for role in LEAVE_ADMIN_ROLES}
                )
            ),
        }

    async def project_allocation_option(
        self, session: AsyncSession, user: dict
    ) -> dict[str, bool]:
        """True when the caller has at least one active project allocation.

        Covers ALLOCATION rows (internal or client projects) and legacy
        EMPLOYEE_PROJECT_DATA assignments still used for timesheets.
        """
        raw_id = user.get("employeeId")
        if not isinstance(raw_id, str) or not raw_id.strip():
            raise HTTPException(status_code=401, detail="Invalid token")
        try:
            employee_id = uuid.UUID(raw_id.strip())
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid token") from exc

        today = date.today().isoformat()
        alloc = await session.execute(
            select(Allocation.allocation_id)
            .where(
                Allocation.employee_id == employee_id,
                or_(
                    Allocation.end_date.is_(None),
                    Allocation.end_date == "",
                    Allocation.end_date >= today,
                ),
            )
            .limit(1)
        )
        if alloc.scalar_one_or_none() is not None:
            return {"hasActiveAllocation": True}

        legacy = await session.execute(
            select(EmployeeProjectData.id)
            .where(
                EmployeeProjectData.employee_id == employee_id,
                or_(
                    EmployeeProjectData.status.is_(None),
                    func.upper(EmployeeProjectData.status) == "ACTIVE",
                ),
                or_(
                    EmployeeProjectData.project_end_date.is_(None),
                    EmployeeProjectData.project_end_date == "",
                    EmployeeProjectData.project_end_date >= today,
                ),
            )
            .limit(1)
        )
        return {"hasActiveAllocation": legacy.scalar_one_or_none() is not None}

    def _require_functional_queue_access(self, user: dict) -> None:
        if not self._can_manage_functional_queues(user):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    async def list_manage_profile_update_requests(
        self,
        session: AsyncSession,
        user: dict,
    ) -> list[dict]:
        """ESS-DATA-5: HR staff read-only queue of all profile update requests."""
        self._require_functional_queue_access(user)
        result = await session.execute(
            select(ProfileUpdateRequest)
            .options(
                selectinload(ProfileUpdateRequest.employee),
                selectinload(ProfileUpdateRequest.submitted_by_employee),
            )
            .order_by(ProfileUpdateRequest.requested_date.desc())
        )
        items: list[dict] = []
        for row in result.scalars().all():
            items.append(self._enrich_profile_update_request_dict(row))
        return items

    async def complete_profile_update_request(
        self,
        session: AsyncSession,
        user: dict,
        request_id: uuid.UUID,
        body: dict[str, Any],
    ) -> dict:
        """Mark a profile update request Completed and notify submitter/subject."""
        from app.modules.employee.profile_update_notify import (
            notify_profile_update_completed,
        )

        self._require_functional_queue_access(user)
        result = await session.execute(
            select(ProfileUpdateRequest)
            .options(
                selectinload(ProfileUpdateRequest.employee),
                selectinload(ProfileUpdateRequest.submitted_by_employee),
            )
            .where(ProfileUpdateRequest.id == request_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Request not found")
        if (row.status or "").strip().lower() in {
            "completed",
            "closed",
            "approved",
            "rejected",
        }:
            raise HTTPException(
                status_code=400, detail="Request is already completed"
            )

        changes_summary = str(
            body.get("changesSummary")
            or body.get("changes_summary")
            or body.get("completionNotes")
            or body.get("completion_notes")
            or ""
        ).strip()

        now = datetime.now(timezone.utc)
        row.status = "Completed"
        row.updated_date = now
        await session.flush()

        subject = row.employee
        requester = (
            row.submitted_by_employee
            if isinstance(row.submitted_by_employee_id, uuid.UUID)
            and row.submitted_by_employee is not None
            else row.employee
        )
        await notify_profile_update_completed(
            requester=requester,
            subject=subject,
            request=row,
            changes_summary=changes_summary,
        )
        payload = profile_update_request_to_dict(row)
        payload["requesterName"] = self._requester_display_name(requester)
        payload["subjectName"] = self._requester_display_name(subject)
        payload["requester"] = self._employee_party_payload(requester)
        payload["subject"] = self._employee_party_payload(subject)
        return payload

    def _normalize_request_decision(self, body: dict[str, Any]) -> tuple[str, str]:
        action = str(body.get("action") or "").strip().lower()
        if action not in {"approve", "reject"}:
            raise HTTPException(
                status_code=400, detail="action must be approve or reject"
            )
        notes = str(
            body.get("notes")
            or body.get("changesSummary")
            or body.get("changes_summary")
            or ""
        ).strip()
        if action == "reject" and not notes:
            raise HTTPException(
                status_code=400, detail="notes are required when rejecting"
            )
        return action, notes

    @staticmethod
    def _request_is_decided(status: str | None) -> bool:
        return (status or "").strip().lower() in {
            "completed",
            "closed",
            "approved",
            "rejected",
        }

    async def decide_profile_update_request(
        self,
        session: AsyncSession,
        user: dict,
        request_id: uuid.UUID,
        body: dict[str, Any],
    ) -> dict:
        """Approve or reject a profile update request from the Manage queue."""
        from app.modules.employee.profile_update_notify import (
            notify_profile_update_completed,
        )

        self._require_functional_queue_access(user)
        action, notes = self._normalize_request_decision(body)
        result = await session.execute(
            select(ProfileUpdateRequest)
            .options(
                selectinload(ProfileUpdateRequest.employee),
                selectinload(ProfileUpdateRequest.submitted_by_employee),
            )
            .where(ProfileUpdateRequest.id == request_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Request not found")
        if self._request_is_decided(row.status):
            raise HTTPException(
                status_code=400, detail="Request is already decided"
            )

        from app.modules.employee.request_decision_notify import (
            notify_request_decision,
        )
        from app.modules.employee.request_decisions import (
            actor_display_name,
            apply_profile_change,
            log_decision,
            record_decision,
        )
        from app.modules.workflow.events import ITEM_PROFILE_UPDATE

        now = datetime.now(timezone.utc)
        applied = False
        if action == "approve":
            # A structured change (name, date of birth, nationality) is written
            # to the employee now, and audited, so nobody re-types it.
            applied = await apply_profile_change(session, user, row)
        row.status = "Approved" if action == "approve" else "Rejected"
        row.updated_date = now
        record_decision(row, user, notes)
        log_decision(
            session,
            ITEM_PROFILE_UPDATE,
            row,
            user,
            approved=action == "approve",
            note=notes,
        )
        await session.flush()

        subject = row.employee
        requester = (
            row.submitted_by_employee
            if isinstance(row.submitted_by_employee_id, uuid.UUID)
            and row.submitted_by_employee is not None
            else row.employee
        )
        if action == "approve":
            await notify_profile_update_completed(
                requester=requester,
                subject=subject,
                request=row,
                changes_summary=notes
                or ("Your profile was updated." if applied else ""),
            )
        summary = (row.short_description or row.new_value or "Profile update").strip()
        if row.field_changed != "general":
            summary = f"{row.field_changed}: {row.old_value or '—'} → {row.new_value}"
        await notify_request_decision(
            kind="profile",
            decision="approved" if action == "approve" else "rejected",
            requester=requester,
            subject=subject,
            request_id=row.id,
            request_type="Profile update",
            summary=summary[:200],
            decided_by=actor_display_name(user),
            decided_by_email=str(user.get("email") or user.get("emailId") or ""),
            comment=notes,
            send_to_requester=action == "reject",
        )
        payload = profile_update_request_to_dict(row)
        payload["requesterName"] = self._requester_display_name(requester)
        payload["subjectName"] = self._requester_display_name(subject)
        payload["requester"] = self._employee_party_payload(requester)
        payload["subject"] = self._employee_party_payload(subject)
        return payload

    async def list_manage_asset_requests(
        self,
        session: AsyncSession,
        user: dict,
    ) -> list[dict]:
        """ESS-DATA-5: HR staff read-only queue of all asset requests."""
        self._require_functional_queue_access(user)
        result = await session.execute(
            select(AssetRequest)
            .options(
                selectinload(AssetRequest.employee),
                selectinload(AssetRequest.submitted_by_employee),
                selectinload(AssetRequest.requested_category),
            )
            .order_by(AssetRequest.requested_date.desc())
        )
        items: list[dict] = []
        for row in result.scalars().all():
            items.append(self._enrich_asset_request_dict(row))
        return items

    async def decide_asset_request(
        self,
        session: AsyncSession,
        user: dict,
        request_id: uuid.UUID,
        body: dict[str, Any],
    ) -> dict:
        """Approve or reject an asset request from the Manage queue."""
        self._require_functional_queue_access(user)
        action, _notes = self._normalize_request_decision(body)
        result = await session.execute(
            select(AssetRequest)
            .options(
                selectinload(AssetRequest.employee),
                selectinload(AssetRequest.submitted_by_employee),
                selectinload(AssetRequest.requested_category),
            )
            .where(AssetRequest.id == request_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Request not found")
        if self._request_is_decided(row.status):
            raise HTTPException(
                status_code=400, detail="Request is already decided"
            )
        from app.modules.employee.request_decision_notify import (
            notify_request_decision,
        )
        from app.modules.employee.request_decisions import (
            REQUEST_TYPE_LABELS,
            actor_display_name,
            fulfil_asset_request,
            log_decision,
            record_decision,
        )
        from app.modules.workflow.events import ITEM_ASSET_REQUEST

        outcome = None
        if action == "approve":
            # Do the work in Assets first; if it fails nothing is approved.
            outcome = await fulfil_asset_request(session, user, row, body)
        row.status = "Approved" if action == "approve" else "Rejected"
        row.updated_date = datetime.now(timezone.utc)
        record_decision(row, user, _notes)
        log_decision(
            session,
            ITEM_ASSET_REQUEST,
            row,
            user,
            approved=action == "approve",
            note=_notes,
        )
        await session.flush()

        requester = (
            row.submitted_by_employee
            if isinstance(row.submitted_by_employee_id, uuid.UUID)
            and row.submitted_by_employee is not None
            else row.employee
        )
        category = row.requested_category.category_name if row.requested_category else None
        summary = (row.new_asset_details or category or "").strip()
        await notify_request_decision(
            kind="asset",
            decision="approved" if action == "approve" else "rejected",
            requester=requester,
            subject=row.employee,
            request_id=row.id,
            request_type=REQUEST_TYPE_LABELS.get(row.request_type, row.request_type),
            summary=(f"{category}: {summary}" if category and summary else summary)[:200],
            decided_by=actor_display_name(user),
            decided_by_email=str(user.get("email") or user.get("emailId") or ""),
            comment=_notes,
            outcome=outcome,
            # Assets already emails the employee (assigned, swapped, lost) and,
            # for a loss, the asset managers, so those are not told twice.
            subject_already_emailed=action == "approve",
            managers_already_emailed=(
                action == "approve" and row.request_type == "reportLostStolen"
            ),
        )
        return self._enrich_asset_request_dict(row)

    async def list_available_assets_for_request(
        self,
        session: AsyncSession,
        user: dict,
        request_id: uuid.UUID,
    ) -> list[dict]:
        """In Stock assets that could fulfil a new or swap request (manager picks one)."""
        from app.modules.employee.request_decisions import available_assets_for_request

        self._require_functional_queue_access(user)
        row = (
            await session.execute(
                select(AssetRequest).where(AssetRequest.id == request_id)
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Request not found")
        return await available_assets_for_request(session, row)

    async def list_manage_it_requests(
        self,
        session: AsyncSession,
        user: dict,
    ) -> list[dict]:
        """ESS-DATA-5: HR staff read-only queue of all IT requests."""
        self._require_functional_queue_access(user)
        result = await session.execute(
            select(ITRequest)
            .options(selectinload(ITRequest.employee))
            .order_by(ITRequest.requested_date.desc())
        )
        items: list[dict] = []
        for row in result.scalars().all():
            payload = it_request_to_dict(row)
            payload["requesterName"] = self._requester_display_name(row.employee)
            items.append(payload)
        return items

    async def draft(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        body: dict,
        *,
        actor: dict | None = None,
    ) -> dict:
        """Update an in-progress draft (status stays NEW). employee_code is never regenerated."""
        emp = await self._get(session, employee_id)
        if str(emp.status) not in {Status.NEW.value, Status.PENDING.value}:
            raise HTTPException(
                status_code=400,
                detail="draft updates are only allowed for NEW or PENDING employees",
            )
        body = normalize_official_email_alias(dict(body))
        self._reject_immutable_identity_fields(body)
        # Hire/draft updates never accept a caller-chosen role (RBAC later).
        force_create_access_role_employee(body)
        # Keep stub identity required on every draft save.
        merged = {
            "firstName": body.get("firstName", emp.first_name),
            "lastName": body.get("lastName", emp.last_name),
            "dateOfBirth": body.get("dateOfBirth", emp.date_of_birth),
        }
        validate_draft_required(merged)
        validate_common_fields_for_draft({**merged, **body})

        # EMP-DATA-9: do not persist official email on draft unless a real value is sent.
        if "emailId" in body:
            email = str(body.get("emailId") or "").strip()
            if not email or self._is_draft_placeholder_email(email):
                body = {k: v for k, v in body.items() if k != "emailId"}
            else:
                existing = await session.execute(
                    select(Employee.employee_id).where(
                        Employee.email_id == email,
                        Employee.employee_id != employee_id,
                    )
                )
                if existing.scalar_one_or_none() is not None:
                    raise HTTPException(status_code=400, detail="officialEmail already in use")
                emp.email_id = email

        for field, attr in [
            ("firstName", "first_name"),
            ("lastName", "last_name"),
            ("dateOfBirth", "date_of_birth"),
            ("company", "company"),
            ("department", "department"),
            ("role", "role"),
            ("phoneNumber", "phone_number"),
            ("jobDescription", "job_description"),
            ("jobRank", "job_rank"),
            ("gender", "gender"),
            ("middleName", "middle_name"),
            ("employmentType", "employment_type"),
        ]:
            if field in body:
                setattr(emp, attr, body[field])
        if "personalEmail" in body:
            emp.personal_email = body.get("personalEmail")
        joining_raw = resolve_joining_raw(body)
        if joining_raw:
            emp.employment_start_date = joining_iso_or_default(joining_raw)
        apply_profile_fields(emp, body)
        await self._apply_master_fields(session, emp, body)
        emp.status = Status.NEW.value
        emp.updated_date = datetime.now(timezone.utc)
        if actor:
            actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
            if actor_name:
                emp.updated_by = actor_name
        await session.flush()
        if "leavePolicyId" in body:
            await assign_or_change_leave_policy(
                session,
                emp,
                body.get("leavePolicyId"),
                actor=actor,
                required=False,
            )
        contact_payload = extract_address_emergency_payload(body)
        if contact_payload:
            await self._apply_profile_payload(session, employee_id, contact_payload)
        return await self._to_dict(session, emp, actor=actor)

    async def invite_draft(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        body: dict,
        *,
        actor: dict,
    ) -> dict:
        """Complete a NEW draft → PENDING/ACTIVE invite. Retains employee_code; no business id yet."""
        emp = await self._get(session, employee_id)
        if str(emp.status) != Status.NEW.value:
            raise HTTPException(
                status_code=400,
                detail="invite is only allowed for NEW draft employees",
            )
        body = normalize_official_email_alias(dict(body))
        self._reject_immutable_identity_fields(body)
        # Hire/invite never accepts a caller-chosen role (RBAC later).
        force_create_access_role_employee(body)
        # Merge existing draft fields so Invite can send only the missing required ones.
        merged = {
            "firstName": body.get("firstName", emp.first_name),
            "lastName": body.get("lastName", emp.last_name),
            "dateOfBirth": body.get("dateOfBirth", emp.date_of_birth),
            "personalEmail": body.get("personalEmail", emp.personal_email),
            "phoneNumber": body.get("phoneNumber", emp.phone_number),
            "emailId": (
                str(
                    body.get("emailId")
                    or body.get("officialEmail")
                    or body.get("workEmail")
                    or ""
                ).strip()
                or None
            ),
            "dateOfJoining": resolve_joining_raw(body) or emp.employment_start_date,
            "employmentType": body.get("employmentType", emp.employment_type),
            "department": body["department"],
            "role": body["role"],
            "company": body.get("company", emp.company),
        }
        if not merged.get("emailId") or self._is_draft_placeholder_email(str(merged.get("emailId"))):
            if self._is_draft_placeholder_email(emp.email_id):
                raise HTTPException(
                    status_code=400,
                    detail="officialEmail/emailId is required to invite",
                )
            merged["emailId"] = emp.email_id
        # Invite panel fields: identity + official email (personal email → Flow 2).
        for key in ("firstName", "lastName", "dateOfBirth", "emailId"):
            if not str(merged.get(key) or "").strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field(s) for invite: {key}",
                )
        validate_common_fields(merged, is_create=True)
        leave_policy_id = require_leave_policy_on_body(
            {**merged, **body}, existing=emp
        )
        if not merged.get("phoneNumber"):
            merged["phoneNumber"] = emp.phone_number

        email = str(merged["emailId"]).strip()
        existing = await session.execute(
            select(Employee.employee_id).where(
                Employee.email_id == email,
                Employee.employee_id != employee_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="officialEmail already in use")

        for field, attr in [
            ("firstName", "first_name"),
            ("lastName", "last_name"),
            ("dateOfBirth", "date_of_birth"),
            ("personalEmail", "personal_email"),
            ("phoneNumber", "phone_number"),
            ("department", "department"),
            ("role", "role"),
            ("company", "company"),
            ("employmentType", "employment_type"),
            ("jobDescription", "job_description"),
            ("jobRank", "job_rank"),
            ("middleName", "middle_name"),
            ("gender", "gender"),
        ]:
            if field in body or field in merged:
                value = body.get(field, merged.get(field))
                if value is not None:
                    setattr(emp, attr, value)

        emp.email_id = email
        joining_raw = resolve_joining_raw(merged)
        start_date = joining_iso_or_default(joining_raw)
        joining = parse_joining_date(start_date)
        emp.employment_start_date = start_date
        emp.payroll_start_date = resolve_payroll_start_date(
            joining_iso=start_date,
            payroll_raw=body.get("payrollStartDate"),
            employment_type=body.get("employmentType", emp.employment_type),
        )
        emp.status = status_from_joining_date(joining, today=utc_today())
        if body.get("password"):
            emp.password = hash_password(str(body.get("password")))
        apply_profile_fields(emp, {**merged, **body})
        await self._apply_master_fields(session, emp, {**merged, **body})
        # EMP-DATA-2: business employee id only when Active (final), never on draft.
        await self._ensure_business_employee_id(session, emp)
        emp.updated_date = datetime.now(timezone.utc)
        actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
        if actor_name:
            emp.updated_by = actor_name
        await session.flush()
        await assign_or_change_leave_policy(
            session,
            emp,
            leave_policy_id,
            actor=actor,
            required=True,
        )
        contact_payload = extract_address_emergency_payload(body)
        if contact_payload:
            await self._apply_profile_payload(session, employee_id, contact_payload)
        onboarding = await ensure_onboarding_for_employee(
            session, employee_id=emp.employee_id, actor=actor
        )
        payload = await self._to_dict(session, emp, actor=actor)
        payload["onboardingId"] = str(onboarding.id)
        payload["onboardingStatus"] = onboarding.status
        await issue_and_send_invite(session, employee=emp, onboarding=onboarding)
        return payload

    async def resend_invite(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        *,
        actor: dict,
    ) -> dict:
        """Re-issue invite email for employees who have not accepted yet.

        Allowed for ACTIVE/PENDING/etc. (not NEW drafts — use invite). Regenerates
        a new token hash; SMTP failure rolls back via ``issue_and_send_invite``.
        """
        emp = await self._get(session, employee_id)
        status_val = str(emp.status or "")
        if status_val == Status.NEW.value:
            raise HTTPException(
                status_code=400,
                detail="resend_invite is not allowed for NEW drafts; use invite",
            )
        if status_val in _RESEND_INVITE_BLOCKED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot resend invite for employee with status {status_val}",
            )
        if bool(getattr(emp, "password", None)):
            raise HTTPException(
                status_code=400,
                detail="Employee already has a login password; invite was accepted or set",
            )
        onboarding = await ensure_onboarding_for_employee(
            session, employee_id=emp.employee_id, actor=actor
        )
        if onboarding.invite_accepted_at is not None:
            raise HTTPException(
                status_code=400,
                detail="Invite has already been accepted",
            )
        payload = await self._to_dict(
            session, emp, actor=actor, onboarding=onboarding, invite_meta_loaded=True
        )
        payload["onboardingId"] = str(onboarding.id)
        payload["onboardingStatus"] = onboarding.status
        await issue_and_send_invite(session, employee=emp, onboarding=onboarding)
        # Refresh invite timestamps after successful issue (still pre-commit).
        payload.update(self._invite_meta_payload(emp, onboarding))
        return payload

    async def offboard(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        end_date: str,
        *,
        actor: dict | None = None,
    ) -> dict:
        emp = await self._get(session, employee_id)
        if bool(getattr(emp, "is_system_account", False)):
            raise HTTPException(
                status_code=403,
                detail="System accounts cannot be offboarded or deleted",
            )
        before_status = str(emp.status or "") or None
        emp.status = Status.INACTIVE
        emp.employment_end_date = end_date
        await session.flush()
        await record_field_change(
            session,
            employee_id=employee_id,
            field_name="lifecycle",
            old_value=before_status,
            new_value="Offboarded",
            actor=actor,
        )
        await record_field_change(
            session,
            employee_id=employee_id,
            field_name="status",
            old_value=before_status,
            new_value=Status.INACTIVE.value,
            actor=actor,
        )
        return employee_to_dict(emp)

    async def delete_with_end_date(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        end_date: str,
        *,
        actor: dict | None = None,
    ) -> dict:
        """Compatibility alias for offboard (DELETE /employees/{id})."""
        return await self.offboard(session, employee_id, end_date, actor=actor)

    async def by_vendor_name(self, session: AsyncSession, vendor_name: str) -> list[dict]:
        result = await session.execute(select(Employee).where(Employee.vendor == vendor_name))
        return [employee_to_dict(e) for e in result.scalars().all()]

    async def update_project(self, session: AsyncSession, project_id: uuid.UUID, end_date: str) -> dict:
        result = await session.execute(select(EmployeeProjectData).where(EmployeeProjectData.id == project_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Project assignment not found")
        row.project_end_date = end_date
        row.status = Status.INACTIVE
        await session.flush()
        return project_data_to_dict(row)

    async def delete_project(self, session: AsyncSession, project_id: uuid.UUID, end_date: str) -> dict:
        return await self.update_project(session, project_id, end_date)

    async def add_lead_to_project(self, session: AsyncSession, project_id: uuid.UUID) -> dict:
        result = await session.execute(select(EmployeeProjectData).where(EmployeeProjectData.id == project_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Project assignment not found")
        row.project_role = "LEAD"
        await session.flush()
        return project_data_to_dict(row)

    async def by_project(self, session: AsyncSession, project_id: str) -> list[dict]:
        result = await session.execute(select(EmployeeProjectData).where(EmployeeProjectData.project_name == project_id))
        return [project_data_to_dict(p) for p in result.scalars().all()]

    async def get_document_by_object_key(
        self, session: AsyncSession, object_key: str
    ) -> EmployeeDocument:
        key = (object_key or "").strip()
        if not key:
            raise HTTPException(status_code=404, detail="Document not found")
        result = await session.execute(
            select(EmployeeDocument).where(
                EmployeeDocument.url == key,
                EmployeeDocument.status != Status.INACTIVE,
            )
        )
        doc = result.scalar_one_or_none()
        if doc is None or doc.employee_id is None:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc

    async def download_document(self, session: AsyncSession, file_path: str, file_name: str) -> dict:
        doc = await self.get_document_by_object_key(session, file_path)
        return {
            "filePath": doc.url,
            "fileName": file_name or doc.file_name or "download",
            "employeeId": str(doc.employee_id),
            "id": str(doc.id),
        }

    async def set_avatar(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        object_key: str,
        *,
        actor: dict | None = None,
    ) -> dict:
        emp = await self._get(session, employee_id)
        before = await snapshot_profile(session, emp)
        previous = emp.avatar_object_key
        emp.avatar_object_key = object_key
        await session.flush()
        after = await snapshot_profile(session, await self._get(session, employee_id))
        await record_profile_audit(
            session,
            employee_id=employee_id,
            before=before,
            after=after,
            actor=actor,
        )
        return {
            "employeeId": str(employee_id),
            "avatarObjectKey": object_key,
            "photoUrl": object_key,
            "previousObjectKey": previous,
        }

    async def clear_avatar(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        *,
        actor: dict | None = None,
    ) -> dict:
        emp = await self._get(session, employee_id)
        before = await snapshot_profile(session, emp)
        previous = emp.avatar_object_key
        emp.avatar_object_key = None
        await session.flush()
        after = await snapshot_profile(session, await self._get(session, employee_id))
        await record_profile_audit(
            session,
            employee_id=employee_id,
            before=before,
            after=after,
            actor=actor,
        )
        return {
            "employeeId": str(employee_id),
            "avatarObjectKey": None,
            "photoUrl": None,
            "previousObjectKey": previous,
        }

    async def tasks(self, session: AsyncSession) -> list[dict]:
        pending = await session.execute(
            select(Employee).where(
                Employee.status.in_((Status.NEW, Status.PENDING))
            )
        )
        rows = pending.scalars().all()
        return [{"type": "employee_onboarding", "count": len(rows)}]

    async def pending_approvals(self, session: AsyncSession) -> list[dict]:
        result = await session.execute(
            select(Employee).where(
                Employee.status.in_((Status.NEW, Status.PENDING))
            )
        )
        return [employee_to_dict(e) for e in result.scalars().all()]

    async def reset_password(self, session: AsyncSession, user: dict, password: str, temp_password: str) -> dict:
        emp = await self._get(session, uuid.UUID(user["employeeId"]))
        if not verify_password(temp_password, emp.password):
            raise HTTPException(status_code=401, detail="Invalid temporary password")
        emp.password = hash_password(password)
        await session.flush()
        return {"message": "Password updated"}

    async def forgot_password(self, session: AsyncSession, email: str) -> dict:
        # Stub: no email is sent. Public forgot-password UI is deferred;
        # password recovery is admin-driven (manual reset) until SMTP reset
        # mail is implemented as a real flow (not a silent button).
        result = await session.execute(select(Employee).where(Employee.email_id == email))
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {"message": "Password reset email sent (stub)"}

    async def onboard_super_admin(self, session: AsyncSession) -> dict:
        existing = await session.execute(
            select(Employee).where(Employee.department == Role.SUPERADMIN.value)
        )
        if existing.scalar_one_or_none():
            return {"message": "Super admin already exists"}
        now = datetime.now(timezone.utc)
        start_date = "2024-01-01"
        employee_code = await allocate_employee_code(
            session,
            dept_token=normalize_dept_token(department_legacy=Role.SUPERADMIN.value),
            year=join_year_from(start_date),
        )
        department, role = sync_access_role_fields(
            Role.SUPERADMIN.value, Role.SUPERADMIN.value
        )
        emp = Employee(
            first_name="Super",
            last_name="Admin",
            email_id="superadmin@example.com",
            department=department,
            role=role,
            company="EAOVA",
            employment_type="FULL_TIME",
            status=Status.ACTIVE,
            employment_start_date=start_date,
            employee_code=employee_code,
            password=hash_password("Admin123!"),
            created_by="system",
            updated_by="system",
            created_date=now,
            updated_date=now,
        )
        session.add(emp)
        await session.flush()
        return employee_to_dict(emp)

    async def approve(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        *,
        actor: dict | None = None,
    ) -> dict:
        """Set employee ACTIVE (onboarding completion gate currently disabled)."""
        emp = await self._get(session, employee_id)
        before_status = str(emp.status or "") or None
        await self._require_onboarding_completed_for_active(session, employee_id)
        emp = await self._get(session, employee_id)
        if emp.status != Status.ACTIVE:
            emp.status = Status.ACTIVE
            emp.updated_date = datetime.now(timezone.utc)
            if not getattr(emp, "payroll_start_date", None):
                emp.payroll_start_date = emp.employment_start_date
            await self._ensure_business_employee_id(session, emp)
            await session.flush()
            await record_field_change(
                session,
                employee_id=employee_id,
                field_name="status",
                old_value=before_status,
                new_value=Status.ACTIVE.value,
                actor=actor,
            )
        return await self._to_dict(session, emp)

    async def reject(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        comments: str,
        *,
        actor: dict | None = None,
    ) -> dict:
        emp = await self._get(session, employee_id)
        before_status = str(emp.status or "") or None
        emp.status = Status.INACTIVE
        if actor:
            name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
            if name:
                emp.updated_by = name
        await session.flush()
        await record_field_change(
            session,
            employee_id=employee_id,
            field_name="status",
            old_value=before_status,
            new_value=Status.INACTIVE.value,
            actor=actor,
        )
        return {"employeeId": str(employee_id), "comments": comments, "status": emp.status}

    async def _assert_no_direct_reports_for_hard_delete(
        self, session: AsyncSession, employee_id: uuid.UUID
    ) -> None:
        """Block hard-delete while anyone still lists this employee as manager."""
        rows = (
            await session.execute(
                select(Employee.first_name, Employee.last_name)
                .where(Employee.reporting_manager_id == employee_id)
                .order_by(Employee.first_name, Employee.last_name)
            )
        ).all()
        if not rows:
            return
        count = len(rows)
        names = [
            f"{(first or '').strip()} {(last or '').strip()}".strip() or "Unknown"
            for first, last in rows[:5]
        ]
        preview = ", ".join(names)
        if count > 5:
            preview = f"{preview}, and {count - 5} more"
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot permanently delete this employee because {count} "
                f"employee(s) still report to them ({preview}). Reassign those "
                f"employees to another manager, then try deleting again."
            ),
        )

    async def _assert_not_department_head_for_hard_delete(
        self, session: AsyncSession, employee_id: uuid.UUID
    ) -> None:
        """Block hard-delete while this employee is still a department head."""
        rows = (
            await session.execute(
                select(Department.department_name)
                .where(Department.department_head_id == employee_id)
                .order_by(Department.department_name)
            )
        ).all()
        if not rows:
            return
        names = [(row[0] or "").strip() or "Unknown" for row in rows]
        count = len(names)
        preview = ", ".join(names[:5])
        if count > 5:
            preview = f"{preview}, and {count - 5} more"
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot permanently delete this employee because they are the "
                f"head of {count} department(s) ({preview}). Assign another "
                f"department head first, then try deleting again."
            ),
        )

    async def cascade_delete(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        *,
        actor: dict | None = None,
    ) -> dict:
        """Permanently remove a NEW (draft) employee and owned related rows.

        Hard-delete is only for abandoned hire drafts. For hired employees use
        offboard. Blocks with 409 while other employees still
        report to this person or they remain a department head.
        """
        emp = await self._get(session, employee_id)
        if bool(getattr(emp, "is_system_account", False)):
            raise HTTPException(
                status_code=403,
                detail="System accounts cannot be offboarded or deleted",
            )
        if str(emp.status or "") != Status.NEW.value:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Hard-delete is only allowed for NEW drafts. "
                    "Offboard hired employees instead."
                ),
            )

        before_status = str(emp.status or "") or None
        await record_field_change(
            session,
            employee_id=employee_id,
            field_name="lifecycle",
            old_value=before_status,
            new_value="Deleted",
            actor=actor,
        )

        eid = employee_id
        await self._assert_no_direct_reports_for_hard_delete(session, eid)
        await self._assert_not_department_head_for_hard_delete(session, eid)

        # Non-blocking inbound link (not a reporting hierarchy FK).
        await session.execute(
            update(EmergencyContact)
            .where(EmergencyContact.linked_employee_id == eid)
            .values(linked_employee_id=None)
        )

        # Owned child rows (dependency order matters).
        await session.execute(delete(AuthSession).where(AuthSession.employee_id == eid))
        await session.execute(delete(UserAccess).where(UserAccess.employee_id == eid))
        await session.execute(delete(EmployeeSkill).where(EmployeeSkill.employee_id == eid))
        await session.execute(
            delete(EmployeeDocument).where(EmployeeDocument.employee_id == eid)
        )
        await session.execute(delete(Address).where(Address.employee_id == eid))
        await session.execute(
            delete(EmergencyContact).where(EmergencyContact.employee_id == eid)
        )
        await session.execute(
            delete(EmployeeProfileChange).where(EmployeeProfileChange.employee_id == eid)
        )
        await session.execute(
            delete(CorrectionRequest).where(CorrectionRequest.employee_id == eid)
        )
        await session.execute(
            delete(EmployeeProjectData).where(EmployeeProjectData.employee_id == eid)
        )

        timesheet_ids = (
            await session.execute(
                select(Timesheet.timesheet_id).where(Timesheet.employee_id == eid)
            )
        ).scalars().all()
        if timesheet_ids:
            await session.execute(
                delete(TimesheetDetails).where(
                    TimesheetDetails.timesheet_id.in_(timesheet_ids)
                )
            )
            await session.execute(delete(Timesheet).where(Timesheet.employee_id == eid))

        onboarding_ids = (
            await session.execute(
                select(EmployeeOnboarding.id).where(
                    EmployeeOnboarding.employee_id == eid
                )
            )
        ).scalars().all()
        if onboarding_ids:
            await session.execute(
                delete(OnboardingActivity).where(
                    OnboardingActivity.onboarding_id.in_(onboarding_ids)
                )
            )

        await session.execute(
            delete(EmployeeLeaveOpening).where(EmployeeLeaveOpening.employee_id == eid)
        )
        await session.execute(
            update(EmployeeBankAccount)
            .where(EmployeeBankAccount.employee_id == eid)
            .values(proof_document_id=None)
        )
        bank_ids = (
            await session.execute(
                select(EmployeeBankAccount.id).where(
                    EmployeeBankAccount.employee_id == eid
                )
            )
        ).scalars().all()
        if bank_ids:
            await session.execute(
                delete(BankVerificationAttempt).where(
                    BankVerificationAttempt.bank_account_id.in_(bank_ids)
                )
            )
            await session.execute(
                delete(EmployeeBankAccount).where(EmployeeBankAccount.employee_id == eid)
            )
        await session.execute(
            update(ComplianceDocument)
            .where(ComplianceDocument.employee_id == eid)
            .values(checklist_item_id=None)
        )
        await session.execute(
            delete(ComplianceDocument).where(ComplianceDocument.employee_id == eid)
        )
        if onboarding_ids:
            await session.execute(
                delete(OnboardingChecklistItem).where(
                    OnboardingChecklistItem.onboarding_id.in_(onboarding_ids)
                )
            )
            await session.execute(
                delete(EmployeeOnboarding).where(EmployeeOnboarding.employee_id == eid)
            )

        # Keep audit history (denormalized name/code already stored). Existing DBs
        # often still have NO ACTION on this FK, so ON DELETE SET NULL never runs
        # and discard/hard-delete 409s on the "Deleted" row written above.
        await session.execute(
            update(EmployeeFieldAudit)
            .where(EmployeeFieldAudit.employee_id == eid)
            .values(employee_id=None)
        )

        try:
            await session.delete(emp)
            await session.flush()
        except IntegrityError as exc:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cannot permanently delete this employee because related "
                    "records still reference them. Reassign their reports, "
                    "settle or remove payroll/expenses/vendor invoices, and "
                    "clear other links (or offboard instead), then try again."
                ),
            ) from exc
        return {"message": "Employee deleted"}

    async def get_active_document(
        self, session: AsyncSession, doc_id: uuid.UUID
    ) -> EmployeeDocument:
        result = await session.execute(select(EmployeeDocument).where(EmployeeDocument.id == doc_id))
        doc = result.scalar_one_or_none()
        if doc is None or doc.status == Status.INACTIVE:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc.employee_id is None:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc

    async def delete_document(self, session: AsyncSession, doc_id: uuid.UUID) -> dict:
        doc = await self.get_active_document(session, doc_id)
        object_key = doc.url
        doc.status = Status.INACTIVE
        await session.flush()
        if object_key and not object_key.startswith("/uploads/"):
            from app.core.storage import get_storage

            get_storage().remove(object_key)
        return {"id": str(doc_id), "status": doc.status, "employeeId": str(doc.employee_id)}

    async def delete_project_data(self, session: AsyncSession, project_id: uuid.UUID) -> dict:
        result = await session.execute(select(EmployeeProjectData).where(EmployeeProjectData.id == project_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Project assignment not found")
        await session.delete(row)
        await session.flush()
        return {"message": "Project assignment deleted"}

    async def status_update(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        *,
        actor: dict | None = None,
    ) -> dict:
        emp = await self._get(session, employee_id)
        before_status = str(emp.status or "") or None
        if emp.status == Status.INACTIVE:
            await self._require_onboarding_completed_for_active(session, employee_id)
            emp.status = Status.ACTIVE
        else:
            emp.status = Status.INACTIVE
        await session.flush()
        await record_field_change(
            session,
            employee_id=employee_id,
            field_name="status",
            old_value=before_status,
            new_value=str(emp.status or "") or None,
            actor=actor,
        )
        return await self._to_dict(session, emp)

    async def primary_employees(self, session: AsyncSession) -> list[dict]:
        result = await session.execute(
            select(Employee).where(
                Employee.status == Status.ACTIVE,
                self._directory_employee_clause(),
            )
        )
        return [employee_to_dict(e) for e in result.scalars().all()]

    async def lead_or_supervisor(self, session: AsyncSession, project_name: str, employee_id: str) -> list[dict]:
        result = await session.execute(
            select(EmployeeProjectData).where(
                EmployeeProjectData.project_name == project_name,
                EmployeeProjectData.project_role == "LEAD",
            )
        )
        return [project_data_to_dict(p) for p in result.scalars().all()]

    def _normalize_profile_payload(self, body: dict[str, Any]) -> dict[str, str | None]:
        contact = body.get("contact") if isinstance(body.get("contact"), dict) else body
        if not isinstance(contact, dict):
            raise HTTPException(status_code=400, detail="Invalid profile change payload")
        from app.modules.employee.profile_fields import (
            ETHNICITIES,
            GENDERS,
            MARITAL_STATUSES,
            NATIONALITIES,
            _normalize_enum,
            _validate_phone,
            validate_address_shape,
        )

        validate_address_shape({"contact": contact})
        # Map canonical emergency aliases before allowlist check
        normalized_contact = extract_address_emergency_payload({"contact": contact})
        # Re-include only keys that were present (extract always maps aliases)
        merged = dict(contact)
        merged.update(normalized_contact)
        unknown = set(merged.keys()) - _ALLOWED_PROFILE_CHANGE_KEYS
        if unknown:
            raise HTTPException(
                status_code=400,
                detail=f"Only address and emergency fields allowed: {sorted(unknown)}",
            )
        out: dict[str, str | None] = {}
        storage_keys = (
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "postalCode",
            "country",
            "emergencyName",
            "emergencyPhone",
            "emergencyRelation",
            "emergencyEmail",
            "emergencyEmployeeId",
            "alternateEmergencyName",
            "alternateEmergencyPhone",
            "alternateEmergencyRelation",
            "alternateEmergencyEmail",
            "personalEmail",
            "alternatePhone",
            "gender",
            "phone",
            "phoneNumber",
            "maritalStatus",
            "nationality",
            "ethnicity",
        )
        enum_fields = {
            "gender": GENDERS,
            "maritalStatus": MARITAL_STATUSES,
            "nationality": NATIONALITIES,
            "ethnicity": ETHNICITIES,
        }
        for key in storage_keys:
            if key not in normalized_contact and key not in contact:
                continue
            value = normalized_contact.get(key, contact.get(key))
            if value is None:
                out[key] = None
            elif isinstance(value, str):
                text = value.strip()
                if key in enum_fields:
                    out[key] = _normalize_enum(
                        text or None, field=key, allowed=enum_fields[key]
                    )
                elif key in {"phone", "phoneNumber"}:
                    out["phoneNumber"] = (
                        _validate_phone(text, field="phoneNumber") if text else None
                    )
                else:
                    out[key] = text
            else:
                raise HTTPException(status_code=400, detail=f"{key} must be a string")
        if not out:
            raise HTTPException(status_code=400, detail="No address or emergency fields provided")
        return out

    async def _resolve_linked_employee_id(
        self, session: AsyncSession, raw: str | None
    ) -> uuid.UUID | None:
        if raw is None or not str(raw).strip():
            return None
        text = str(raw).strip()
        try:
            linked_id = uuid.UUID(text)
            await self._get(session, linked_id)
            return linked_id
        except ValueError:
            result = await session.execute(
                select(Employee).where(Employee.employee_code == text).limit(1)
            )
            emp = result.scalar_one_or_none()
            if emp is None:
                raise HTTPException(
                    status_code=400,
                    detail="emergencyEmployeeId must be a valid employee id or code",
                )
            return emp.employee_id

    async def submit_profile_change(
        self, session: AsyncSession, employee_id: uuid.UUID, actor: dict, body: dict
    ) -> dict:
        actor_id = actor.get("employeeId")
        if str(actor_id) != str(employee_id):
            raise HTTPException(
                status_code=403, detail="Only the employee can submit their own profile change"
            )
        await self._get(session, employee_id)
        payload = self._normalize_profile_payload(body)
        linked_raw = payload.get("emergencyEmployeeId")
        if linked_raw:
            linked = await self._resolve_linked_employee_id(session, linked_raw)
            payload["emergencyEmployeeId"] = str(linked) if linked else None

        existing = await session.execute(
            select(EmployeeProfileChange).where(
                EmployeeProfileChange.employee_id == employee_id,
                EmployeeProfileChange.status == Status.PENDING,
            )
        )
        now = datetime.now(timezone.utc)
        actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None
        row = existing.scalar_one_or_none()
        if row is None:
            row = EmployeeProfileChange(
                employee_id=employee_id,
                payload=json.dumps(payload),
                status=Status.PENDING,
                created_by=actor_name,
                created_date=now,
                updated_date=now,
            )
            session.add(row)
        else:
            row.payload = json.dumps(payload)
            row.updated_date = now
            row.created_by = actor_name
        await session.flush()
        return profile_change_to_dict(row)

    async def get_pending_profile_change(
        self, session: AsyncSession, employee_id: uuid.UUID
    ) -> dict | None:
        await self._get(session, employee_id)
        result = await session.execute(
            select(EmployeeProfileChange).where(
                EmployeeProfileChange.employee_id == employee_id,
                EmployeeProfileChange.status == Status.PENDING,
            ).limit(1)
        )
        row = result.scalar_one_or_none()
        return profile_change_to_dict(row) if row else None

    async def _apply_profile_payload(
        self, session: AsyncSession, employee_id: uuid.UUID, payload: dict[str, Any]
    ) -> None:
        address_keys = (
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "postalCode",
            "country",
        )
        if any(key in payload for key in address_keys):
            addr_result = await session.execute(
                select(Address).where(Address.employee_id == employee_id).limit(1)
            )
            addr = addr_result.scalar_one_or_none()
            line1 = (
                (payload.get("addressLine1") or "").strip()
                if "addressLine1" in payload
                else (getattr(addr, "address_line_1", None) if addr else None)
            )
            # New schema requires address_line_1; skip create until we have it.
            if addr is None and line1:
                addr = Address(
                    employee_id=employee_id,
                    address_line_1=line1,
                    country_code="US",
                )
                session.add(addr)
            if addr is not None:
                if "addressLine1" in payload and line1:
                    addr.address_line_1 = line1
                if "addressLine2" in payload:
                    addr.address_line_2 = payload.get("addressLine2") or None
                if "city" in payload:
                    addr.city = payload.get("city") or None
                if "state" in payload:
                    addr.state = payload.get("state") or None
                if "postalCode" in payload:
                    addr.postal_code = payload.get("postalCode") or None
                if "country" in payload:
                    country = payload.get("country") or "US"
                    addr.country_code = (str(country)[:2] or "US").upper()

        emp_keys = (
            "personalEmail",
            "alternatePhone",
            "alternatePhoneNumber",
            "gender",
            "phone",
            "phoneNumber",
            "maritalStatus",
            "nationality",
            "ethnicity",
        )
        if any(key in payload for key in emp_keys):
            emp = await self._get(session, employee_id)
            if "personalEmail" in payload:
                value = payload.get("personalEmail")
                emp.personal_email = (
                    value.strip() if isinstance(value, str) and value.strip() else None
                )
            if "alternatePhone" in payload or "alternatePhoneNumber" in payload:
                value = payload.get("alternatePhoneNumber", payload.get("alternatePhone"))
                emp.alternate_phone_number = (
                    value.strip() if isinstance(value, str) and value.strip() else None
                )
            if "phone" in payload or "phoneNumber" in payload:
                value = payload.get("phoneNumber", payload.get("phone"))
                emp.phone_number = (
                    value.strip() if isinstance(value, str) and value.strip() else None
                )
            if "gender" in payload:
                value = payload.get("gender")
                emp.gender = value.strip() if isinstance(value, str) and value.strip() else None
            if "maritalStatus" in payload:
                value = payload.get("maritalStatus")
                emp.marital_status = (
                    value.strip() if isinstance(value, str) and value.strip() else None
                )
            if "nationality" in payload:
                value = payload.get("nationality")
                emp.nationality = (
                    value.strip() if isinstance(value, str) and value.strip() else None
                )
            if "ethnicity" in payload:
                value = payload.get("ethnicity")
                emp.ethnicity = (
                    value.strip() if isinstance(value, str) and value.strip() else None
                )

        emergency_keys = (
            "emergencyName",
            "emergencyPhone",
            "emergencyRelation",
            "emergencyEmail",
            "emergencyEmployeeId",
            "alternateEmergencyName",
            "alternateEmergencyPhone",
            "alternateEmergencyRelation",
            "alternateEmergencyEmail",
        )
        alternate_keys = (
            "alternateEmergencyName",
            "alternateEmergencyPhone",
            "alternateEmergencyRelation",
            "alternateEmergencyEmail",
        )
        if any(key in payload for key in emergency_keys):
            contacts = await self._emergency_contacts_ordered(session, employee_id)
            emerg = contacts[0] if contacts else None
            alternate = contacts[1] if len(contacts) > 1 else None
            from app.modules.employee.profile_fields import is_phone_placeholder

            def _stored_emergency_phone(value: Any) -> str:
                text = (value or "").strip() if value is not None else ""
                return "" if is_phone_placeholder(text) else text

            name = payload.get("emergencyName")
            phone = payload.get("emergencyPhone")
            relation = payload.get("emergencyRelation")
            email = payload.get("emergencyEmail")
            if emerg is None:
                emerg = EmergencyContact(
                    employee_id=employee_id,
                    # NOT NULL column: empty string, never legacy display placeholders.
                    name=(name or "").strip() if name is not None else "",
                    phone_number=_stored_emergency_phone(phone),
                    relation=(relation or "").strip() or "Other",
                    email_id=((email or "").strip() or None) if email is not None else None,
                    status=Status.ACTIVE,
                    created_date=datetime.now(timezone.utc),
                )
                session.add(emerg)
                await session.flush()
            else:
                if name is not None:
                    cleaned_name = name.strip()
                    emerg.name = cleaned_name or emerg.name
                if "emergencyPhone" in payload:
                    emerg.phone_number = _stored_emergency_phone(phone)
                if relation is not None:
                    emerg.relation = relation.strip() or emerg.relation
                if email is not None:
                    emerg.email_id = email.strip() or None
            if "emergencyEmployeeId" in payload:
                emerg.linked_employee_id = await self._resolve_linked_employee_id(
                    session, payload.get("emergencyEmployeeId")
                )

            if any(key in payload for key in alternate_keys):
                alt_name = (
                    (payload.get("alternateEmergencyName") or "").strip()
                    if "alternateEmergencyName" in payload
                    else ((alternate.name if alternate else "") or "")
                )
                alt_phone = (
                    _stored_emergency_phone(payload.get("alternateEmergencyPhone"))
                    if "alternateEmergencyPhone" in payload
                    else (
                        ""
                        if alternate is None
                        else _stored_emergency_phone(alternate.phone_number)
                    )
                )
                alt_relation = (
                    (payload.get("alternateEmergencyRelation") or "").strip()
                    if "alternateEmergencyRelation" in payload
                    else ((alternate.relation if alternate else "") or "")
                )
                if "alternateEmergencyEmail" in payload:
                    raw_email = payload.get("alternateEmergencyEmail")
                    alt_email = (
                        (raw_email or "").strip() or None
                        if raw_email is not None
                        else None
                    )
                else:
                    alt_email = alternate.email_id if alternate else None
                has_alternate = bool(
                    alt_name
                    or alt_phone
                    or alt_relation
                    or (alt_email or "").strip()
                )
                if has_alternate:
                    if alternate is None:
                        primary_created = emerg.created_date or datetime.now(
                            timezone.utc
                        )
                        alternate = EmergencyContact(
                            employee_id=employee_id,
                            name=alt_name or "",
                            phone_number=alt_phone,
                            relation=alt_relation or "Other",
                            email_id=alt_email,
                            status=Status.ACTIVE,
                            # Sort after primary even when primary.created_date is null.
                            created_date=primary_created + timedelta(seconds=1),
                        )
                        session.add(alternate)
                    else:
                        if "alternateEmergencyName" in payload:
                            alternate.name = alt_name
                        if "alternateEmergencyPhone" in payload:
                            alternate.phone_number = alt_phone
                        if "alternateEmergencyRelation" in payload:
                            alternate.relation = alt_relation or alternate.relation or "Other"
                        if "alternateEmergencyEmail" in payload:
                            alternate.email_id = alt_email
                        alternate.updated_date = datetime.now(timezone.utc)
                elif alternate is not None:
                    await session.delete(alternate)
        await session.flush()

    async def approve_profile_change(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        change_id: uuid.UUID,
        actor: dict,
        comments: str | None = None,
    ) -> dict:
        result = await session.execute(
            select(EmployeeProfileChange).where(
                EmployeeProfileChange.id == change_id,
                EmployeeProfileChange.employee_id == employee_id,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Profile change not found")
        if row.status != Status.PENDING:
            raise HTTPException(status_code=400, detail="Profile change is not pending")
        payload = profile_change_to_dict(row)["payload"]
        before = await snapshot_profile(session, await self._get(session, employee_id))
        await self._apply_profile_payload(session, employee_id, payload)
        after = await snapshot_profile(session, await self._get(session, employee_id))
        await record_profile_audit(
            session,
            employee_id=employee_id,
            before=before,
            after=after,
            actor=actor,
            reason=comments,
        )
        row.status = Status.APPROVED
        row.comments = comments
        row.reviewed_by = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None
        row.updated_date = datetime.now(timezone.utc)
        await session.flush()
        return {
            "change": profile_change_to_dict(row),
            "employee": await self._to_dict(session, await self._get(session, employee_id)),
        }

    async def reject_profile_change(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        change_id: uuid.UUID,
        actor: dict,
        comments: str | None = None,
    ) -> dict:
        result = await session.execute(
            select(EmployeeProfileChange).where(
                EmployeeProfileChange.id == change_id,
                EmployeeProfileChange.employee_id == employee_id,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Profile change not found")
        if row.status != Status.PENDING:
            raise HTTPException(status_code=400, detail="Profile change is not pending")
        row.status = Status.REJECTED
        row.comments = comments
        row.reviewed_by = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None
        row.updated_date = datetime.now(timezone.utc)
        await session.flush()
        return profile_change_to_dict(row)
    _CORRECTION_ATTR = {
        "firstName": "first_name",
        "lastName": "last_name",
        "middleName": "middle_name",
        "dateOfBirth": "date_of_birth",
    }

    async def create_correction_request(
        self,
        session: AsyncSession,
        employee_id: uuid.UUID,
        actor: dict,
        body: dict[str, Any],
    ) -> dict:
        from app.modules.employee.access import actor_employee_id
        from app.modules.employee.field_permissions import (
            CORRECTION_REQUEST_FIELDS,
            allows_correction_request,
        )

        if actor_employee_id(actor) != str(employee_id):
            raise HTTPException(
                status_code=403,
                detail="Only the employee may request corrections on their own profile",
            )
        field_name = str(body.get("fieldName") or body.get("field_name") or "").strip()
        if not field_name or field_name not in CORRECTION_REQUEST_FIELDS:
            raise HTTPException(
                status_code=400,
                detail=(
                    "fieldName must be one of: "
                    + ", ".join(sorted(CORRECTION_REQUEST_FIELDS))
                ),
            )
        if not allows_correction_request(field_name):
            raise HTTPException(status_code=400, detail="Correction not allowed for field")
        requested = str(body.get("requestedValue") or body.get("requested_value") or "").strip()
        if not requested:
            raise HTTPException(status_code=400, detail="requestedValue is required")
        note = body.get("note")
        note_text = str(note).strip() if note is not None and str(note).strip() else None

        await self._get(session, employee_id)
        # New schema statuses: Open | Approved | Rejected | Completed (no PENDING).
        pending = "Open"
        existing = await session.execute(
            select(CorrectionRequest).where(
                CorrectionRequest.employee_id == employee_id,
                CorrectionRequest.field_name == field_name,
                CorrectionRequest.status == pending,
            )
        )
        row = existing.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if row is None:
            row = CorrectionRequest(
                employee_id=employee_id,
                submitted_by_employee_id=employee_id,
                field_name=field_name,
                requested_value=requested,
                note=note_text,
                status=pending,
                requested_at=now,
            )
            session.add(row)
        else:
            row.requested_value = requested
            row.note = note_text
        await session.flush()
        return correction_request_to_dict(row)

    async def list_correction_requests(
        self,
        session: AsyncSession,
        *,
        status: str | None = None,
        employee_id: uuid.UUID | None = None,
    ) -> list[dict]:
        stmt = select(CorrectionRequest).order_by(CorrectionRequest.created_at.desc())
        if status:
            stmt = stmt.where(CorrectionRequest.status == status.strip().upper())
        if employee_id is not None:
            stmt = stmt.where(CorrectionRequest.employee_id == employee_id)
        result = await session.execute(stmt)
        return [correction_request_to_dict(row) for row in result.scalars().all()]

    async def review_correction_request(
        self,
        session: AsyncSession,
        request_id: uuid.UUID,
        actor: dict,
        *,
        approve: bool,
        note: str | None = None,
    ) -> dict:
        result = await session.execute(
            select(CorrectionRequest).where(CorrectionRequest.id == request_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Correction request not found")
        pending = "Open"
        approved = "Approved"
        rejected = "Rejected"
        if row.status != pending:
            raise HTTPException(status_code=400, detail="Correction request is not pending")
        now = datetime.now(timezone.utc)
        reviewer = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None
        if approve:
            emp = await self._get(session, row.employee_id)
            attr = self._CORRECTION_ATTR.get(row.field_name)
            if attr is None:
                raise HTTPException(status_code=400, detail="Unsupported correction field")
            from app.modules.employee.profile_fields import validate_common_fields

            body = {row.field_name: row.requested_value}
            validate_common_fields(body, is_create=False)
            setattr(emp, attr, body[row.field_name])
            if hasattr(emp, "updated_date"):
                emp.updated_date = now
            if reviewer and hasattr(emp, "updated_by"):
                emp.updated_by = reviewer
            row.status = approved
        else:
            row.status = rejected
        if note and str(note).strip():
            row.note = ((row.note + "\n") if row.note else "") + str(note).strip()
        row.reviewed_by = reviewer
        row.decided_at = now
        try:
            row.decided_by_employee_id = uuid.UUID(str(actor.get("employeeId")))
        except (TypeError, ValueError, AttributeError):
            pass
        await session.flush()
        return correction_request_to_dict(row)

    PROFILE_UPDATE_REQUEST_FIELDS = frozenset(
        {
            "firstName",
            "lastName",
            "dateOfBirth",
            "nationality",
        }
    )
    _PROFILE_UPDATE_ATTR = {
        "firstName": "first_name",
        "lastName": "last_name",
        "dateOfBirth": "date_of_birth",
        "nationality": "nationality",
    }

    def _current_profile_field_value(self, emp: Employee, field_changed: str) -> str | None:
        attr = self._PROFILE_UPDATE_ATTR[field_changed]
        raw = getattr(emp, attr, None)
        if raw is None:
            return None
        if isinstance(raw, date):
            return raw.isoformat()
        text = str(raw).strip()
        return text or None

    @staticmethod
    def _name_identity_key(value: str | None) -> str:
        """Collapse whitespace and ignore case for first/last name identity checks."""
        if not value:
            return ""
        return " ".join(str(value).split()).casefold()

    def _normalize_profile_update_new_value(
        self, field_changed: str, new_value: str
    ) -> str:
        from app.modules.employee.profile_fields import NATIONALITIES, validate_common_fields

        cleaned = new_value.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="newValue is required")
        if len(cleaned) > 255:
            raise HTTPException(status_code=400, detail="newValue must be at most 255 characters")
        if field_changed == "dateOfBirth":
            body = {"dateOfBirth": cleaned}
            validate_common_fields(body, is_create=False)
            value = body["dateOfBirth"]
            if isinstance(value, date):
                return value.isoformat()
            return str(value)
        if field_changed == "nationality":
            upper = cleaned.upper()
            if upper not in NATIONALITIES:
                raise HTTPException(status_code=400, detail="Invalid nationality")
            return upper
        body = {field_changed: cleaned}
        validate_common_fields(body, is_create=False)
        normalized = str(body[field_changed]).strip()
        if field_changed in {"firstName", "lastName"}:
            return " ".join(normalized.split())
        return normalized

    async def create_profile_update_request(
        self,
        session: AsyncSession,
        user: dict,
        body: dict[str, Any],
        *,
        attachment: Any | None = None,
    ) -> dict:
        from app.core.storage import get_storage, safe_filename
        from app.modules.employee.access import actor_employee_id
        from app.modules.employee.files import read_validated_document
        from app.modules.employee.request_decisions import log_submission
        from app.modules.workflow.events import ITEM_PROFILE_UPDATE
        from app.modules.employee.profile_update_notify import (
            notify_hr_profile_update_request,
        )

        raw_id = actor_employee_id(user)
        if not raw_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        actor_id = uuid.UUID(raw_id)
        # A named field means a structured change (old → new); anything else is
        # a free-text ticket. Structured changes may still carry a reason.
        structured_field = str(
            body.get("fieldChanged") or body.get("field_changed") or ""
        ).strip()
        has_free_text = not structured_field or structured_field == "general"
        requested_for_raw = body.get("requestedForEmployeeId")
        if requested_for_raw is None:
            requested_for_raw = body.get("requested_for_employee_id")
        try:
            employee_id = (
                uuid.UUID(str(requested_for_raw))
                if requested_for_raw not in (None, "")
                else actor_id
            )
        except (TypeError, ValueError, AttributeError):
            raise HTTPException(
                status_code=400, detail="requestedForEmployeeId must be a valid UUID"
            ) from None

        if has_free_text:
            short_raw = body.get("shortDescription")
            if short_raw is None:
                short_raw = body.get("short_description")
            long_raw = body.get("longDescription")
            if long_raw is None:
                long_raw = body.get("long_description")
            short_description = str(short_raw or "").strip()
            long_description = str(long_raw or "").strip()
            if not short_description:
                raise HTTPException(
                    status_code=400, detail="shortDescription is required"
                )
            field_changed = "general"
            new_value = short_description[:255]
            old_value = None
        else:
            short_description = None
            reason_raw = body.get("longDescription")
            if reason_raw is None:
                reason_raw = body.get("long_description")
            long_description = str(reason_raw or "").strip() or None
            field_changed = structured_field
            if field_changed not in self.PROFILE_UPDATE_REQUEST_FIELDS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "fieldChanged must be one of: "
                        + ", ".join(sorted(self.PROFILE_UPDATE_REQUEST_FIELDS))
                    ),
                )
            new_raw = body.get("newValue")
            if new_raw is None:
                new_raw = body.get("new_value")
            if new_raw is None:
                raise HTTPException(status_code=400, detail="newValue is required")
            new_value = self._normalize_profile_update_new_value(
                field_changed, str(new_raw)
            )

        emp = await self._get(session, employee_id)
        requester = emp
        if employee_id != actor_id:
            requester = await self._get(session, actor_id)

        if not has_free_text:
            old_value = self._current_profile_field_value(emp, field_changed)
            if field_changed in {"firstName", "lastName"}:
                if self._name_identity_key(old_value) == self._name_identity_key(
                    new_value
                ):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "newValue must differ from the current value "
                            "(ignoring case and spaces)"
                        ),
                    )
            elif old_value == new_value:
                raise HTTPException(
                    status_code=400,
                    detail="newValue must differ from the current value",
                )

        now = datetime.now(timezone.utc)
        row = ProfileUpdateRequest(
            employee_id=employee_id,
            submitted_by_employee_id=actor_id,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            short_description=short_description,
            long_description=long_description,
            status="Open",
            requested_date=now,
            created_date=now,
            updated_date=now,
        )
        session.add(row)
        await session.flush()
        await log_submission(
            session,
            ITEM_PROFILE_UPDATE,
            ProfileUpdateRequest,
            row,
            user,
            body.get("resubmitOfId"),
        )

        object_key: str | None = None
        if attachment is not None:
            data, content_type = await read_validated_document(attachment)
            filename = safe_filename(
                getattr(attachment, "filename", None) or "supporting-document"
            )
            object_key = (
                f"profile-update-requests/{row.id}/{uuid.uuid4()}/{filename}"
            )
            try:
                get_storage().put_bytes(object_key, data, content_type)
            except Exception:
                await session.delete(row)
                await session.flush()
                raise
            row.attachment_object_key = object_key
            row.attachment_file_name = filename
            await session.flush()

        await notify_hr_profile_update_request(
            employee=emp, requester=requester, request=row
        )
        return profile_update_request_to_dict(row)

    async def profile_update_attachment_object(
        self,
        session: AsyncSession,
        user: dict,
        request_id: uuid.UUID,
    ) -> tuple[str, str]:
        """Return (object_key, file_name) for HR download of a profile-request attachment."""
        self._require_functional_queue_access(user)
        result = await session.execute(
            select(ProfileUpdateRequest).where(ProfileUpdateRequest.id == request_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Profile update request not found")
        object_key = (row.attachment_object_key or "").strip()
        if not object_key:
            raise HTTPException(
                status_code=404, detail="No supporting document on this request"
            )
        filename = (row.attachment_file_name or "").strip() or "supporting-document"
        return object_key, filename

    async def own_profile_update_attachment_object(
        self,
        session: AsyncSession,
        user: dict,
        request_id: uuid.UUID,
    ) -> tuple[str, str]:
        """(object_key, file_name) for a document on a request the user raised or is about."""
        from app.modules.employee.access import actor_employee_id

        raw_id = actor_employee_id(user)
        if not raw_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        actor_id = uuid.UUID(raw_id)
        result = await session.execute(
            select(ProfileUpdateRequest).where(ProfileUpdateRequest.id == request_id)
        )
        row = result.scalar_one_or_none()
        if row is None or actor_id not in (row.employee_id, row.submitted_by_employee_id):
            raise HTTPException(status_code=404, detail="Profile update request not found")
        object_key = (row.attachment_object_key or "").strip()
        if not object_key:
            raise HTTPException(
                status_code=404, detail="No supporting document on this request"
            )
        filename = (row.attachment_file_name or "").strip() or "supporting-document"
        return object_key, filename

    async def list_own_profile_update_requests(
        self,
        session: AsyncSession,
        user: dict,
    ) -> list[dict]:
        from app.modules.employee.access import actor_employee_id

        raw_id = actor_employee_id(user)
        if not raw_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        employee_id = uuid.UUID(raw_id)
        result = await session.execute(
            select(ProfileUpdateRequest)
            .options(
                selectinload(ProfileUpdateRequest.employee),
                selectinload(ProfileUpdateRequest.submitted_by_employee),
            )
            .where(
                or_(
                    ProfileUpdateRequest.submitted_by_employee_id == employee_id,
                    and_(
                        ProfileUpdateRequest.submitted_by_employee_id.is_(None),
                        ProfileUpdateRequest.employee_id == employee_id,
                    ),
                )
            )
            .order_by(ProfileUpdateRequest.requested_date.desc())
        )
        return [
            self._enrich_profile_update_request_dict(row)
            for row in result.scalars().all()
        ]

    async def employee_directory_search(
        self,
        session: AsyncSession,
        q: str,
    ) -> list[dict]:
        query = str(q or "").strip()
        if len(query) < 2:
            raise HTTPException(
                status_code=400, detail="q must be at least 2 characters"
            )
        pattern = f"%{query}%"
        result = await session.execute(
            select(Employee)
            .where(
                Employee.status == Status.ACTIVE.value,
                directory_employee_clause(),
                or_(
                    Employee.first_name.ilike(pattern),
                    Employee.last_name.ilike(pattern),
                    Employee.business_employee_id.ilike(pattern),
                    Employee.employee_code.ilike(pattern),
                ),
            )
            .order_by(Employee.first_name, Employee.last_name)
            .limit(20)
        )
        return [
            {
                "id": str(employee.employee_id),
                "firstName": employee.first_name,
                "lastName": employee.last_name,
                "employeeId": (
                    employee.business_employee_id or employee.employee_code
                ),
            }
            for employee in result.scalars().all()
        ]

    ASSET_REQUEST_TYPES = frozenset({"new", "swap", "reportLostStolen"})

    async def list_assigned_assets_for_request(
        self,
        session: AsyncSession,
        user: dict,
        *,
        employee_id: str | None = None,
    ) -> list[dict]:
        """Current open allocations for self or a selected subject (ESS create form)."""
        from app.modules.assets.service import list_employee_assets
        from app.modules.employee.access import actor_employee_id

        raw_actor = actor_employee_id(user)
        if not raw_actor:
            raise HTTPException(status_code=401, detail="Invalid token")
        actor_id = uuid.UUID(raw_actor)
        target_id = actor_id
        if employee_id and str(employee_id).strip():
            try:
                target_id = uuid.UUID(str(employee_id).strip())
            except (TypeError, ValueError, AttributeError) as exc:
                raise HTTPException(
                    status_code=400, detail="employeeId must be a valid UUID"
                ) from exc
            await self._get(session, target_id)
        return await list_employee_assets(
            session, target_id, include_history=False
        )

    async def create_asset_request(
        self,
        session: AsyncSession,
        user: dict,
        body: dict[str, Any],
    ) -> dict:
        from app.modules.employee.access import actor_employee_id
        from app.modules.employee.asset_request_notify import (
            notify_asset_manager_asset_request,
        )
        from app.modules.employee.request_decisions import (
            in_stock_count as request_stock_count,
            log_submission,
        )
        from app.modules.workflow.events import ITEM_ASSET_REQUEST

        raw_id = actor_employee_id(user)
        if not raw_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        actor_id = uuid.UUID(raw_id)

        requested_for_raw = body.get("requestedForEmployeeId")
        if requested_for_raw is None:
            requested_for_raw = body.get("requested_for_employee_id")
        try:
            subject_id = (
                uuid.UUID(str(requested_for_raw))
                if requested_for_raw not in (None, "")
                else actor_id
            )
        except (TypeError, ValueError, AttributeError):
            raise HTTPException(
                status_code=400,
                detail="requestedForEmployeeId must be a valid UUID",
            ) from None

        request_type = str(
            body.get("requestType") or body.get("request_type") or ""
        ).strip()
        if request_type not in self.ASSET_REQUEST_TYPES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "requestType must be one of: "
                    + ", ".join(sorted(self.ASSET_REQUEST_TYPES))
                ),
            )

        system_asset_raw = body.get("systemAssetId")
        if system_asset_raw is None:
            system_asset_raw = body.get("system_asset_id")
        details_raw = body.get("newAssetDetails")
        if details_raw is None:
            details_raw = body.get("new_asset_details")
        details = str(details_raw or "").strip()
        category_raw = body.get("categoryId")
        if category_raw is None:
            category_raw = body.get("category_id")

        system_asset_id: uuid.UUID | None = None
        new_asset_details: str | None = None
        requested_category_id: uuid.UUID | None = None
        category: AssetCategory | None = None
        asset_code: str | None = None

        if request_type == "new":
            if system_asset_raw not in (None, ""):
                raise HTTPException(
                    status_code=400,
                    detail="systemAssetId must not be set for new requests",
                )
            if not category_raw:
                raise HTTPException(
                    status_code=400, detail="categoryId is required for new requests"
                )
            try:
                requested_category_id = uuid.UUID(str(category_raw).strip())
            except (TypeError, ValueError, AttributeError) as exc:
                raise HTTPException(
                    status_code=400, detail="Invalid categoryId"
                ) from exc
            cat_result = await session.execute(
                select(AssetCategory).where(
                    AssetCategory.category_id == requested_category_id
                )
            )
            category = cat_result.scalar_one_or_none()
            if category is None:
                raise HTTPException(
                    status_code=400,
                    detail="categoryId must reference an existing category",
                )
            if not details:
                raise HTTPException(
                    status_code=400, detail="newAssetDetails is required"
                )
            if await request_stock_count(session, requested_category_id) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"No {category.category_name} is in stock right now. "
                        "Ask the asset team to add stock."
                    ),
                )
            if len(details) > 255:
                raise HTTPException(
                    status_code=400,
                    detail="newAssetDetails must be at most 255 characters",
                )
            new_asset_details = details
        else:
            if category_raw not in (None, ""):
                raise HTTPException(
                    status_code=400,
                    detail="categoryId must not be set for swap or reportLostStolen",
                )
            if not system_asset_raw:
                raise HTTPException(
                    status_code=400, detail="systemAssetId is required"
                )
            try:
                system_asset_id = uuid.UUID(str(system_asset_raw).strip())
            except ValueError as exc:
                raise HTTPException(
                    status_code=400, detail="Invalid systemAssetId"
                ) from exc
            if not details:
                raise HTTPException(
                    status_code=400,
                    detail="newAssetDetails is required for swap and reportLostStolen",
                )
            if len(details) > 255:
                raise HTTPException(
                    status_code=400,
                    detail="newAssetDetails must be at most 255 characters",
                )
            new_asset_details = details
            open_alloc = await session.execute(
                select(AssetAllocation, Asset)
                .join(Asset, Asset.system_asset_id == AssetAllocation.system_asset_id)
                .where(
                    AssetAllocation.employee_id == subject_id,
                    AssetAllocation.system_asset_id == system_asset_id,
                    AssetAllocation.returned_date.is_(None),
                )
                .limit(1)
            )
            pair = open_alloc.first()
            if pair is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "systemAssetId must be one of the subject's currently "
                        "assigned assets"
                    ),
                )
            asset_code = pair[1].asset_id
            if request_type == "swap":
                if await request_stock_count(session, pair[1].category_id) == 0:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "No replacement is in stock right now. "
                            "Ask the asset team to add stock."
                        ),
                    )

        subject = await self._get(session, subject_id)
        requester = subject
        if subject_id != actor_id:
            requester = await self._get(session, actor_id)

        now = datetime.now(timezone.utc)
        row = AssetRequest(
            employee_id=subject_id,
            submitted_by_employee_id=actor_id,
            request_type=request_type,
            system_asset_id=system_asset_id,
            new_asset_details=new_asset_details,
            requested_category_id=requested_category_id,
            status="Open",
            requested_date=now,
            created_date=now,
            updated_date=now,
        )
        if category is not None:
            row.requested_category = category
        session.add(row)
        await session.flush()
        await log_submission(
            session,
            ITEM_ASSET_REQUEST,
            AssetRequest,
            row,
            user,
            body.get("resubmitOfId"),
        )
        await notify_asset_manager_asset_request(
            employee=requester,
            request=row,
            asset_code=asset_code,
            category_name=category.category_name if category else None,
        )
        payload = asset_request_to_dict(row)
        payload["requesterName"] = self._requester_display_name(requester)
        payload["subjectName"] = self._requester_display_name(subject)
        return payload

    async def list_own_asset_requests(
        self,
        session: AsyncSession,
        user: dict,
    ) -> list[dict]:
        from app.modules.employee.access import actor_employee_id

        raw_id = actor_employee_id(user)
        if not raw_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        employee_id = uuid.UUID(raw_id)
        result = await session.execute(
            select(AssetRequest)
            .options(
                selectinload(AssetRequest.employee),
                selectinload(AssetRequest.submitted_by_employee),
                selectinload(AssetRequest.requested_category),
            )
            .where(
                or_(
                    AssetRequest.employee_id == employee_id,
                    AssetRequest.submitted_by_employee_id == employee_id,
                )
            )
            .order_by(AssetRequest.requested_date.desc())
        )
        return [
            self._enrich_asset_request_dict(row) for row in result.scalars().all()
        ]

    IT_REQUEST_CATEGORIES = frozenset({"firewall", "ram", "softwareLicense"})

    async def create_it_request(
        self,
        session: AsyncSession,
        user: dict,
        body: dict[str, Any],
    ) -> dict:
        from app.modules.employee.access import actor_employee_id
        from app.modules.employee.it_request_notify import notify_it_request

        raw_id = actor_employee_id(user)
        if not raw_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        employee_id = uuid.UUID(raw_id)
        category = str(body.get("category") or "").strip()
        if category not in self.IT_REQUEST_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "category must be one of: "
                    + ", ".join(sorted(self.IT_REQUEST_CATEGORIES))
                ),
            )
        details = str(body.get("details") or "").strip()
        if not details:
            raise HTTPException(status_code=400, detail="details is required")
        if len(details) > 255:
            raise HTTPException(
                status_code=400, detail="details must be at most 255 characters"
            )

        emp = await self._get(session, employee_id)
        now = datetime.now(timezone.utc)
        row = ITRequest(
            employee_id=employee_id,
            category=category,
            details=details,
            status="Open",
            requested_date=now,
            created_date=now,
            updated_date=now,
        )
        session.add(row)
        await session.flush()
        await notify_it_request(employee=emp, request=row)
        return it_request_to_dict(row)

    async def list_own_it_requests(
        self,
        session: AsyncSession,
        user: dict,
    ) -> list[dict]:
        from app.modules.employee.access import actor_employee_id

        raw_id = actor_employee_id(user)
        if not raw_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        employee_id = uuid.UUID(raw_id)
        result = await session.execute(
            select(ITRequest)
            .where(ITRequest.employee_id == employee_id)
            .order_by(ITRequest.requested_date.desc())
        )
        return [it_request_to_dict(row) for row in result.scalars().all()]
