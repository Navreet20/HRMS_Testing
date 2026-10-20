"""Geocode API: authenticated Photon proxy for address autocomplete."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.geocode import router as geocode_router
from app.modules.geocode.photon import parse_photon_results


HR_USER = {
    "employeeId": str(uuid.uuid4()),
    "emailId": "hr@example.com",
    "department": "HR",
    "firstName": "Pat",
    "lastName": "HR",
}


def _build_app(user: dict[str, Any]) -> FastAPI:
    app = FastAPI()
    app.include_router(geocode_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return user

    async def _db() -> Any:
        yield object()

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    return app


@pytest.fixture
async def hr_client() -> AsyncClient:
    transport = ASGITransport(app=_build_app(HR_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def test_parse_photon_results_maps_form_fields() -> None:
    assert parse_photon_results(
        {
            "features": [
                {
                    "properties": {
                        "name": "City Hall",
                        "housenumber": "1",
                        "street": "Centre Street",
                        "city": "New York",
                        "state": "New York",
                        "postcode": "10007",
                        "countrycode": "US",
                    }
                }
            ]
        }
    ) == [
        {
            "label": "1 Centre Street, New York, New York, 10007",
            "street": "1 Centre Street",
            "city": "New York",
            "state": "New York",
            "postalCode": "10007",
            "countryCode": "US",
        }
    ]


@pytest.mark.asyncio
async def test_search_returns_empty_for_short_query(hr_client: AsyncClient) -> None:
    response = await hr_client.get("/api/v1/geocode/search", params={"q": "ab"})
    assert response.status_code == 200
    assert response.json() == {"suggestions": []}


@pytest.mark.asyncio
async def test_search_returns_suggestions_from_service(
    hr_client: AsyncClient,
) -> None:
    fake = [
        {
            "label": "1 Centre Street, New York, New York, 10007",
            "street": "1 Centre Street",
            "city": "New York",
            "state": "New York",
            "postalCode": "10007",
            "countryCode": "US",
        }
    ]
    with patch(
        "app.modules.geocode.router.svc.search_addresses",
        new=AsyncMock(return_value=fake),
    ) as mocked:
        response = await hr_client.get(
            "/api/v1/geocode/search",
            params={"q": "Centre Street", "countrycodes": "us", "limit": "5"},
        )
    assert response.status_code == 200
    assert response.json() == {"suggestions": fake}
    mocked.assert_awaited_once()
    kwargs = mocked.await_args.kwargs
    assert kwargs["country_code"] == "us"
    assert kwargs["limit"] == 5
