import asyncio
import contextlib
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.openapi_examples import install_request_examples
from app.core.security_middleware import SecurityHeadersMiddleware
from app.db.schema_ensure import ensure_schema_and_seed
from app.db.session import engine
from app.mail.outbox import run_worker as run_notification_worker
from app.mail.template_store import run_refresher as run_template_refresher
from app.modules import api
from app.modules.auth import router as auth
from app.modules.health import router as health

# Repo layout: hrms-backend/app/main.py → ../../hrms-frontend/dist
_UI_DIST = Path(__file__).resolve().parents[2] / "hrms-frontend" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # create_all (models) + idempotent ensure on every boot.
    await ensure_schema_and_seed()
    # Background sender for queued notification emails (not during tests).
    stop_worker = asyncio.Event()
    tasks: list[asyncio.Task] = []
    if not os.environ.get("TESTING"):
        # Edited email wording, reloaded every minute so every process sees edits.
        tasks.append(asyncio.create_task(run_template_refresher(stop_worker)))
        if get_settings().notification_worker_enabled:
            tasks.append(asyncio.create_task(run_notification_worker(stop_worker)))
    yield
    stop_worker.set()
    for task in tasks:
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.wait_for(task, timeout=10)
    await engine.dispose()


def _mount_ui(app: FastAPI) -> None:
    """Serve a static UI dist if present (legacy). Prefer Next.js on :3000."""
    if not _UI_DIST.is_dir() or not (_UI_DIST / "index.html").is_file():
        return

    assets_dir = _UI_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="ui-assets")

    index_html = _UI_DIST / "index.html"

    @app.get("/")
    async def ui_index() -> FileResponse:
        return FileResponse(index_html)

    @app.get("/{full_path:path}")
    async def ui_spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/") or full_path in {"docs", "redoc", "openapi.json"}:
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (_UI_DIST / full_path).resolve()
        try:
            candidate.relative_to(_UI_DIST.resolve())
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Not found") from exc
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index_html)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="EAOVA HRMS API",
        version="1.0.0",
        lifespan=lifespan,
    )
    # CORS first so preflight succeeds; security middleware runs after.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*", "X-CSRF-Token"],
        expose_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(api.router)
    install_request_examples(app)
    _mount_ui(app)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    _settings = get_settings()
    uvicorn.run("app.main:app", host="0.0.0.0", port=_settings.port, reload=True)
