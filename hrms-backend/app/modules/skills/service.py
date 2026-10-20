from __future__ import annotations

import uuid

from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import get_storage
from app.models.tables import Employee, EmployeeSkill, Skill
from app.modules.employee.profile_audit import record_profile_audit, snapshot_skills
from app.modules.org.service import (
    MASTER_STATUS_ACTIVE,
    viewer_sees_inactive,
)

SKILL_NAME_TAKEN = "A skill with this name already exists."
SKILL_ALREADY_ATTACHED = "This skill is already on the employee."
SKILL_NOT_ACTIVE = "That skill is not active. Choose another from the list."
SKILL_ALREADY_IN_CATALOG = "That skill is already on the list. Choose it instead of requesting a new one."
SKILL_ALREADY_ON_EMPLOYEE = "This employee already has that skill."
SKILL_MERGE_SAME = "Choose two different skills. Keep the official name and deactivate the extra one."
CATALOG_LOCKED = (
    "The skills catalog is managed by data migration and cannot be changed in the app."
)
EMPLOYEE_SKILL_KIND_CATALOG = "catalog"
EMPLOYEE_SKILL_KIND_CUSTOM = "employee_only"


def _catalog_locked() -> None:
    raise HTTPException(status_code=403, detail=CATALOG_LOCKED)


def _actor_name(actor: dict) -> str | None:
    return f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def skill_to_dict(row: Skill) -> dict[str, Any]:
    return {
        "skillId": str(row.skill_id),
        "skillName": row.skill_name,
        "createdDate": row.created_date.isoformat() if row.created_date else None,
    }


def employee_skill_to_dict(row: EmployeeSkill) -> dict[str, Any]:
    skill = row.skill
    is_catalog = row.is_catalog_skill if row.is_catalog_skill is not None else True
    if is_catalog and skill is not None:
        display_name = skill.skill_name
        status = MASTER_STATUS_ACTIVE
        kind = EMPLOYEE_SKILL_KIND_CATALOG
        skill_id = str(row.skill_id) if row.skill_id else None
    else:
        display_name = row.proposed_skill_name or (skill.skill_name if skill else None)
        status = "Custom (not in catalog)"
        kind = EMPLOYEE_SKILL_KIND_CUSTOM
        skill_id = None
    object_key = getattr(row, "certificate_object_key", None)
    file_name = getattr(row, "certificate_file_name", None)
    cert_name = getattr(row, "certificate_name", None)
    if not isinstance(object_key, str) or not object_key:
        object_key = None
    if not isinstance(file_name, str) or not file_name:
        file_name = None
    if not isinstance(cert_name, str) or not cert_name.strip():
        cert_name = None
    expires = getattr(row, "certificate_expires_on", None)
    expires_on: str | None = None
    if isinstance(expires, datetime):
        expires_on = expires.date().isoformat()
    elif isinstance(expires, date):
        expires_on = expires.isoformat()
    elif isinstance(expires, str) and expires.strip():
        expires_on = expires.strip()[:10]
    return {
        "employeeSkillId": str(row.employee_skill_id),
        "skillId": skill_id,
        "skillName": display_name,
        "status": status,
        "kind": kind,
        "isCatalogSkill": is_catalog,
        "proficiency": row.proficiency,
        "yearsExperience": row.years_experience,
        "hasCertificate": bool(object_key or cert_name),
        "certificateName": cert_name,
        "certificateExpiresOn": expires_on,
        "certificateFileName": file_name,
        "certificateObjectKey": object_key,
    }


async def _flush_unique(db: AsyncSession, *, index_name: str, detail: str) -> None:
    try:
        await db.flush()
    except IntegrityError as exc:
        message = str(getattr(exc, "orig", exc))
        if index_name in message:
            raise HTTPException(status_code=409, detail=detail) from exc
        raise


async def assert_catalog_skill(db: AsyncSession, skill_id: uuid.UUID) -> Skill:
    """Require a catalog skill id (shared platform catalog; no Active/Inactive gate)."""
    result = await db.execute(select(Skill).where(Skill.skill_id == skill_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=400, detail="That skill was not found.")
    return row


# Back-compat alias used by older imports/tests.
async def assert_active_skill(
    db: AsyncSession, skill_id: uuid.UUID, *, company_id: uuid.UUID | None = None
) -> Skill:
    del company_id
    return await assert_catalog_skill(db, skill_id)


async def list_skills(
    db: AsyncSession, actor: dict[str, Any], *, include_inactive: bool = False
) -> list[dict]:
    del actor, include_inactive
    result = await db.execute(select(Skill).order_by(Skill.skill_name))
    return [skill_to_dict(row) for row in result.scalars().all()]


async def get_skill(
    db: AsyncSession,
    actor: dict[str, Any],
    skill_id: uuid.UUID,
    *,
    include_inactive: bool = False,
) -> dict:
    del actor, include_inactive
    result = await db.execute(select(Skill).where(Skill.skill_id == skill_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill_to_dict(row)


async def create_skill(db: AsyncSession, actor: dict, body: dict[str, Any]) -> dict:
    del db, actor, body
    _catalog_locked()


async def update_skill(
    db: AsyncSession, actor: dict, skill_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    del db, actor, skill_id, body
    _catalog_locked()


async def list_employee_skills(db: AsyncSession, employee_id: uuid.UUID) -> list[dict]:
    """Catalog and employee-only skills for this employee."""
    result = await db.execute(
        select(EmployeeSkill)
        .where(EmployeeSkill.employee_id == employee_id)
        .order_by(EmployeeSkill.created_date)
    )
    return [employee_skill_to_dict(row) for row in result.scalars().all()]


def _parse_skill_ids(body: dict[str, Any]) -> list[uuid.UUID]:
    raw_ids = body.get("skillIds")
    single = body.get("skillId")
    values: list[Any] = []
    if isinstance(raw_ids, list):
        values.extend(raw_ids)
    if single not in (None, ""):
        values.append(single)
    if not values:
        raise HTTPException(status_code=400, detail="Choose at least one skill.")
    parsed: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()
    for item in values:
        try:
            skill_id = uuid.UUID(str(item))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="That skill was not found.") from exc
        if skill_id not in seen:
            seen.add(skill_id)
            parsed.append(skill_id)
    return parsed


def _optional_years(body: dict[str, Any]) -> int | None:
    raw = body.get("yearsExperience")
    if raw in (None, ""):
        return None
    try:
        years = int(raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400, detail="Years of experience must be a whole number."
        ) from exc
    if years < 0:
        raise HTTPException(status_code=400, detail="Years of experience cannot be negative.")
    return years


def _optional_certificate_name(body: dict[str, Any]) -> str | None:
    raw = body.get("certificateName")
    if raw in (None, ""):
        return None
    name = str(raw).strip()
    return name or None


def _optional_certificate_expiry(body: dict[str, Any]) -> date | None:
    raw = body.get("certificateExpiresOn")
    if raw in (None, ""):
        return None
    parsed: date
    if isinstance(raw, datetime):
        parsed = raw.date()
    elif isinstance(raw, date):
        parsed = raw
    else:
        try:
            parsed = date.fromisoformat(str(raw).strip()[:10])
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail="Certificate expiry must be a valid date."
            ) from exc
    if parsed <= date.today():
        raise HTTPException(
            status_code=400, detail="Certificate expiry must be a future date."
        )
    return parsed


def _apply_certificate_meta(row: EmployeeSkill, body: dict[str, Any]) -> None:
    if "certificateName" in body:
        row.certificate_name = _optional_certificate_name(body)
    if "certificateExpiresOn" in body:
        row.certificate_expires_on = _optional_certificate_expiry(body)


async def attach_employee_skills(
    db: AsyncSession, actor: dict, employee_id: uuid.UUID, body: dict[str, Any]
) -> list[dict]:
    """Link catalog skills to an employee by id (optional years/proficiency)."""
    exists = await db.execute(select(Employee.employee_id).where(Employee.employee_id == employee_id))
    if exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    before = await snapshot_skills(db, employee_id)
    skill_ids = _parse_skill_ids(body)
    proficiency = (str(body["proficiency"]).strip() or None) if body.get("proficiency") else None
    years = _optional_years(body)
    now = _now()
    actor_name = _actor_name(actor)
    attached: list[EmployeeSkill] = []
    for skill_id in skill_ids:
        await assert_catalog_skill(db, skill_id)
        already = await db.execute(
            select(EmployeeSkill.employee_skill_id).where(
                EmployeeSkill.employee_id == employee_id,
                EmployeeSkill.skill_id == skill_id,
            )
        )
        if already.scalar_one_or_none() is not None:
            if len(skill_ids) == 1:
                raise HTTPException(status_code=409, detail=SKILL_ALREADY_ATTACHED)
            continue
        row = EmployeeSkill(
            employee_id=employee_id,
            skill_id=skill_id,
            is_catalog_skill=True,
            proficiency=proficiency,
            years_experience=years,
            certificate_name=_optional_certificate_name(body),
            certificate_expires_on=_optional_certificate_expiry(body),
            created_by=actor_name,
            updated_by=actor_name,
            created_date=now,
            updated_date=now,
        )
        db.add(row)
        attached.append(row)
    await _flush_unique(db, index_name="ux_employee_skill_pair", detail=SKILL_ALREADY_ATTACHED)
    if not attached:
        raise HTTPException(status_code=409, detail=SKILL_ALREADY_ATTACHED)
    after = await snapshot_skills(db, employee_id)
    await record_profile_audit(
        db,
        employee_id=employee_id,
        before=before,
        after=after,
        actor=actor,
    )
    return await list_employee_skills(db, employee_id)


async def _attach_skill_if_missing(
    db: AsyncSession,
    actor: dict,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
) -> None:
    """Put a catalog skill on the employee if it is not already there."""
    await assert_catalog_skill(db, skill_id)
    already = await db.execute(
        select(EmployeeSkill.employee_skill_id).where(
            EmployeeSkill.employee_id == employee_id,
            EmployeeSkill.skill_id == skill_id,
        )
    )
    if already.scalar_one_or_none() is not None:
        return
    now = _now()
    actor_name = _actor_name(actor)
    db.add(
        EmployeeSkill(
            employee_id=employee_id,
            skill_id=skill_id,
            is_catalog_skill=True,
            created_by=actor_name,
            updated_by=actor_name,
            created_date=now,
            updated_date=now,
        )
    )


def _parse_uuid_field(body: dict[str, Any], field: str) -> uuid.UUID | None:
    raw = body.get(field)
    if raw in (None, ""):
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="That skill was not found.") from exc


async def merge_skills(db: AsyncSession, actor: dict, body: dict[str, Any]) -> dict:
    del db, actor, body
    _catalog_locked()


def _remove_certificate_object(object_key: str | None) -> None:
    if not object_key:
        return
    try:
        get_storage().remove(object_key)
    except Exception:
        pass


async def get_employee_skill(
    db: AsyncSession, employee_id: uuid.UUID, skill_id: uuid.UUID
) -> EmployeeSkill:
    result = await db.execute(
        select(EmployeeSkill).where(
            EmployeeSkill.employee_id == employee_id,
            EmployeeSkill.skill_id == skill_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="That skill is not on this employee.")
    return row


async def update_employee_skill(
    db: AsyncSession,
    actor: dict,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    """Update proficiency/years on an attached catalog skill without dropping the certificate."""
    row = await get_employee_skill(db, employee_id, skill_id)
    if "proficiency" in body:
        raw = body.get("proficiency")
        row.proficiency = (str(raw).strip() or None) if raw else None
    if "yearsExperience" in body:
        row.years_experience = _optional_years(body)
    _apply_certificate_meta(row, body)
    row.updated_by = _actor_name(actor)
    row.updated_date = _now()
    await db.flush()
    return employee_skill_to_dict(row)


async def set_skill_certificate(
    db: AsyncSession,
    actor: dict,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    object_key: str,
    file_name: str,
) -> tuple[dict[str, Any], str | None]:
    row = await get_employee_skill(db, employee_id, skill_id)
    previous = row.certificate_object_key
    row.certificate_object_key = object_key
    row.certificate_file_name = file_name
    row.updated_by = _actor_name(actor)
    row.updated_date = _now()
    await db.flush()
    previous_to_remove = previous if previous and previous != object_key else None
    return employee_skill_to_dict(row), previous_to_remove


async def clear_skill_certificate(
    db: AsyncSession,
    actor: dict,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
) -> dict:
    row = await get_employee_skill(db, employee_id, skill_id)
    previous = row.certificate_object_key
    row.certificate_object_key = None
    row.certificate_file_name = None
    row.certificate_name = None
    row.certificate_expires_on = None
    row.updated_by = _actor_name(actor)
    row.updated_date = _now()
    await db.flush()
    _remove_certificate_object(previous)
    return employee_skill_to_dict(row)


async def detach_employee_skill(
    db: AsyncSession,
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    *,
    actor: dict | None = None,
) -> dict:
    before = await snapshot_skills(db, employee_id)
    row = await get_employee_skill(db, employee_id, skill_id)
    previous = row.certificate_object_key
    await db.delete(row)
    await db.flush()
    after = await snapshot_skills(db, employee_id)
    await record_profile_audit(
        db,
        employee_id=employee_id,
        before=before,
        after=after,
        actor=actor,
    )
    _remove_certificate_object(previous)
    return {"employeeId": str(employee_id), "skillId": str(skill_id), "deleted": True}


# Re-export for routers that already import org viewer helper.
__all__ = [
    "CATALOG_LOCKED",
    "SKILL_NAME_TAKEN",
    "SKILL_NOT_ACTIVE",
    "assert_active_skill",
    "assert_catalog_skill",
    "attach_employee_skills",
    "create_skill",
    "merge_skills",
    "detach_employee_skill",
    "employee_skill_to_dict",
    "get_employee_skill",
    "get_skill",
    "list_employee_skills",
    "list_skills",
    "set_skill_certificate",
    "clear_skill_certificate",
    "skill_to_dict",
    "update_employee_skill",
    "update_skill",
    "viewer_sees_inactive",
]
