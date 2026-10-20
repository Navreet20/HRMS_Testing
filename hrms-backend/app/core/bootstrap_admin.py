"""Superadmin allowlist (``SUPERADMIN_EMAILS``) for Microsoft Entra sign-in.

Allowlisted emails are Superadmins by configuration only. Signing in does **not**
create an ``employees`` row and does **not** seed company / department /
designation / location masters.

* Allowlisted, no employee row → pure Superadmin session (JWT only).
* Allowlisted email that already belongs to a normal (hired) employee → one
  employee account that can switch Superadmin / Employee views
  (``POST /auth/switch-view``). The Superadmin view is re-checked against the
  allowlist on every request.
* Legacy ``is_system_account`` Superadmin rows are ignored at sign-in and are
  not created anymore.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.core.config import Settings, get_settings
from app.core.roles import Role
from app.models.tables import Employee

logger = logging.getLogger(__name__)

SUPERADMIN_VIEW = "superadmin"
EMPLOYEE_VIEW = "employee"
# Request-claims flag set by ``apply_session_view`` for the Superadmin view.
SUPERADMIN_VIEW_CLAIM = "superadminView"
# JWT / session flag: allowlisted Superadmin with no employee row.
ALLOWLIST_SUPERADMIN_CLAIM = "allowlistSuperadmin"


def parse_superadmin_emails(raw: str) -> list[str]:
    """``"a@x.com, B@x.com;c@x.com"`` → ``["a@x.com", "b@x.com", "c@x.com"]``.

    Commas, semicolons and whitespace separate entries; entries without ``@``
    and repeats (any case) are skipped.
    """
    emails: list[str] = []
    for token in re.split(r"[,;\s]+", raw or ""):
        email = token.strip().lower()
        if "@" in email and email not in emails:
            emails.append(email)
    return emails


def is_superadmin_email(settings: Settings, email: str) -> bool:
    return (email or "").strip().lower() in parse_superadmin_emails(
        settings.superadmin_emails
    )


def can_use_superadmin_view(settings: Settings, employee: Employee) -> bool:
    """A normal hired employee whose email is allowlisted can switch into Superadmin view."""
    if bool(getattr(employee, "is_system_account", False)):
        return False
    return is_superadmin_email(settings, employee.email_id or "")


def is_allowlist_superadmin_claims(claims: dict | None) -> bool:
    return bool(claims and claims.get(ALLOWLIST_SUPERADMIN_CLAIM))


def is_unlisted_allowlist_superadmin(claims: dict | None) -> bool:
    """Allowlist-only Superadmin whose email left ``SUPERADMIN_EMAILS``."""
    if not is_allowlist_superadmin_claims(claims):
        return False
    return not is_superadmin_email(
        get_settings(), str(claims.get("emailId") or "")
    )


def is_unlisted_system_account(claims: dict | None) -> bool:
    """Legacy system-account Superadmin removed from the allowlist, or unlisted allowlist SA."""
    if is_unlisted_allowlist_superadmin(claims):
        return True
    return bool(
        claims
        and claims.get("isSystemAccount")
        and not is_superadmin_email(
            get_settings(), str(claims.get("emailId") or "")
        )
    )


def apply_session_view(claims: dict, active_view: str | None) -> dict:
    """Per-request Superadmin view: allowed only while the email is still allowlisted.

    In the Superadmin view the request runs as SUPERADMIN with full access;
    otherwise it runs as the employee's own account (role and RBAC grants).
    Allowlist-only Superadmins always stay in the Superadmin view while listed.
    """
    email = str(claims.get("emailId") or "")
    listed = is_superadmin_email(get_settings(), email)
    if is_allowlist_superadmin_claims(claims):
        if not listed:
            return {**claims, SUPERADMIN_VIEW_CLAIM: False}
        return {
            **claims,
            "role": Role.SUPERADMIN.value,
            "department": Role.SUPERADMIN.value,
            "createAccess": True,
            "editAccess": True,
            "viewAccess": True,
            "fullAccess": True,
            SUPERADMIN_VIEW_CLAIM: True,
        }
    if active_view == SUPERADMIN_VIEW and listed:
        return {
            **claims,
            "role": Role.SUPERADMIN.value,
            "department": Role.SUPERADMIN.value,
            "createAccess": True,
            "editAccess": True,
            "viewAccess": True,
            "fullAccess": True,
            SUPERADMIN_VIEW_CLAIM: True,
        }
    return {**claims, SUPERADMIN_VIEW_CLAIM: False}


def is_superadmin_view(claims: dict | None) -> bool:
    return bool(claims and claims.get(SUPERADMIN_VIEW_CLAIM))


def _split_display_name(raw: str, *, fallback_first: str = "Superadmin") -> tuple[str, str]:
    """Split a display name into first / last.

    Single-token names (e.g. ``\"Superadmin\"``) keep an empty last name —
    never force a last name of ``\"Admin\"``.
    """
    parts = [p for p in (raw or "").strip().split() if p]
    if not parts:
        return fallback_first, ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _name_from_email(email: str) -> str:
    """``priya.shah@x.com`` → ``"Priya Shah"`` (when Microsoft sends no name)."""
    local = email.split("@", 1)[0]
    return " ".join(part.capitalize() for part in re.split(r"[._\-+]+", local) if part)


def allowlist_superadmin_user_details(
    *,
    email: str,
    display_name: str | None = None,
    company: dict[str, Any] | None = None,
    access_grants: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Synthetic userDetails for an allowlist Superadmin (no ``employees`` row)."""
    first_name, last_name = _split_display_name(
        display_name or _name_from_email(email)
    )
    return {
        "employeeId": None,
        "firstName": first_name,
        "lastName": last_name or "",
        "emailId": email.strip().lower(),
        "department": Role.SUPERADMIN.value,
        "createAccess": True,
        "editAccess": True,
        "viewAccess": True,
        "fullAccess": True,
        "status": "Active",
        "employeeType": None,
        "employeeStartDate": None,
        "employeeEndDate": None,
        "company": company,
        "role": Role.SUPERADMIN.value,
        "themePreference": "light",
        "quickActionsPreference": [],
        "accessGrants": list(access_grants or []),
        "isSystemAccount": False,
        ALLOWLIST_SUPERADMIN_CLAIM: True,
    }
