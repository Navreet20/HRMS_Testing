"""Who receives a department notification.

Uses live employee_access_grants (Manage/Edit on the module). Falls back to
companySetup Manage holders, then SUPERADMIN_EMAILS — same idea as live HRMS.
"""

from __future__ import annotations

from typing import Final

from sqlalchemy import func, or_, select

from app.core.bootstrap_admin import parse_superadmin_emails
from app.core.config import get_settings
from app.core.roles import Status
from app.db.session import async_session_maker
from app.models.tables import Employee, EmployeeAccessGrant, Module, Submodule
from app.modules.rbac.catalog import MODULE_KEY_BY_NAME, SUBMODULE_KEY_BY_NAME

_MODULE_NAME_BY_KEY: Final = {key: name for name, key in MODULE_KEY_BY_NAME.items()}
_SUBMODULE_NAME_BY_KEY: Final = {key: name for name, key in SUBMODULE_KEY_BY_NAME.items()}
_INACTIVE_STATUSES: Final = frozenset(
    {
        Status.INACTIVE.value,
        Status.TERMINATED.value,
        Status.RESIGNED.value,
        Status.SUSPENDED.value,
        Status.EXITED.value,
    }
)
COMPANY_SETUP_KEY: Final = "companySetup"


async def _full_access_emails(
    module_key: str,
    submodule_key: str | None = None,
    *,
    include_system_accounts: bool = True,
) -> list[str]:
    # Prefer module_key match on modules.module_key (new schema).
    stmt = (
        select(Employee.official_email)
        .join(EmployeeAccessGrant, EmployeeAccessGrant.employee_id == Employee.id)
        .join(Module, Module.id == EmployeeAccessGrant.module_id)
        .outerjoin(
            Submodule,
            (Submodule.module_id == EmployeeAccessGrant.module_id)
            & (Submodule.id == EmployeeAccessGrant.submodule_id),
        )
        .where(
            EmployeeAccessGrant.revoked_at.is_(None),
            EmployeeAccessGrant.access_level.in_(("Manage", "Edit")),
            Module.module_key == module_key,
            func.upper(func.coalesce(Employee.status, "")).notin_(_INACTIVE_STATUSES),
        )
    )
    if submodule_key:
        stmt = stmt.where(
            or_(
                EmployeeAccessGrant.submodule_id.is_(None),
                Submodule.submodule_key == submodule_key,
            )
        )
    if not include_system_accounts:
        stmt = stmt.where(Employee.is_system_account.is_(False))
    try:
        async with async_session_maker() as db:
            emails = (await db.execute(stmt)).scalars().all()
    except Exception:
        return []
    return _clean(emails)


def _clean(emails) -> list[str]:
    out: list[str] = []
    for raw in emails:
        email = (raw or "").strip().lower()
        if "@" in email and email not in out:
            out.append(email)
    return out


async def notification_recipients(
    module_key: str, submodule_key: str | None = None
) -> list[str]:
    """Emails for a department notification: access holders → Admins → Superadmins."""
    # Accept either API key or catalog display name.
    key = MODULE_KEY_BY_NAME.get(module_key, module_key)
    sub = SUBMODULE_KEY_BY_NAME.get(submodule_key or "", submodule_key)
    recipients = await _full_access_emails(key, sub)
    if recipients:
        return recipients
    admins = await _full_access_emails(COMPANY_SETUP_KEY, include_system_accounts=False)
    if admins:
        return admins
    return parse_superadmin_emails(get_settings().superadmin_emails)
