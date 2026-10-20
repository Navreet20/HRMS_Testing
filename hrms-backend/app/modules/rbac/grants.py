"""Employee access grant helpers (RBAC-DATA-2)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from app.models.tables import Employee, EmployeeAccessGrant, RbacModule
from app.modules.rbac.grant_audit import (
    AUDIT_ACTION_CREATED,
    AUDIT_ACTION_REVOKED,
    AUDIT_ACTION_UPDATED,
    record_grant_audit,
)
from app.modules.rbac.service import MASTER_STATUS_ACTIVE

ACCESS_LEVEL_READ_ONLY = "read_only"
ACCESS_LEVEL_FULL_ACCESS = "full_access"
ACCESS_LEVELS = frozenset({ACCESS_LEVEL_READ_ONLY, ACCESS_LEVEL_FULL_ACCESS})

GRANT_STATUS_ACTIVE = "Active"
GRANT_STATUS_REVOKED = "Revoked"

# The API keeps read_only / full_access; the table stores View / Edit / Manage (ck_employee_access_grants_level).
_DB_LEVEL = {ACCESS_LEVEL_READ_ONLY: "View", ACCESS_LEVEL_FULL_ACCESS: "Manage"}
_API_LEVEL = {"View": ACCESS_LEVEL_READ_ONLY, "Edit": ACCESS_LEVEL_FULL_ACCESS, "Manage": ACCESS_LEVEL_FULL_ACCESS}


def to_db_level(level: str | None) -> str:
    return _DB_LEVEL.get(str(level or ""), "View")


def from_db_level(level: str | None) -> str | None:
    return _API_LEVEL.get(str(level or ""))


def _active_grant():
    """SQL clause: the grant is live (not revoked)."""
    return EmployeeAccessGrant.revoked_at.is_(None)


def _grant_to_dict(row: EmployeeAccessGrant) -> dict[str, Any]:
    module = row.module
    submodule = row.submodule
    return {
        "grantId": str(row.grant_id),
        "employeeId": str(row.employee_id),
        "moduleId": row.module_id,
        "moduleName": module.module_name if module is not None else None,
        "hasSubmodules": bool(module.has_submodules) if module is not None else False,
        "submoduleId": row.submodule_id,
        "submoduleName": submodule.submodule_name if submodule is not None else None,
        "accessLevel": from_db_level(row.access_level),
        "grantedBy": str(row.granted_by) if row.granted_by else None,
        "grantedDate": row.granted_date.isoformat() if row.granted_date else None,
        "status": row.status,
    }


def _employee_search_to_dict(
    row: Employee,
    *,
    active_grant_count: int = 0,
    managed_grant_count: int = 0,
) -> dict[str, Any]:
    return {
        "employeeId": str(row.employee_id),
        "email": row.email_id,
        "firstName": row.first_name,
        "lastName": row.last_name,
        "status": row.status,
        "employeeCode": row.employee_code,
        "role": row.role,
        "activeGrantCount": int(active_grant_count),
        "managedGrantCount": int(managed_grant_count),
    }


def manage_access_target_roles(actor_role: str | None) -> tuple[str, ...] | None:
    """Persona scope for directory / search filters.

    - Superadmin / system (no actor role): ``None`` — no role allowlist
      (bootstrap upserts; Superadmin still excludes other Superadmins via
      ``exclude_roles``).
    - Any other Manage Access actor (JWT ADMIN, grant-elevated EMPLOYEE, …):
      Employees only.
    """
    role = (actor_role or "").strip().upper()
    if not role or role == "SUPERADMIN":
        return None
    return ("EMPLOYEE",)


def manage_access_exclude_roles(actor_role: str | None) -> tuple[str, ...]:
    """Roles hidden from the actor's RBAC directory."""
    role = (actor_role or "").strip().upper()
    if role == "SUPERADMIN":
        # Superadmin assigns Admin access to employees — never manage other Superadmins.
        return ("SUPERADMIN",)
    return ()


def _active_employee_clause():
    """RBAC only lists and searches ACTIVE employees."""
    from app.core.roles import Status

    return func.upper(func.coalesce(Employee.status, "")) == Status.ACTIVE.value


def assert_manage_access_target_role(
    *,
    actor_role: str | None,
    target_role: str | None,
) -> None:
    """403 when the actor persona cannot manage the target employee's role."""
    actor = (actor_role or "").strip().upper()
    normalized = (target_role or "").strip().upper()
    excluded = manage_access_exclude_roles(actor_role)
    if normalized and normalized in excluded:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot manage access for Superadmins.",
        )
    allowed = manage_access_target_roles(actor_role)
    if allowed is None:
        return
    if normalized not in allowed:
        label = "employees" if allowed == ("EMPLOYEE",) else "allowed roles"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only manage access for {label}.",
        )


async def search_employees_by_email(
    db: AsyncSession,
    *,
    email: str,
    limit: int = 20,
    roles: tuple[str, ...] | None = None,
    exclude_roles: tuple[str, ...] = (),
) -> list[dict[str, Any]]:
    """Case-insensitive email contains search over active employees."""
    query = (email or "").strip()
    if len(query) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email search requires at least 2 characters.",
        )
    capped = max(1, min(int(limit), 50))
    pattern = f"%{query}%"
    stmt = select(Employee).where(
        Employee.email_id.ilike(pattern), _active_employee_clause()
    )
    if roles:
        stmt = stmt.where(func.upper(Employee.role).in_([r.upper() for r in roles]))
    if exclude_roles:
        stmt = stmt.where(
            Employee.role.is_(None)
            | ~func.upper(Employee.role).in_([r.upper() for r in exclude_roles])
        )
    result = await db.execute(
        stmt.order_by(func.lower(Employee.email_id)).limit(capped)
    )
    return [_employee_search_to_dict(row) for row in result.scalars().all()]


async def list_directory_employees(
    db: AsyncSession,
    *,
    q: str | None = None,
    roles: tuple[str, ...] | None = None,
    exclude_roles: tuple[str, ...] = (),
    page: int = 1,
    page_size: int = 10,
) -> dict[str, Any]:
    """Paginated directory of active employees for the RBAC By-employees view.

    ``activeGrantCount`` and ``managedGrantCount`` are the same count of Active
    grants; both are kept for API compatibility with the Manage Access UI.
    """
    page_n = max(1, int(page))
    size_n = max(1, min(int(page_size), 50))
    filters = [_active_employee_clause()]
    query = (q or "").strip()
    if query:
        pattern = f"%{query}%"
        filters.append(
            (Employee.email_id.ilike(pattern))
            | (Employee.first_name.ilike(pattern))
            | (Employee.last_name.ilike(pattern))
            | (Employee.employee_code.ilike(pattern))
        )
    if roles:
        filters.append(func.upper(Employee.role).in_([r.upper() for r in roles]))
    if exclude_roles:
        filters.append(
            Employee.role.is_(None)
            | ~func.upper(Employee.role).in_([r.upper() for r in exclude_roles])
        )
    count_stmt = select(func.count()).select_from(Employee).where(*filters)
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    stmt = select(Employee).where(*filters)
    result = await db.execute(
        stmt.order_by(func.lower(Employee.last_name), func.lower(Employee.first_name))
        .offset((page_n - 1) * size_n)
        .limit(size_n)
    )
    rows = list(result.scalars().all())
    if not rows:
        return {
            "items": [],
            "total": total,
            "page": page_n,
            "pageSize": size_n,
        }

    employee_ids = [row.employee_id for row in rows]
    count_result = await db.execute(
        select(EmployeeAccessGrant.employee_id, func.count())
        .where(
            EmployeeAccessGrant.employee_id.in_(employee_ids),
            _active_grant(),
        )
        .group_by(EmployeeAccessGrant.employee_id)
    )
    counts: dict[uuid.UUID, int] = {
        employee_id: int(n) for employee_id, n in count_result.all()
    }

    items = [
        _employee_search_to_dict(
            row,
            active_grant_count=counts.get(row.employee_id, 0),
            managed_grant_count=counts.get(row.employee_id, 0),
        )
        for row in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page_n,
        "pageSize": size_n,
    }


async def _get_employee_or_404(db: AsyncSession, employee_id: uuid.UUID) -> Employee:
    result = await db.execute(
        select(Employee).where(Employee.employee_id == employee_id)
    )
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )
    return employee


async def list_employee_grants(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    include_revoked: bool = False,
    actor_role_name: str | None = None,
) -> list[dict[str, Any]]:
    target = await _get_employee_or_404(db, employee_id)
    if actor_role_name is not None:
        assert_manage_access_target_role(
            actor_role=actor_role_name,
            target_role=getattr(target, "role", None),
        )
    stmt = (
        select(EmployeeAccessGrant)
        .where(EmployeeAccessGrant.employee_id == employee_id)
        .options(
            selectinload(EmployeeAccessGrant.module),
            selectinload(EmployeeAccessGrant.submodule),
        )
        .order_by(
            EmployeeAccessGrant.module_id,
            EmployeeAccessGrant.submodule_id.nullsfirst(),
            EmployeeAccessGrant.granted_date.desc(),
        )
    )
    if not include_revoked:
        stmt = stmt.where(_active_grant())
    result = await db.execute(stmt)
    return [_grant_to_dict(row) for row in result.scalars().unique().all()]


async def _load_module_or_400(db: AsyncSession, module_id: int) -> RbacModule:
    result = await db.execute(
        select(RbacModule)
        .where(RbacModule.module_id == module_id)
        .options(selectinload(RbacModule.submodules))
    )
    module = result.scalar_one_or_none()
    if module is None or (module.status or MASTER_STATUS_ACTIVE) != MASTER_STATUS_ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Module is required and must be an Active catalog module.",
        )
    return module


def _normalize_submodule_ids(raw: Any) -> list[int]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="submoduleIds must be an array of integers.",
        )
    out: list[int] = []
    seen: set[int] = set()
    for item in raw:
        try:
            value = int(item)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="submoduleIds must be an array of integers.",
            ) from exc
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


async def _find_existing_grant(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    module_id: int,
    submodule_id: int | None,
) -> EmployeeAccessGrant | None:
    """The live (not revoked) grant for this scope. Revoked rows are history and are never reactivated."""
    stmt = select(EmployeeAccessGrant).where(
        EmployeeAccessGrant.employee_id == employee_id,
        EmployeeAccessGrant.module_id == module_id,
        _active_grant(),
    )
    if submodule_id is None:
        stmt = stmt.where(EmployeeAccessGrant.submodule_id.is_(None))
    else:
        stmt = stmt.where(EmployeeAccessGrant.submodule_id == submodule_id)
    result = await db.execute(stmt)
    return result.scalars().first()


async def _revoke_row(db: AsyncSession, row: EmployeeAccessGrant, *, revoked_by: uuid.UUID) -> None:
    """Revoke = set revoked_at + revoked_by together (ck_employee_access_grants_revoked)."""
    row.revoked_at = max(datetime.now(timezone.utc), row.granted_at) if row.granted_at else datetime.now(timezone.utc)
    row.revoked_by_employee_id = revoked_by
    await db.flush()


async def _upsert_one_grant(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    module_id: int,
    submodule_id: int | None,
    access_level: str,
    granted_by: uuid.UUID | None,
) -> tuple[EmployeeAccessGrant, str | None, str | None]:
    """Upsert one grant. Returns (row, audit_action, previous_access_level).

    New schema: rows are never edited except to revoke, so a level change revokes the live row and inserts a new
    one (same transaction). ``access_level`` here is the API value (read_only / full_access)."""
    actor = granted_by or employee_id  # granted_by_employee_id is NOT NULL
    db_level = to_db_level(access_level)
    existing = await _find_existing_grant(
        db,
        employee_id=employee_id,
        module_id=module_id,
        submodule_id=submodule_id,
    )
    previous_level: str | None = None
    action = AUDIT_ACTION_CREATED
    if existing is not None:
        previous_level = from_db_level(existing.access_level)
        if existing.access_level == db_level:
            return existing, None, previous_level  # unchanged: nothing to audit
        await _revoke_row(db, existing, revoked_by=actor)
        action = AUDIT_ACTION_UPDATED
    row = EmployeeAccessGrant(
        id=uuid.uuid4(),
        employee_id=employee_id,
        module_id=module_id,
        submodule_id=submodule_id,
        access_level=db_level,
        granted_by_employee_id=actor,
        granted_at=datetime.now(timezone.utc),
    )
    db.add(row)
    await db.flush()
    return row, action, previous_level


async def upsert_employee_grants(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    payload: dict[str, Any],
    granted_by: uuid.UUID | None,
    actor: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Upsert Active grants for one module selection.

    Flat module → one row with submodule_id NULL.
    Submodule module → one Active row per selected submodule.
    Existing Active/Revoked natural keys are updated / reactivated (no duplicates).
    """
    from app.modules.employee.access import actor_role

    target = await _get_employee_or_404(db, employee_id)
    assert_manage_access_target_role(
        actor_role=actor_role(actor) if actor else None,
        target_role=getattr(target, "role", None),
    )

    raw_module_id = payload.get("moduleId")
    if raw_module_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="moduleId is required.",
        )
    try:
        module_id = int(raw_module_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="moduleId must be an integer.",
        ) from exc

    access_level = str(payload.get("accessLevel") or "").strip()
    if access_level not in ACCESS_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="accessLevel must be read_only or full_access.",
        )

    module = await _load_module_or_400(db, module_id)
    submodule_ids = _normalize_submodule_ids(payload.get("submoduleIds"))

    if module.has_submodules:
        if not submodule_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select at least one submodule for this module.",
            )
        active_subs = {
            s.submodule_id: s
            for s in (module.submodules or [])
            if (s.status or MASTER_STATUS_ACTIVE) == MASTER_STATUS_ACTIVE
        }
        missing = [sid for sid in submodule_ids if sid not in active_subs]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more submoduleIds are invalid for this module.",
            )
        targets: list[int | None] = list(submodule_ids)
    else:
        if submodule_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This module does not support submodules.",
            )
        targets = [None]

    upserted: list[EmployeeAccessGrant] = []
    for submodule_id in targets:
        row, action, previous_level = await _upsert_one_grant(
            db,
            employee_id=employee_id,
            module_id=module_id,
            submodule_id=submodule_id,
            access_level=access_level,
            granted_by=granted_by,
        )
        # Attach catalog relationships for audit + response (no extra round-trip).
        set_committed_value(row, "module", module)
        set_committed_value(row, "submodule", None if submodule_id is None else active_subs[submodule_id])
        if action is not None:
            await record_grant_audit(
                db,
                action=action,
                grant=row,
                target=target,
                actor=actor,
                previous_access_level=previous_level,
            )
        upserted.append(row)

    return [_grant_to_dict(row) for row in upserted]


def _parse_access_rows(raw: Any) -> list[tuple[int, int | None, str]]:
    """Validate ``grants: [{moduleId, submoduleId?, accessLevel}]`` shape."""
    if not isinstance(raw, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="grants must be an array.",
        )
    rows: list[tuple[int, int | None, str]] = []
    seen: set[tuple[int, int | None]] = set()
    for item in raw:
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each grant must be an object.",
            )
        try:
            module_id = int(item.get("moduleId"))
            raw_sub = item.get("submoduleId")
            submodule_id = None if raw_sub is None else int(raw_sub)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="moduleId and submoduleId must be integers.",
            ) from exc
        level = str(item.get("accessLevel") or "").strip()
        if level not in ACCESS_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="accessLevel must be read_only or full_access.",
            )
        key = (module_id, submodule_id)
        if key in seen:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each module / submodule may appear only once.",
            )
        seen.add(key)
        rows.append((module_id, submodule_id, level))
    return rows


async def replace_employee_grants(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    payload: dict[str, Any],
    granted_by: uuid.UUID | None,
    actor: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Make the employee's Active grants exactly ``payload["grants"]``.

    Backs the Assign access dialog's single Save: listed rows are created,
    reactivated or re-levelled; Active rows not listed are revoked. Unchanged
    rows are left alone so the Audit Trail only records real changes.
    """
    from app.modules.employee.access import actor_role

    target = await _get_employee_or_404(db, employee_id)
    assert_manage_access_target_role(
        actor_role=actor_role(actor) if actor else None,
        target_role=getattr(target, "role", None),
    )
    desired = _parse_access_rows(payload.get("grants"))

    modules: dict[int, RbacModule] = {}
    for module_id, submodule_id, _level in desired:
        module = modules.get(module_id)
        if module is None:
            module = await _load_module_or_400(db, module_id)
            modules[module_id] = module
        if module.has_submodules:
            active_sub_ids = {
                s.submodule_id
                for s in (module.submodules or [])
                if (s.status or MASTER_STATUS_ACTIVE) == MASTER_STATUS_ACTIVE
            }
            if submodule_id is None or submodule_id not in active_sub_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{module.module_name} access must be granted per submodule.",
                )
        elif submodule_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{module.module_name} does not support submodules.",
            )

    current_result = await db.execute(
        select(EmployeeAccessGrant)
        .where(
            EmployeeAccessGrant.employee_id == employee_id,
            _active_grant(),
        )
        .options(
            selectinload(EmployeeAccessGrant.module),
            selectinload(EmployeeAccessGrant.submodule),
        )
    )
    current = {
        (row.module_id, row.submodule_id): row
        for row in current_result.scalars().all()
    }

    for module_id, submodule_id, level in desired:
        existing = current.get((module_id, submodule_id))
        if existing is not None and existing.access_level == to_db_level(level):
            continue
        row, action, previous_level = await _upsert_one_grant(
            db,
            employee_id=employee_id,
            module_id=module_id,
            submodule_id=submodule_id,
            access_level=level,
            granted_by=granted_by,
        )
        module = modules[module_id]
        set_committed_value(row, "module", module)
        set_committed_value(
            row, "submodule", next((s for s in module.submodules or [] if s.submodule_id == submodule_id), None)
        )
        await record_grant_audit(
            db,
            action=action,
            grant=row,
            target=target,
            actor=actor,
            previous_access_level=previous_level,
        )

    desired_keys = {(m, s) for m, s, _ in desired}
    now = datetime.now(timezone.utc)
    for key, row in current.items():
        if key in desired_keys:
            continue
        await _revoke_row(db, row, revoked_by=granted_by or employee_id)
        await record_grant_audit(
            db,
            action=AUDIT_ACTION_REVOKED,
            grant=row,
            target=target,
            actor=actor,
            previous_access_level=from_db_level(row.access_level),
        )

    return await list_employee_grants(db, employee_id=employee_id)


async def _load_grant_for_employee(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    grant_id: uuid.UUID,
) -> tuple[Employee, EmployeeAccessGrant]:
    employee = await _get_employee_or_404(db, employee_id)
    result = await db.execute(
        select(EmployeeAccessGrant)
        .where(
            EmployeeAccessGrant.grant_id == grant_id,
            EmployeeAccessGrant.employee_id == employee_id,
        )
        .options(
            selectinload(EmployeeAccessGrant.module),
            selectinload(EmployeeAccessGrant.submodule),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grant not found.",
        )
    return employee, row


async def update_grant_access_level(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    grant_id: uuid.UUID,
    access_level: str,
    granted_by: uuid.UUID | None,
    actor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Change access_level on an Active grant (RBAC-DATA-6)."""
    from app.modules.employee.access import actor_role

    level = (access_level or "").strip()
    if level not in ACCESS_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="accessLevel must be read_only or full_access.",
        )
    target, row = await _load_grant_for_employee(
        db, employee_id=employee_id, grant_id=grant_id
    )
    assert_manage_access_target_role(
        actor_role=actor_role(actor) if actor else None,
        target_role=getattr(target, "role", None),
    )
    if row.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Active grants can be edited. Re-grant to reactivate.",
        )
    previous_level = from_db_level(row.access_level)
    if row.access_level == to_db_level(level):
        return _grant_to_dict(row)
    # Grants are never edited: revoke the live row, insert the new level.
    old_module, old_submodule = row.module, row.submodule
    new_row, _action, _prev = await _upsert_one_grant(
        db,
        employee_id=employee_id,
        module_id=row.module_id,
        submodule_id=row.submodule_id,
        access_level=level,
        granted_by=granted_by,
    )
    set_committed_value(new_row, "module", old_module)
    set_committed_value(new_row, "submodule", old_submodule)
    await record_grant_audit(
        db,
        action=AUDIT_ACTION_UPDATED,
        grant=new_row,
        target=target,
        actor=actor,
        previous_access_level=previous_level,
    )
    return _grant_to_dict(new_row)


async def revoke_grant(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    grant_id: uuid.UUID,
    granted_by: uuid.UUID | None,
    actor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Soft-revoke: set status=Revoked (no hard delete). History retained."""
    from app.modules.employee.access import actor_role

    target, row = await _load_grant_for_employee(
        db, employee_id=employee_id, grant_id=grant_id
    )
    assert_manage_access_target_role(
        actor_role=actor_role(actor) if actor else None,
        target_role=getattr(target, "role", None),
    )
    if row.revoked_at is not None:
        return _grant_to_dict(row)
    await _revoke_row(db, row, revoked_by=granted_by or employee_id)
    await record_grant_audit(
        db,
        action=AUDIT_ACTION_REVOKED,
        grant=row,
        target=target,
        actor=actor,
        previous_access_level=from_db_level(row.access_level),
    )
    return _grant_to_dict(row)


def actor_employee_id(user: dict[str, Any]) -> uuid.UUID | None:
    raw = user.get("employeeId") or user.get("id")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return None
