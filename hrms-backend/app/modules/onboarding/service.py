"""Onboarding service: create from template and recompute status.

Backs the Employees invite flow (the invite token lives on EMPLOYEE_ONBOARDING)
and the document-expiry job.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.awaiting import (DocumentType, EmployeeBankAccount, EmployeeOnboarding, OnboardingActivity, OnboardingChecklistItem, OnboardingTemplate, OnboardingTemplateItem)
from app.models.tables import Employee
from app.modules.onboarding import access as ob_access
from app.modules.onboarding.defaults import (
    DEFAULT_MIME_TYPES,
    DEFAULT_TEMPLATE_ITEMS,
    DEFAULT_TEMPLATE_NAME,
    DEFAULT_WORK_AUTH_DOCUMENT_CODES,
    OPTIONAL_CHECKLIST_ITEM_TYPES,
    SEED_DOCUMENT_TYPES,
)
from app.modules.onboarding.enums import (
    ChecklistItemStatus,
    ChecklistItemType,
    OnboardingStatus,
)
from app.modules.onboarding.status import (
    ChecklistItemView,
    derive_onboarding_status,
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _items_as_views(items: list[OnboardingChecklistItem]) -> list[ChecklistItemView]:
    return [
        ChecklistItemView(
            id=str(i.id),
            type=i.type,
            label=i.label,
            is_mandatory=bool(i.is_mandatory),
            status=i.status,
        )
        for i in items
    ]


async def _primary_bank_status(session: AsyncSession, employee_id: uuid.UUID) -> str | None:
    result = await session.execute(
        select(EmployeeBankAccount)
        .where(
            EmployeeBankAccount.employee_id == employee_id,
            EmployeeBankAccount.is_primary.is_(True),
        )
        .order_by(EmployeeBankAccount.created_at.desc().nulls_last())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row.status if row else None


async def log_activity(
    session: AsyncSession,
    *,
    onboarding_id: uuid.UUID,
    actor: dict[str, Any] | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    session.add(
        OnboardingActivity(
            onboarding_id=onboarding_id,
            actor_id=ob_access.actor_employee_id(actor) if actor else None,
            actor_name=ob_access.actor_display_name(actor) if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            from_status=from_status,
            to_status=to_status,
            payload=payload,
            created_at=_utcnow(),
        )
    )


# Back-compat alias used by early callers
_log_activity = log_activity


async def get_default_template(session: AsyncSession) -> OnboardingTemplate | None:
    result = await session.execute(
        select(OnboardingTemplate)
        .options(selectinload(OnboardingTemplate.items))
        .where(
            OnboardingTemplate.is_default.is_(True),
            OnboardingTemplate.is_active.is_(True),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def recompute_status(
    session: AsyncSession,
    onboarding: EmployeeOnboarding,
    *,
    actor: dict[str, Any] | None = None,
) -> str:
    """Single entry point: recompute and persist derived status."""
    items = list(onboarding.items or [])
    bank_status = await _primary_bank_status(session, onboarding.employee_id)
    previous = onboarding.status
    derived = derive_onboarding_status(
        current_status=previous,
        items=_items_as_views(items),
        primary_bank_status=bank_status,
    )
    if derived != previous:
        onboarding.status = derived
        onboarding.updated_at = _utcnow()
        if previous == OnboardingStatus.NOT_STARTED and derived == OnboardingStatus.IN_PROGRESS:
            if onboarding.started_at is None:
                onboarding.started_at = _utcnow()
        await _log_activity(
            session,
            onboarding_id=onboarding.id,
            actor=actor,
            action="STATUS_CHANGED",
            from_status=previous,
            to_status=derived,
        )
    return derived


async def get_onboarding_for_employee(
    session: AsyncSession, employee_id: uuid.UUID
) -> EmployeeOnboarding | None:
    try:
        stmt = select(EmployeeOnboarding).where(EmployeeOnboarding.employee_id == employee_id)
    except HTTPException:
        # Onboarding tables are not in the 37-table schema (Awaiting Refinement): no onboarding record.
        return None
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return await load_onboarding(session, row.id)


async def ensure_onboarding_for_employee(
    session: AsyncSession,
    *,
    employee_id: uuid.UUID,
    actor: dict[str, Any],
    template_id: uuid.UUID | None = None,
    joining_date: date | None = None,
) -> EmployeeOnboarding:
    """Return existing onboarding or create from the default/active template."""
    existing = await get_onboarding_for_employee(session, employee_id)
    if existing is not None:
        return existing
    await ensure_default_template_seed(session)
    return await create_onboarding(
        session,
        employee_id=employee_id,
        actor=actor,
        template_id=template_id,
        joining_date=joining_date,
    )


async def create_onboarding(
    session: AsyncSession,
    *,
    employee_id: uuid.UUID,
    actor: dict[str, Any],
    template_id: uuid.UUID | None = None,
    joining_date: date | None = None,
) -> EmployeeOnboarding:
    existing = await session.execute(
        select(EmployeeOnboarding).where(EmployeeOnboarding.employee_id == employee_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Onboarding already exists for this employee",
        )

    emp_result = await session.execute(select(Employee).where(Employee.employee_id == employee_id))
    employee = emp_result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if template_id is not None:
        tpl_result = await session.execute(
            select(OnboardingTemplate)
            .options(selectinload(OnboardingTemplate.items))
            .where(OnboardingTemplate.id == template_id, OnboardingTemplate.is_active.is_(True))
        )
        template = tpl_result.scalar_one_or_none()
    else:
        await ensure_default_template_seed(session)
        template = await get_default_template(session)

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active onboarding template available",
        )

    now = _utcnow()
    join = joining_date
    if join is None and employee.employment_start_date:
        try:
            join = date.fromisoformat(str(employee.employment_start_date)[:10])
        except ValueError:
            join = None

    onboarding = EmployeeOnboarding(
        employee_id=employee_id,
        template_id=template.id,
        status=OnboardingStatus.NOT_STARTED,
        joining_date=join,
        created_by=ob_access.actor_display_name(actor),
        created_at=now,
        updated_at=now,
    )
    session.add(onboarding)
    await session.flush()

    for tpl_item in sorted(template.items, key=lambda x: x.sequence):
        due: date | None = None
        if tpl_item.sla_days is not None and join is not None:
            due = join + timedelta(days=int(tpl_item.sla_days))
        session.add(
            OnboardingChecklistItem(
                onboarding_id=onboarding.id,
                template_item_id=tpl_item.id,
                type=tpl_item.type,
                label=tpl_item.label,
                sequence=tpl_item.sequence,
                is_mandatory=tpl_item.is_mandatory,
                assigned_role=tpl_item.assigned_role,
                status=ChecklistItemStatus.PENDING,
                due_date=due,
                config=dict(tpl_item.config or {}),
            )
        )

    await session.flush()
    await session.refresh(onboarding, attribute_names=["items"])
    await _log_activity(
        session,
        onboarding_id=onboarding.id,
        actor=actor,
        action="CREATED",
        payload={"templateId": str(template.id), "templateName": template.name},
    )
    await recompute_status(session, onboarding, actor=actor)
    return onboarding


async def load_onboarding(
    session: AsyncSession, onboarding_id: uuid.UUID
) -> EmployeeOnboarding:
    result = await session.execute(
        select(EmployeeOnboarding)
        .options(selectinload(EmployeeOnboarding.items), selectinload(EmployeeOnboarding.activities))
        .where(EmployeeOnboarding.id == onboarding_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding not found")
    return row


async def ensure_default_document_types(session: AsyncSession) -> int:
    """Insert baseline compliance types (incl. BANK_PROOF) if missing.

    Safe on every API startup so onboarding bank verification does not
    depend on any manual seed step. Existing seed
    types are aligned to optional (``is_mandatory`` from ``SEED_DOCUMENT_TYPES``)
    without wiping employee documents.
    """
    changed = 0
    now = _utcnow()
    for spec in SEED_DOCUMENT_TYPES:
        existing = (
            await session.execute(select(DocumentType).where(DocumentType.code == spec["code"]))
        ).scalar_one_or_none()
        desired_mandatory = bool(spec["is_mandatory"])
        if existing is not None:
            if existing.is_mandatory != desired_mandatory:
                existing.is_mandatory = desired_mandatory
                existing.updated_at = now
                changed += 1
            continue
        session.add(
            DocumentType(
                code=spec["code"],
                name=spec["name"],
                category=spec["category"],
                is_mandatory=desired_mandatory,
                requires_expiry=bool(spec["requires_expiry"]),
                requires_document_number=bool(spec["requires_document_number"]),
                requires_issuing_country=bool(spec["requires_issuing_country"]),
                allowed_mime_types=list(DEFAULT_MIME_TYPES),
                max_file_size_mb=5,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
        changed += 1
    if changed:
        await session.flush()
    return changed


def _merge_work_auth_codes(config: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(config or {})
    codes = list(merged.get("document_type_codes") or [])
    for code in DEFAULT_WORK_AUTH_DOCUMENT_CODES:
        if code not in codes:
            codes.append(code)
    merged["document_type_codes"] = codes
    return merged


async def _align_default_template_items(
    session: AsyncSession, template: OnboardingTemplate
) -> None:
    """Flip default Work Authorization / Payroll items to optional in place."""
    spec_by_type = {str(spec["type"]): spec for spec in DEFAULT_TEMPLATE_ITEMS}
    now = _utcnow()
    changed = False
    for item in template.items or []:
        spec = spec_by_type.get(str(item.type))
        if spec is None:
            continue
        desired_mandatory = bool(spec["is_mandatory"])
        if item.is_mandatory != desired_mandatory:
            item.is_mandatory = desired_mandatory
            changed = True
        if item.type == ChecklistItemType.DOCUMENT_GROUP:
            merged = _merge_work_auth_codes(item.config)
            if merged != dict(item.config or {}):
                item.config = merged
                changed = True
    if changed:
        template.updated_at = now
        await session.flush()


async def _align_existing_checklist_optionality(session: AsyncSession) -> None:
    """Make existing employee Work Auth / Payroll checklist items optional.

    Copies ``is_mandatory`` from the live template at create time, so already-
    invited hires stay Required until this runs on API startup. Does not delete
    documents, bank rows, or onboarding history.
    """
    result = await session.execute(
        select(OnboardingChecklistItem).where(
            OnboardingChecklistItem.type.in_(tuple(OPTIONAL_CHECKLIST_ITEM_TYPES)),
            OnboardingChecklistItem.is_mandatory.is_(True),
        )
    )
    items = list(result.scalars().all())
    if not items:
        return

    onboarding_ids = {item.onboarding_id for item in items}
    for item in items:
        item.is_mandatory = False
    await session.flush()

    terminal = {OnboardingStatus.COMPLETED, OnboardingStatus.CANCELLED}
    for onboarding_id in onboarding_ids:
        onboarding = await load_onboarding(session, onboarding_id)
        if onboarding.status in terminal:
            continue
        await recompute_status(session, onboarding)


async def ensure_default_template_seed(session: AsyncSession) -> OnboardingTemplate:
    """Idempotent seed + required→optional alignment (API startup)."""
    await ensure_default_document_types(session)
    existing = await get_default_template(session)
    if existing is None:
        now = _utcnow()
        template = OnboardingTemplate(
            name=DEFAULT_TEMPLATE_NAME,
            is_default=True,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(template)
        await session.flush()

        for spec in DEFAULT_TEMPLATE_ITEMS:
            session.add(
                OnboardingTemplateItem(
                    template_id=template.id,
                    type=str(spec["type"]),
                    label=str(spec["label"]),
                    sequence=int(spec["sequence"]),
                    is_mandatory=bool(spec["is_mandatory"]),
                    assigned_role=str(spec["assigned_role"]),
                    sla_days=spec["sla_days"],
                    config=dict(spec["config"] or {}),
                )
            )
        await session.flush()
        await session.refresh(template, attribute_names=["items"])
    else:
        await _align_default_template_items(session, existing)
        await session.refresh(existing, attribute_names=["items"])
        template = existing

    await _align_existing_checklist_optionality(session)
    return template
