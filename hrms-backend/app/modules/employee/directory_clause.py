"""Shared SQL filter excluding bootstrap/system logins from people listings."""

from __future__ import annotations

from app.models.tables import Employee


def directory_employee_clause():
    """Exclude bootstrap/system logins from directory-style listings."""
    return Employee.is_system_account.is_(False)
