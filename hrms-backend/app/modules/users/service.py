from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.awaiting import (LegacyUser)
from app.core.serialize import legacy_user_to_dict


async def create_user(db: AsyncSession, payload: dict[str, Any]) -> dict:
    user = LegacyUser(
        email=payload["email"],
        password=hash_password(payload.get("password", "ChangeMe123!")),
        role=payload.get("role", "EMPLOYEE"),
        create_access=payload.get("createAccess", False),
        view_access=payload.get("viewAccess", True),
        edit_access=payload.get("editAccess", False),
        full_access=payload.get("fullAccess", False),
        user_status=payload.get("userStatus", "ACTIVE"),
        created_date=datetime.utcnow(),
        updated_date=datetime.utcnow(),
    )
    db.add(user)
    await db.flush()
    return legacy_user_to_dict(user)


async def update_user(db: AsyncSession, user_id: uuid.UUID, payload: dict[str, Any]) -> dict:
    result = await db.execute(select(LegacyUser).where(LegacyUser.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    for key, attr in [
        ("email", "email"),
        ("role", "role"),
        ("createAccess", "create_access"),
        ("viewAccess", "view_access"),
        ("editAccess", "edit_access"),
        ("fullAccess", "full_access"),
        ("userStatus", "user_status"),
    ]:
        if payload.get(key) is not None:
            setattr(user, attr, payload[key])
    user.updated_date = datetime.utcnow()
    await db.flush()
    return legacy_user_to_dict(user)


async def list_users(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(LegacyUser))
    return [legacy_user_to_dict(u) for u in result.scalars().all()]


async def delete_user(db: AsyncSession, user_id: uuid.UUID) -> dict:
    result = await db.execute(select(LegacyUser).where(LegacyUser.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.user_status = "INACTIVE"
    user.updated_date = datetime.utcnow()
    await db.flush()
    return legacy_user_to_dict(user)


async def change_password(
    db: AsyncSession, user_id: uuid.UUID, old_password: str, new_password: str
) -> dict:
    result = await db.execute(select(LegacyUser).where(LegacyUser.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(old_password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user.password = hash_password(new_password)
    user.updated_date = datetime.utcnow()
    await db.flush()
    return {"message": "Password changed"}


async def test_user(db: AsyncSession) -> dict:
    count = len(await list_users(db))
    return {"message": "Users service OK", "count": count}
