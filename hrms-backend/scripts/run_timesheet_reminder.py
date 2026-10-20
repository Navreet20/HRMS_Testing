#!/usr/bin/env python3
"""Run TS-DATA-9 timesheet reminder job (cron-friendly).

Uses the company Configuration reminder weekday (default Tuesday).

Usage:
  python scripts/run_timesheet_reminder.py
  python scripts/run_timesheet_reminder.py --force   # ignore weekday guard
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
from app.modules.timesheet.week_reminder import run_timesheet_reminders


async def main(*, force: bool) -> None:
    async with async_session_maker() as session:
        result = await run_timesheet_reminders(session, force=force)
        await session.commit()
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send timesheet reminder emails")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run even when today is not the configured reminder weekday",
    )
    args = parser.parse_args()
    asyncio.run(main(force=args.force))
