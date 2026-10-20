"""Config-driven field ownership (mirrors frontend fieldPermissionsConfig.json)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from fastapi import HTTPException

FieldPermissionRole = Literal["SELF", "HR", "ADMIN"]
FieldMasking = Literal["none", "last4"]

_CONFIG_PATH = Path(__file__).with_name("field_permissions_config.json")


@lru_cache(maxsize=1)
def _load_config() -> dict[str, Any]:
    with _CONFIG_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def get_field_rule(field: str) -> dict[str, Any] | None:
    return _load_config().get("fields", {}).get(field)


def permission_principals(
    app_role: str | None,
    *,
    is_self: bool,
) -> list[FieldPermissionRole]:
    """Return effective principals for a request (staff + SELF when own record)."""
    aliases: dict[str, str] = _load_config().get("roleAliases", {})
    raw = (app_role or "").strip().upper()
    out: list[FieldPermissionRole] = []
    if raw and raw != "EMPLOYEE":
        aliased = aliases.get(raw, raw)
        if aliased in {"HR", "ADMIN"}:
            out.append(aliased)  # type: ignore[arg-type]
    if is_self:
        out.append("SELF")
    return out


def can_write(
    field: str,
    app_role: str | None,
    already_saved: bool,
    *,
    is_self: bool,
) -> bool:
    rule = get_field_rule(field)
    if not rule:
        return False
    principals = permission_principals(app_role, is_self=is_self)
    allowed = rule["whoEditsLater"] if already_saved else rule["whoWrites"]
    return any(p in allowed for p in principals)


def can_view(
    field: str,
    app_role: str | None,
    *,
    is_self: bool,
) -> bool:
    rule = get_field_rule(field)
    if not rule:
        return True
    principals = permission_principals(app_role, is_self=is_self)
    return any(p in rule["whoViews"] for p in principals)


def can_view_full_national_id_for_role(
    app_role: str | None,
    *,
    is_self: bool = False,
) -> bool:
    """Full national ID for HR/ADMIN when editing — never SELF."""
    rule = get_field_rule("nationalIdNumber") or {}
    full_roles = rule.get("fullViewRoles") or ["ADMIN"]
    principals = permission_principals(app_role, is_self=is_self)
    return any(p in full_roles for p in principals)


def field_masking(field: str) -> FieldMasking:
    rule = get_field_rule(field)
    masking = (rule or {}).get("masking") or "none"
    return "last4" if masking == "last4" else "none"


def mask_last4(value: str | None) -> str:
    """Mask for display using last 4 alphanumeric characters (IDs / passports)."""
    chars = "".join(ch for ch in str(value or "") if ch.isalnum())[-4:]
    if not chars:
        return ""
    return f"••••{chars}"


def allows_correction_request(field: str) -> bool:
    rule = get_field_rule(field)
    return bool(rule and rule.get("correctionRequest"))


CORRECTION_REQUEST_FIELDS = frozenset(
    name
    for name, rule in _load_config().get("fields", {}).items()
    if rule.get("correctionRequest")
)

# Body keys gated by field permissions on PATCH (create uses whoWrites separately).
PERMISSION_GATED_PATCH_KEYS = frozenset(_load_config().get("fields", {}).keys())


def assert_patch_fields_allowed(
    body: dict[str, Any],
    *,
    app_role: str | None,
    is_self: bool,
    already_saved: bool = True,
) -> None:
    """Reject PATCH keys the actor may not write under field ownership rules."""
    denied: list[str] = []
    for key in body:
        if key not in PERMISSION_GATED_PATCH_KEYS:
            continue
        if not can_write(key, app_role, already_saved, is_self=is_self):
            denied.append(key)
    # Nested contact bag
    contact = body.get("contact")
    if isinstance(contact, dict):
        for key in contact:
            if key not in PERMISSION_GATED_PATCH_KEYS:
                continue
            if not can_write(key, app_role, already_saved, is_self=is_self):
                denied.append(f"contact.{key}")
    if denied:
        raise HTTPException(
            status_code=403,
            detail=f"Not allowed to edit field(s): {', '.join(sorted(set(denied)))}",
        )
