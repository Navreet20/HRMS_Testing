"""Keep EMPLOYEE.DEPARTMENT (legacy access string) and EMPLOYEE.ROLE in sync.

``EMPLOYEE.DEPARTMENT`` still gates ``require_roles`` and the JWT ``department``
claim. ``EMPLOYEE.ROLE`` is stored but does not gate routes yet. Org catalog
``departmentId`` is unrelated and must not be written here.

Conflict rule: when both are present and differ, prefer ``role`` if it is a
valid :class:`~app.core.roles.Role` value; otherwise prefer ``department``.
If only one is set, copy it onto the other. If neither is set, default to
``EMPLOYEE``. A write must never leave the two columns diverged.
"""

from __future__ import annotations

from typing import Any

from app.core.roles import Role, normalize_role_key

DEFAULT_ACCESS_ROLE = Role.EMPLOYEE.value
_VALID_ROLES = frozenset(member.value for member in Role)


def is_valid_access_role(value: str | None) -> bool:
    """Return True when ``value`` matches a :class:`Role` member (case-insensitive)."""
    if not value:
        return False
    return normalize_role_key(value) in _VALID_ROLES


def _normalize_access_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Role):
        return value.value
    text = str(value).strip()
    if not text:
        return None
    key = normalize_role_key(text)
    if key in _VALID_ROLES:
        return key
    return text


def sync_access_role_fields(
    department: Any = None,
    role: Any = None,
) -> tuple[str, str]:
    """Return ``(department, role)`` as one canonical access string.

    Prefer ``role`` on conflict when it is a valid HrmsRole / ``Role``; otherwise
    prefer ``department``. Default ``EMPLOYEE`` when neither is sent.
    """
    department_value = _normalize_access_value(department)
    role_value = _normalize_access_value(role)

    if department_value is None and role_value is None:
        canonical = DEFAULT_ACCESS_ROLE
    elif department_value is None:
        canonical = role_value
    elif role_value is None:
        canonical = department_value
    elif department_value == role_value:
        canonical = role_value
    elif is_valid_access_role(role_value):
        canonical = role_value
    else:
        canonical = department_value

    return canonical, canonical


def apply_synced_access_role_fields(
    body: dict[str, Any],
    *,
    only_if_present: bool = False,
) -> None:
    """Mutate ``body`` so ``department`` and ``role`` are the same canonical value.

    When ``only_if_present`` is True (PATCH), skip if neither key is in the body.
    """
    if only_if_present and "department" not in body and "role" not in body:
        return
    department = body["department"] if "department" in body else None
    role = body["role"] if "role" in body else None
    synced_department, synced_role = sync_access_role_fields(department, role)
    body["department"] = synced_department
    body["role"] = synced_role


def force_create_access_role_employee(body: dict[str, Any]) -> None:
    """Ignore caller-chosen role on hire/create; always store EMPLOYEE.

    Role assignment is deferred to a future RBAC module. Existing employees
    keep their roles; only create / draft paths call this.
    """
    body["department"] = DEFAULT_ACCESS_ROLE
    body["role"] = DEFAULT_ACCESS_ROLE


_COMPANY_PLACEHOLDERS = frozenset({"", "—", "–", "-", "Select company"})


def _actor_company_name(actor: dict[str, Any] | None) -> str | None:
    """Extract a usable company name from JWT / userDetails actor payload."""
    if not actor:
        return None
    raw = actor.get("company")
    if isinstance(raw, dict):
        name = raw.get("companyName") or raw.get("name") or ""
    elif raw is None:
        name = ""
    else:
        name = str(raw)
    text = name.strip()
    if not text or text in _COMPANY_PLACEHOLDERS:
        return None
    return text


def resolve_company_for_write(
    body_company: Any,
    actor: dict[str, Any] | None = None,
    *,
    fallback: str = "Default",
) -> str:
    """Coalesce company for create/draft; reject UI placeholders like em dash."""
    if body_company is not None:
        text = str(body_company).strip()
        if text and text not in _COMPANY_PLACEHOLDERS:
            return text
    actor_name = _actor_company_name(actor)
    if actor_name:
        return actor_name
    return fallback or "Default"
