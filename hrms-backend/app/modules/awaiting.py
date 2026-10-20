"""Soft-disabled "Awaiting Refinement" APIs (see frontend navPolicy AWAITING_REFINEMENT_NAV_IDS plus legacy /users).

No tables back these. Reads answer ``[]`` so list screens render empty; writes answer ``501``. Replace a prefix here
with its real router (and add its tables) when the module is refined.
"""
from fastapi import APIRouter, HTTPException

from app.models.awaiting import DETAIL

AWAITING_PREFIXES: tuple[str, ...] = (
    "vendors", "expenses", "payrolls", "schedule", "skills", "users", "billing", "revenue", "attendance",
)

router = APIRouter(tags=["Awaiting Refinement"])


def _register(prefix: str) -> None:
    async def _handler(rest: str = "") -> list:  # noqa: ARG001
        raise HTTPException(status_code=501, detail=f"{DETAIL} (/{prefix})")

    async def _read(rest: str = "") -> list:  # noqa: ARG001
        return []

    for path in (f"/{prefix}", f"/{prefix}/{{rest:path}}"):
        router.add_api_route(path, _read, methods=["GET"], include_in_schema=True)
        router.add_api_route(path, _handler, methods=["POST", "PUT", "PATCH", "DELETE"], include_in_schema=True)


for _prefix in AWAITING_PREFIXES:
    _register(_prefix)
del _prefix
