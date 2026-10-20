#!/usr/bin/env python3
"""Run compliance document expiry job (cron-friendly)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import async_session_maker
from app.modules.onboarding.expiry import run_document_expiry


async def main() -> None:
    async with async_session_maker() as session:
        result = await run_document_expiry(session)
        await session.commit()
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
