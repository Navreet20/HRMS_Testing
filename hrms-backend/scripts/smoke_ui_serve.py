import asyncio
import re

from httpx import ASGITransport, AsyncClient

from app.main import app


async def main() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        health = await ac.get("/health")
        print("health", health.status_code, health.json())
        ui = await ac.get("/")
        print("ui", ui.status_code, ui.headers.get("content-type"), ui.text[:100])
        match = re.search(r"/assets/[^\"']+", ui.text)
        if match:
            asset = await ac.get(match.group(0))
            print(
                "asset",
                match.group(0),
                asset.status_code,
                asset.headers.get("content-type"),
                len(asset.content),
            )


asyncio.run(main())
