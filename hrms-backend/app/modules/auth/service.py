"""Stateless auth: Microsoft Entra sign-in -> app JWT cookie. Nothing about a session is stored in the database.

* Link: ``employees.entra_oid`` (set on the first Entra sign-in); the work / personal email finds the employee the
  first time. A different Entra account for an already-linked employee is refused (``account_mismatch``).
* Token: carries userDetails (minus accessGrants) plus ``activeView`` / allowlist Superadmin flags.
  Logout only clears cookies; the token simply expires (``JWT_EXPIRE_MINUTES``).
* ``/auth/me`` rebuilds userDetails from the Employee row + RBAC grants, or from the allowlist for
  pure Superadmins (no employee row).
* Superadmin: ``SUPERADMIN_EMAILS`` allowlist. No ``employees`` row and no org-master bootstrap on
  Superadmin-only sign-in. A hired employee on the allowlist can switch Superadmin / Employee views.
* ``AUTH_BYPASS=true`` (local only): ``bypass_claims`` returns allowlist Superadmin claims (no employee row).
"""
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID
import json
import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.bootstrap_admin import (
    ALLOWLIST_SUPERADMIN_CLAIM,
    EMPLOYEE_VIEW,
    SUPERADMIN_VIEW,
    SUPERADMIN_VIEW_CLAIM,
    allowlist_superadmin_user_details,
    apply_session_view,
    can_use_superadmin_view,
    is_allowlist_superadmin_claims,
    is_superadmin_email,
    is_superadmin_view,
    parse_superadmin_emails,
)
from app.core.config import get_settings
from app.core.roles import Role, Status
from app.mail.invite import mark_invite_accepted
from app.core.security import (
    access_token_ttl,
    create_access_token,
)
from app.core.serialize import (
    parse_quick_actions_preference,
    user_details_from_employee,
)
from app.models.tables import Company, Employee
from app.modules.rbac.session_grants import (
    full_catalog_session_grants,
    resolve_session_grants,
)

logger = logging.getLogger(__name__)

_BLOCKED_STATUSES = frozenset(
    {
        Status.INACTIVE.value,
        Status.TERMINATED.value,
        Status.RESIGNED.value,
        Status.SUSPENDED.value,
        Status.EXITED.value,
    }
)

ACTIVE_VIEW_CLAIM = "activeView"
SYSTEM_ACCOUNT_CLAIM = "isSystemAccount"
_DEFAULT_BYPASS_EMAIL = "developer@example.com"


async def _employee_by_email(session: AsyncSession, normalized: str) -> Employee | None:
    result = await session.execute(
        select(Employee).where(func.lower(Employee.official_email) == normalized)
    )
    employee = result.scalar_one_or_none()
    if employee is None:
        # Secondary Microsoft mailboxes are often stored as personal_email.
        personal = await session.execute(
            select(Employee).where(func.lower(Employee.personal_email) == normalized)
        )
        employee = personal.scalars().first()
    return employee


async def linked_employee(session: AsyncSession, subject: str) -> Employee | None:
    """The employee linked to this Entra object id, if any."""
    result = await session.execute(select(Employee).where(Employee.entra_oid == subject))
    return result.scalar_one_or_none()


def _link_entra_oid(employee: Employee, subject: str, email: str) -> None:
    """Set ``employees.entra_oid`` on first sign-in; refuse a different Entra account for the same employee."""
    if employee.entra_oid and employee.entra_oid != subject:
        logger.warning("Sign-in refused: %s is linked to a different Entra account", email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="account_mismatch",
        )
    employee.entra_oid = subject


async def _company_payload(session: AsyncSession) -> dict[str, Any] | None:
    """The single company row, shaped as the shell expects."""
    company = (await session.execute(select(Company).limit(1))).scalar_one_or_none()
    if company is None:
        return None
    return {
        "companyId": str(company.id),
        "companyName": company.name,
        "companyType": company.company_type,
        "companyEmail": company.email,
    }


def _access_flags(role: str, grants: list[dict[str, Any]], *, superadmin: bool) -> SimpleNamespace:
    """create / edit / view / full flags (formerly user_access) derived from role + grants."""
    if superadmin:
        return SimpleNamespace(
            create_access=True, edit_access=True, view_access=True, full_access=True
        )
    full = any(g.get("accessLevel") == "full_access" for g in grants)
    elevated = role in {Role.ADMIN.value, Role.HR.value, Role.MANAGER.value}
    return SimpleNamespace(
        create_access=full or role in {Role.ADMIN.value, Role.HR.value},
        edit_access=full or elevated,
        view_access=True,
        full_access=full,
    )


def _views_payload(employee: Employee, *, superadmin_view: bool) -> dict[str, Any] | None:
    """Views an allowlisted employee can switch between; None for everyone else."""
    if not can_use_superadmin_view(get_settings(), employee):
        return None
    return {
        "available": [SUPERADMIN_VIEW, EMPLOYEE_VIEW],
        "active": SUPERADMIN_VIEW if superadmin_view else EMPLOYEE_VIEW,
    }


def _claims_for_token(
    user_details: dict[str, Any],
    *,
    employee: Employee | None,
    active_view: str | None,
    allowlist_superadmin: bool = False,
) -> dict[str, Any]:
    # accessGrants stay out of the cookie: /auth/me is the source of truth (no stale grants after Manage Access).
    claims = {k: v for k, v in user_details.items() if k != "accessGrants"}
    claims[SYSTEM_ACCOUNT_CLAIM] = bool(employee.is_system_account) if employee is not None else False
    claims[ALLOWLIST_SUPERADMIN_CLAIM] = allowlist_superadmin
    claims[ACTIVE_VIEW_CLAIM] = active_view
    return claims


class AuthService:
    async def build_user_details(
        self,
        session: AsyncSession,
        employee: Employee,
        *,
        superadmin: bool = False,
    ) -> dict[str, Any]:
        """userDetails from the Employee row + RBAC grants. Superadmin gets full access / catalog."""
        superadmin = superadmin or (
            bool(employee.is_system_account)
            and is_superadmin_email(get_settings(), employee.official_email or "")
        )
        grants = (
            await full_catalog_session_grants(session)
            if superadmin
            else await resolve_session_grants(session, employee_id=employee.id)
        )
        role = (employee.role or Role.EMPLOYEE.value).upper()
        details = user_details_from_employee(
            employee,
            _access_flags(role, grants, superadmin=superadmin),
            await _company_payload(session),
            access_grants=grants,
        )
        if superadmin:
            details["role"] = Role.SUPERADMIN.value
            details["department"] = Role.SUPERADMIN.value
        else:
            details["role"] = role
            details["department"] = employee.department_label or details.get("department")
        return details

    async def build_allowlist_superadmin_details(
        self,
        session: AsyncSession,
        *,
        email: str,
        display_name: str | None = None,
    ) -> dict[str, Any]:
        grants = await full_catalog_session_grants(session)
        return allowlist_superadmin_user_details(
            email=email,
            display_name=display_name,
            company=await _company_payload(session),
            access_grants=grants,
        )

    async def issue_session_for_identity(
        self,
        session: AsyncSession,
        *,
        provider: str | None,
        subject: str | None,
        email: str,
        display_name: str | None = None,
        user_agent: str | None = None,
    ) -> dict[str, Any]:
        """Sign in someone Entra has verified.

        The employee linked to ``subject`` (``employees.entra_oid``) is used first. The email only finds the employee
        the first time (and links ``entra_oid``). Allowlisted emails with no hired employee get a pure Superadmin
        session (no ``employees`` row). Allowlisted hired employees start in the Superadmin view and can switch.
        Legacy system-account Superadmin rows are ignored.
        """
        normalized = email.strip().lower()
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        subject = (subject or "").strip() or None

        employee = await linked_employee(session, subject) if subject else None
        if employee is None:
            employee = await _employee_by_email(session, normalized)
            if employee is not None and subject and not bool(employee.is_system_account):
                _link_entra_oid(employee, subject, normalized)
                await session.flush()

        settings = get_settings()
        allowlisted = is_superadmin_email(settings, normalized)

        # Legacy bootstrap rows: Superadmin is no longer stored as an employee.
        if employee is not None and bool(employee.is_system_account):
            if not allowlisted:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="not_provisioned",
                )
            logger.info(
                "Ignoring legacy system Superadmin row for allowlist sign-in: %s",
                normalized,
            )
            employee = None

        if employee is None:
            if not allowlisted:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="not_provisioned",
                )
            return await self.issue_session_for_allowlist_superadmin(
                session,
                email=normalized,
                display_name=display_name,
                user_agent=user_agent,
            )

        await mark_invite_accepted(session, employee)
        return await self.issue_session_for_employee(
            session,
            employee,
            user_agent=user_agent,
            active_view=SUPERADMIN_VIEW if allowlisted else None,
        )

    async def issue_session_for_email(
        self,
        session: AsyncSession,
        email: str,
        *,
        user_agent: str | None = None,
    ) -> dict[str, Any]:
        """Sign-in by email alone, with no Entra identity (test helpers)."""
        return await self.issue_session_for_identity(
            session, provider=None, subject=None, email=email, user_agent=user_agent
        )

    def _token_for(
        self,
        user_details: dict[str, Any],
        *,
        employee: Employee | None,
        active_view: str | None,
        allowlist_superadmin: bool = False,
    ) -> str:
        expires_at = datetime.now(UTC) + access_token_ttl()
        return create_access_token(
            _claims_for_token(
                user_details,
                employee=employee,
                active_view=active_view,
                allowlist_superadmin=allowlist_superadmin,
            ),
            expires_at=expires_at,
        )

    async def issue_session_for_allowlist_superadmin(
        self,
        session: AsyncSession,
        *,
        email: str,
        display_name: str | None = None,
        user_agent: str | None = None,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Allowlist Superadmin session with no ``employees`` row and no org-master writes."""
        user_details = await self.build_allowlist_superadmin_details(
            session, email=email, display_name=display_name
        )
        token = self._token_for(
            user_details,
            employee=None,
            active_view=SUPERADMIN_VIEW,
            allowlist_superadmin=True,
        )
        logger.info("Allowlist Superadmin signed in (no employee row): %s", email)
        return {"userDetails": user_details, "token": token}

    async def issue_session_for_employee(
        self,
        session: AsyncSession,
        employee: Employee,
        *,
        user_agent: str | None = None,  # noqa: ARG002 - kept for callers; nothing is stored
        active_view: str | None = None,
    ) -> dict[str, Any]:
        status_key = (employee.status or "").strip().upper()
        if status_key in _BLOCKED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is not active",
            )
        # The token carries the employee's own role; the Superadmin view is applied per request.
        user_details = await self.build_user_details(session, employee)
        token = self._token_for(user_details, employee=employee, active_view=active_view)
        if active_view == SUPERADMIN_VIEW:
            user_details = await self.build_user_details(session, employee, superadmin=True)
        return {"userDetails": user_details, "token": token}

    async def bypass_claims(self, session: AsyncSession) -> dict[str, Any]:
        """AUTH_BYPASS=true: run as allowlist Superadmin (no employee row created)."""
        settings = get_settings()
        emails = parse_superadmin_emails(settings.superadmin_emails)
        email = emails[0] if emails else _DEFAULT_BYPASS_EMAIL
        details = await self.build_allowlist_superadmin_details(session, email=email)
        claims = _claims_for_token(
            details,
            employee=None,
            active_view=SUPERADMIN_VIEW,
            allowlist_superadmin=True,
        )
        claims[SUPERADMIN_VIEW_CLAIM] = True
        return claims

    async def switch_view(
        self, session: AsyncSession, claims: dict[str, Any], view: str
    ) -> dict[str, Any]:
        """Switch an allowlisted employee between the Superadmin and Employee views (issues a fresh token)."""
        if is_allowlist_superadmin_claims(claims):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Allowlist Superadmin has no Employee view",
            )
        if view not in (SUPERADMIN_VIEW, EMPLOYEE_VIEW):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown view")
        employee = await self._employee_from_claims(session, claims)
        if not can_use_superadmin_view(get_settings(), employee):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Superadmin allowlisted employees can switch views",
            )
        active_view = SUPERADMIN_VIEW if view == SUPERADMIN_VIEW else None
        user_details = await self.build_user_details(session, employee)
        return {
            "view": view,
            "token": self._token_for(user_details, employee=employee, active_view=active_view),
        }

    async def _employee_from_claims(self, session: AsyncSession, claims: dict[str, Any]) -> Employee:
        raw_id = claims.get("employeeId")
        try:
            employee_id = UUID(str(raw_id))
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            ) from exc
        employee = (
            await session.execute(select(Employee).where(Employee.id == employee_id))
        ).scalar_one_or_none()
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account not found",
            )
        return employee

    async def me(
        self,
        session: AsyncSession,
        claims: dict[str, Any],
        *,
        employee: Employee | None = None,
    ) -> dict[str, Any]:
        """Session payload rebuilt from the database (or allowlist for pure Superadmin)."""
        if is_allowlist_superadmin_claims(claims):
            email = str(claims.get("emailId") or "")
            if not is_superadmin_email(get_settings(), email):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired or revoked",
                )
            user_details = await self.build_allowlist_superadmin_details(
                session,
                email=email,
                display_name=" ".join(
                    p
                    for p in (
                        str(claims.get("firstName") or ""),
                        str(claims.get("lastName") or ""),
                    )
                    if p
                )
                or None,
            )
            return {"userDetails": user_details, "views": None}

        if employee is None:
            employee = await self._employee_from_claims(session, claims)
        superadmin_view = is_superadmin_view(claims)
        user_details = await self.build_user_details(
            session, employee, superadmin=superadmin_view
        )
        return {
            "userDetails": user_details,
            # Superadmin / Employee views for allowlisted employees (view switcher).
            "views": _views_payload(employee, superadmin_view=superadmin_view),
        }

    async def update_theme_preference(
        self,
        session: AsyncSession,
        claims: dict[str, Any],
        preference: str,
    ) -> dict[str, str]:
        allowed = {"light", "dark", "system"}
        if preference not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="themePreference must be light, dark, or system",
            )
        if is_allowlist_superadmin_claims(claims):
            # No employee row to persist against; accept for the session only.
            return {"themePreference": preference}
        employee = await self._employee_from_claims(session, claims)
        employee.theme_preference = preference
        await session.flush()
        return {"themePreference": preference}

    async def update_quick_actions_preference(
        self,
        session: AsyncSession,
        claims: dict[str, Any],
        preference: list[str],
    ) -> dict[str, list[str]]:
        cleaned = parse_quick_actions_preference(preference)
        if cleaned is None:
            cleaned = []
        if is_allowlist_superadmin_claims(claims):
            return {"quickActionsPreference": cleaned}
        employee = await self._employee_from_claims(session, claims)
        employee.quick_actions_preference = json.dumps(cleaned)
        await session.flush()
        return {"quickActionsPreference": cleaned}

    async def logout(self, session: AsyncSession, claims: dict[str, Any]) -> dict[str, str]:  # noqa: ARG002
        """Stateless: nothing to revoke. The router clears the cookies."""
        return {"status": "ok"}

    async def require_active_session(
        self, session: AsyncSession, claims: dict[str, Any]  # noqa: ARG002
    ) -> dict[str, Any]:
        """Kept for callers: the signed, unexpired JWT checked in ``get_current_user`` is the session."""
        return claims
