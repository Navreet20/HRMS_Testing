from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import session_access_role
from app.models.awaiting import (ApplicationConfig, DepartmentConfig, JobFamilyConfig)
from app.core.serialize import config_row_to_dict, department_config_to_dict


async def save_config(db: AsyncSession) -> list[dict]:
    defaults = [
        ("ACCESS", "EMPLOYEE", "VIEW"),
        ("ACCESS", "HR", "EDIT"),
    ]
    rows: list[ApplicationConfig] = []
    for typ, param, val in defaults:
        row = ApplicationConfig(type=typ, parameter=param, value=val, created_date=datetime.utcnow())
        db.add(row)
        rows.append(row)
    await db.flush()
    return [config_row_to_dict(r) for r in rows]


async def update_config(db: AsyncSession, items: list[dict[str, Any]]) -> list[dict]:
    updated: list[dict] = []
    for item in items:
        config_id = item.get("id")
        if config_id:
            result = await db.execute(select(ApplicationConfig).where(ApplicationConfig.id == uuid.UUID(config_id)))
            row = result.scalar_one_or_none()
            if row and item.get("value") is not None:
                row.value = item["value"]
                row.updated_date = datetime.utcnow()
                updated.append(config_row_to_dict(row))
    await db.flush()
    return updated


async def get_config(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(ApplicationConfig))
    return [config_row_to_dict(r) for r in result.scalars().all()]


async def delete_config(db: AsyncSession) -> dict:
    await db.execute(delete(ApplicationConfig))
    await db.execute(delete(DepartmentConfig))
    return {"message": "Configuration deleted"}


async def get_config_by_department(db: AsyncSession, user: dict) -> list[dict]:
    dept = session_access_role(user) or user.get("department") or ""
    result = await db.execute(select(DepartmentConfig).where(DepartmentConfig.department == dept))
    rows = result.scalars().all()
    if not rows:
        result = await db.execute(select(ApplicationConfig))
        return [config_row_to_dict(r) for r in result.scalars().all()]
    return [department_config_to_dict(r) for r in rows]


async def get_config_emails(db: AsyncSession, config_type: str) -> list[dict]:
    result = await db.execute(
        select(ApplicationConfig).where(ApplicationConfig.type == config_type, ApplicationConfig.parameter.ilike("%email%"))
    )
    return [config_row_to_dict(r) for r in result.scalars().all()]


async def save_job_family(db: AsyncSession) -> list[dict]:
    row = JobFamilyConfig(type="JOB_FAMILY", parameter="DEFAULT", value="{}")
    db.add(row)
    await db.flush()
    return [config_row_to_dict(row)]


async def get_job_family(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(JobFamilyConfig))
    return [config_row_to_dict(r) for r in result.scalars().all()]


async def update_job_family(db: AsyncSession, items: list[dict[str, Any]]) -> list[dict]:
    for item in items:
        row = JobFamilyConfig(
            type=item.get("type"),
            parameter=item.get("parameter"),
            value=item.get("value"),
        )
        db.add(row)
    await db.flush()
    return await get_job_family(db)


async def save_config_emails(db: AsyncSession, payload: dict[str, Any]) -> dict:
    row = ApplicationConfig(
        type=payload.get("type", "EMAIL"),
        parameter=payload.get("parameter", ""),
        value=payload.get("value", ""),
        created_date=datetime.utcnow(),
    )
    db.add(row)
    await db.flush()
    return config_row_to_dict(row)


async def save_config_hierarchy(db: AsyncSession, items: list[dict[str, Any]]) -> list[dict]:
    saved: list[dict] = []
    for item in items:
        row = ApplicationConfig(
            type="HIERARCHY",
            parameter=item.get("parameter", ""),
            value=item.get("value", ""),
            created_date=datetime.utcnow(),
        )
        db.add(row)
        saved.append(config_row_to_dict(row))
    await db.flush()
    return saved


async def get_config_hierarchy(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(ApplicationConfig).where(ApplicationConfig.type == "HIERARCHY"))
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hierarchy not configured")
    return [config_row_to_dict(r) for r in rows]
