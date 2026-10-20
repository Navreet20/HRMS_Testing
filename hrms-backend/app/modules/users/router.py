import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.users import service as svc

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
async def list_users(db: DbSession) -> list[dict]:
    return await svc.list_users(db)


@router.get("/test")
async def test_user(db: DbSession) -> dict:
    return await svc.test_user(db)


@router.post("")
async def create_user(db: DbSession, body: dict[str, Any]) -> dict:
    return await svc.create_user(db, body)


@router.patch("/{user_id}")
async def update_user(db: DbSession, user_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await svc.update_user(db, user_id, body)


@router.patch("/{user_id}/delete")
async def delete_user(db: DbSession, user_id: uuid.UUID) -> dict:
    return await svc.delete_user(db, user_id)


@router.patch("/{user_id}/change-password")
async def change_password(
    db: DbSession,
    user_id: uuid.UUID,
    old_password: str = Query(..., alias="oldPassword"),
    new_password: str = Query(..., alias="newPassword"),
) -> dict:
    return await svc.change_password(db, user_id, old_password, new_password)
