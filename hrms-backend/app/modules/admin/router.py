"""Admin bootstrap endpoints (quarantined from Employees CRUD — MFTR-60)."""

from fastapi import APIRouter

from app.modules.deps import DbSession
from app.modules.employee.service import EmployeeService

router = APIRouter(prefix="/admin", tags=["Admin"])
_svc = EmployeeService()


@router.post("/onboard-super-admin")
async def onboard_super_admin(session: DbSession) -> dict:
    """Bootstrap the super admin account if missing."""
    return await _svc.onboard_super_admin(session)
