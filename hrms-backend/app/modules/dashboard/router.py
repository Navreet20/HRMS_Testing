from fastapi import APIRouter

from app.modules.deps import DbSession
from app.modules.dashboard import service as svc

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("")
async def dashboard_data(db: DbSession) -> dict:
    return await svc.dashboard_data(db)
