#!/usr/bin/env python3
"""LEAVE-DATA-6 — Jan 1 leave grant + rollover (cron-friendly).

Creates missing LeaveBalance rows for the target calendar year for every
employee with an assigned leave policy. Existing employees get full Personal
entitlement; unused prior-year days roll forward per each policy line's
rollover_allowed / max_rollover_days. Safe to re-run (idempotent).

Ops schedule (recommended):
  0 0 1 1 *  cd /path/to/hrms-backend && .venv/bin/python scripts/run_annual_leave_grant.py

Usage:
  python scripts/run_annual_leave_grant.py
  python scripts/run_annual_leave_grant.py --year 2027
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import async_session_maker
from app.modules.leave.balance_service import run_annual_leave_grant


async def main(*, leave_year: int | None) -> None:
    async with async_session_maker() as session:
        result = await run_annual_leave_grant(session, leave_year)
        await session.commit()
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Grant leave balances for a calendar year (Jan 1 job)"
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Calendar year to grant (default: current year)",
    )
    args = parser.parse_args()
    asyncio.run(main(leave_year=args.year))
