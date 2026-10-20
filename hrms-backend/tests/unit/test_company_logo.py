"""Company logo validation: raster sniff + SVG deny-list."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.modules.company.files import read_validated_logo, sniff_logo_content_type

PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)

SAFE_SVG = b'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"></svg>'
SCRIPT_SVG = (
    b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
)


def _upload(data: bytes, content_type: str) -> AsyncMock:
    upload = AsyncMock()
    upload.read = AsyncMock(return_value=data)
    upload.content_type = content_type
    return upload


def test_sniff_png_even_when_declared_wrong() -> None:
    assert sniff_logo_content_type(PNG_1X1, "application/octet-stream") == "image/png"


def test_sniff_svg_from_xml_declaration() -> None:
    payload = b'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    assert sniff_logo_content_type(payload, "text/plain") == "image/svg+xml"


@pytest.mark.asyncio
async def test_accepts_png() -> None:
    data, content_type = await read_validated_logo(_upload(PNG_1X1, "image/png"))
    assert content_type == "image/png"
    assert data.startswith(b"\x89PNG")


@pytest.mark.asyncio
async def test_accepts_safe_svg() -> None:
    data, content_type = await read_validated_logo(_upload(SAFE_SVG, "image/svg+xml"))
    assert content_type == "image/svg+xml"
    assert data == SAFE_SVG


@pytest.mark.asyncio
async def test_rejects_svg_with_script() -> None:
    with pytest.raises(HTTPException) as exc:
        await read_validated_logo(_upload(SCRIPT_SVG, "image/svg+xml"))
    assert exc.value.status_code == 400
    assert "script" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_rejects_empty_file() -> None:
    with pytest.raises(HTTPException) as exc:
        await read_validated_logo(_upload(b"", "image/png"))
    assert exc.value.status_code == 400
