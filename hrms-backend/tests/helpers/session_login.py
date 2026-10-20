"""Establish an app session cookie without password login (Entra-only auth)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import date

from httpx import AsyncClient
from sqlalchemy import delete, func, select

from app.db.session import async_session_maker
from app.modules.auth.service import AuthService


async def establish_session(
    client: AsyncClient,
    email: str,
    *,
    user_agent: str = "pytest",
) -> dict:
    """Mint AuthSession + set eaova_access / eaova_csrf on the test client."""
    csrf = await client.get("/api/v1/auth/csrf")
    assert csrf.status_code == 200

    auth = AuthService()
    async with async_session_maker() as session:
        result = await auth.issue_session_for_email(
            session, email, user_agent=user_agent
        )
        await session.commit()

    client.cookies.set("eaova_access", result["token"])
    return result


async def ensure_module_grant(
    email: str,
    module_name: str,
    *,
    access_level: str = "full_access",
    submodule_names: Sequence[str] = (),
) -> None:
    """Upsert an Active grant for ``email`` (APIs authorize from grants, not role)."""
    from app.models.tables import Employee, RbacModule, RbacSubmodule
    from app.modules.rbac.grants import upsert_employee_grants

    async with async_session_maker() as session:
        employee_id = (
            await session.execute(
                select(Employee.employee_id).where(
                    func.lower(Employee.email_id) == email.lower()
                )
            )
        ).scalar_one()
        module_id = (
            await session.execute(
                select(RbacModule.module_id).where(RbacModule.module_name == module_name)
            )
        ).scalar_one()
        submodule_ids: list[int] = []
        if submodule_names:
            submodule_ids = list(
                (
                    await session.execute(
                        select(RbacSubmodule.submodule_id).where(
                            RbacSubmodule.module_id == module_id,
                            RbacSubmodule.submodule_name.in_(list(submodule_names)),
                        )
                    )
                ).scalars()
            )
        await upsert_employee_grants(
            session,
            employee_id=employee_id,
            payload={
                "moduleId": module_id,
                "accessLevel": access_level,
                "submoduleIds": submodule_ids,
            },
            granted_by=None,
        )
        await session.commit()


async def create_disposable_employee(*, role: str = "EMPLOYEE") -> tuple[uuid.UUID, str]:
    """Insert an ACTIVE employee with a unique email; pair with ``delete_disposable_employee``."""
    from app.models.tables import Employee

    email = f"rbac.target.{uuid.uuid4().hex[:10]}@eaova.test"
    async with async_session_maker() as session:
        emp = Employee(
            first_name="Rbac",
            last_name="Target",
            email_id=email,
            role=role,
            department=role,
            company="EAOVA",
            employment_type="FULL_TIME",
            status="ACTIVE",
            employment_start_date=date.today().isoformat(),
        )
        session.add(emp)
        await session.commit()
        await session.refresh(emp)
        return emp.employee_id, email


async def delete_disposable_employee(employee_id: uuid.UUID) -> None:
    from app.models.tables import (Employee, EmployeeAccessGrant)
    from app.models.awaiting import (AccessGrantAudit)

    async with async_session_maker() as session:
        await session.execute(
            delete(AccessGrantAudit).where(
                AccessGrantAudit.target_employee_id == employee_id
            )
        )
        await session.execute(
            delete(EmployeeAccessGrant).where(
                EmployeeAccessGrant.employee_id == employee_id
            )
        )
        await session.execute(delete(Employee).where(Employee.employee_id == employee_id))
        await session.commit()
