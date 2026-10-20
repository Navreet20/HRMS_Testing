"""Runs every schema test in order, each as its own process, and reports which passed.

    python3 run_all.py

Each test builds and drops its own throwaway local database (see dbtools.py). Needs a local Postgres where
your user can create databases, and a Python with sqlalchemy and asyncpg. Set PGPORT, PGHOST, PGUSER if your
Postgres is not on the defaults.
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TESTS = [
    "rule_checks.py",
    "atomicity_check.py",
    "concurrency_check.py",
    "activity_log_check.py",
    "seed_check.py",
    "explain_check.py",
    "portal_atomicity_check.py",
    "portal_concurrency_check.py",
    "portal_explain_check.py",
]

failed = []
for name in TESTS:
    print(f"\n######## {name}", flush=True)
    if subprocess.run([sys.executable, str(HERE / name)], cwd=HERE).returncode != 0:
        failed.append(name)
print("\n" + ("ALL TEST FILES PASSED" if not failed else "FAILED: " + ", ".join(failed)))
sys.exit(1 if failed else 0)
