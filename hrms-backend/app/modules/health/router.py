from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "hrms-backend"}


@router.get("/api/v1/health")
async def health_check_api() -> dict[str, str]:
    return {"status": "ok", "service": "hrms-backend"}
