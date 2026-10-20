"""Throwaway Postgres for database tests when no TEST_DATABASE_URL is given.

Fallback only: a set ``TEST_DATABASE_URL`` (CI) is always used as it is. When it
is unset and Docker looks usable, a disposable ``postgres:16`` container is
started lazily, when the first database test runs, on a host port chosen by
Docker. It is removed after the run. Runs without
database tests never start Docker. If Docker is unusable, those tests skip.
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

IMAGE = "postgres:16"
_USER = "postgres"
_PASSWORD = "hrms_test_only"
_DB_NAME = "hrms_test"

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_container = None


def possible() -> bool:
    """Cheap check (no Docker call): could a container plausibly be started?"""
    if importlib.util.find_spec("testcontainers") is None:
        return False
    return bool(os.environ.get("DOCKER_HOST")) or Path("/var/run/docker.sock").exists()


def pending_url() -> str:
    """Placeholder URL used until the container exists.

    The app reads its database address when it is imported, before any test
    runs. Port 1 is closed, so nothing can connect with this value. ``start()``
    later learns the real port from Docker and redirects the connections.
    """
    return f"postgresql://{_USER}:{_PASSWORD}@127.0.0.1:1/{_DB_NAME}"


def _redirect_app_engine(host: str, port: int) -> None:
    """Point the app's already-built engine at the container (public SQLAlchemy hook)."""
    from sqlalchemy import event

    from app.db.session import engine

    @event.listens_for(engine.sync_engine, "do_connect")
    def _use_container(dialect, conn_rec, cargs, cparams):
        cparams["host"] = host
        cparams["port"] = port


def start() -> str | None:
    """Start the container; Docker picks the host port. None if Docker is unusable."""
    global _container
    if _container is not None:
        return "running"
    try:
        import docker
        from testcontainers.postgres import PostgresContainer

        docker.from_env().ping()
    except Exception:
        return None
    container = PostgresContainer(
        IMAGE, username=_USER, password=_PASSWORD, dbname=_DB_NAME, driver=None
    )
    container.start()
    _container = container
    host = container.get_container_host_ip()
    port = int(container.get_exposed_port(5432))
    os.environ["TEST_DATABASE_URL"] = (
        f"postgresql://{_USER}:{_PASSWORD}@{host}:{port}/{_DB_NAME}"
    )
    os.environ["DB_HOST"], os.environ["DB_PORT"] = host, str(port)
    _redirect_app_engine(host, port)
    return "started"


def stop() -> None:
    global _container
    if _container is not None:
        _container.stop()
        _container = None


def apply_schema() -> None:
    """Run the same schema step CI runs, in a separate process."""
    subprocess.run(
        [sys.executable, "scripts/bootstrap_db.py", "--schema-only"],
        cwd=_BACKEND_ROOT,
        env=os.environ.copy(),
        check=True,
    )
