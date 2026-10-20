"""Actor helpers for onboarding activity attribution."""

from __future__ import annotations

from typing import Any

from app.modules.employee.access import actor_employee_id

__all__ = ["actor_display_name", "actor_employee_id"]


def actor_display_name(claims: dict[str, Any]) -> str:
    first = str(claims.get("firstName") or "").strip()
    last = str(claims.get("lastName") or "").strip()
    name = f"{first} {last}".strip()
    if name:
        return name
    email = claims.get("email")
    return str(email) if email else "system"
