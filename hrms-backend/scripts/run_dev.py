#!/usr/bin/env python3
"""Run the API for local dev with reliable Ctrl+C shutdown.

Uvicorn's built-in ``--reload`` uses a multiprocessing WatchFiles supervisor.
On macOS (especially Conda Python) that supervisor can stick mid-reload: the
terminal shows ``^C`` but the reloader/worker tree keeps running and holds the
port.

This launcher avoids that by running a single uvicorn worker under the
``watchfiles`` CLI, which restarts on changes and has explicit SIGINT/SIGKILL
timeouts for the child process. The wrapper also kills the whole process group
on interrupt so nothing is left holding the port.
"""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PORT = 5001


def _default_port() -> int:
    """PORT from .env (or the environment); 5001 when it is unset or invalid."""
    sys.path.insert(0, str(ROOT))
    try:
        from app.core.config import get_settings

        return int(get_settings().port or DEFAULT_PORT)
    except Exception:
        return DEFAULT_PORT


def _kill_group(pid: int, sig: int) -> None:
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            check=False,
            capture_output=True,
            creationflags=flags,
        )
        return
    try:
        os.killpg(pid, sig)
    except ProcessLookupError:
        return
    except PermissionError:
        try:
            os.kill(pid, sig)
        except ProcessLookupError:
            return


def _start(cmd: list[str]) -> subprocess.Popen[bytes]:
    if os.name == "nt":
        return subprocess.Popen(
            cmd,
            cwd=ROOT,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    return subprocess.Popen(cmd, cwd=ROOT, start_new_session=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="HRMS API dev server with reliable Ctrl+C shutdown",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument(
        "--port",
        type=int,
        default=_default_port(),
        help="default: PORT from .env, else 5001",
    )
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Disable auto-reload (useful when diagnosing startup hangs)",
    )
    args, extra = parser.parse_known_args()

    if args.no_reload:
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            args.host,
            "--port",
            str(args.port),
            *extra,
        ]
    else:
        inner = " ".join(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                args.host,
                "--port",
                str(args.port),
                *extra,
            ]
        )
        cmd = [
            sys.executable,
            "-m",
            "watchfiles",
            "--filter",
            "python",
            "--sigint-timeout",
            "5",
            "--sigkill-timeout",
            "3",
            inner,
            str(ROOT / "app"),
        ]

    proc = _start(cmd)
    force_kill_armed = False

    def _force_kill() -> None:
        if proc.poll() is None:
            print("API did not exit cleanly; sending SIGKILL...", flush=True)
            _kill_group(proc.pid, signal.SIGKILL)

    def _shutdown(_signum: int, _frame: object | None) -> None:
        nonlocal force_kill_armed
        if force_kill_armed:
            _kill_group(proc.pid, signal.SIGKILL)
            return
        force_kill_armed = True
        print("\nShutting down API...", flush=True)
        _kill_group(proc.pid, signal.SIGTERM)
        # Do not wait() inside the signal handler (not re-entrant with proc.wait).
        timer = threading.Timer(6.0, _force_kill)
        timer.daemon = True
        timer.start()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    return int(proc.wait() or 0)


if __name__ == "__main__":
    raise SystemExit(main())
