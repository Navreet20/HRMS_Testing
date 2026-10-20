"""Nested client create validation and POST /clients behavior."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.clients import service as clients_svc
from app.modules.clients.service import (
    CLIENT_CATEGORY_INVALID,
    CLIENT_CATEGORY_REQUIRED,
    CLIENT_NAME_TAKEN,
    INDUSTRY_UNKNOWN,
    _assert_active_industry,
    _sync_linked_project_names,
    create_client,
    parse_client_create_payload,
    update_client,
)


def _valid_payload(**overrides):
    body = {
        "clientName": "Nova Therapeutics Inc",
        "industry": "Healthcare",
        "clientCategory": "direct",
        "locations": [
            {
                "locationName": "NYC office",
                "address": "1 Market St",
                "city": "New York",
                "stateProvince": "NY",
                "country": "US",
                "zip": "10001",
                "region": "NA",
            }
        ],
        "stakeholders": [
            {
                "name": "Pat Client",
                "title": "Director",
                "department": "Engineering",
                "email": "pat@nova.test",
                "phoneNumber": "555-0100",
            }
        ],
    }
    body.update(overrides)
    return body


def test_parse_client_create_payload_accepts_legacy_client_name_key() -> None:
    parsed = parse_client_create_payload(
        {
            "customerName": "Legacy Name Co",
            "industry": "Healthcare",
            "clientCategory": "direct",
            "locations": [{"country": "US"}],
        }
    )
    assert parsed["name"] == "Legacy Name Co"


def test_parse_client_create_payload_accepts_nested_fields() -> None:
    parsed = parse_client_create_payload(_valid_payload())
    assert parsed["name"] == "Nova Therapeutics Inc"
    assert parsed["industry"] == "Healthcare"
    assert parsed["locations"][0]["country"] == "US"
    assert parsed["locations"][0]["zip"] == "10001"
    assert parsed["locations"][0]["addressLine2"] is None
    assert parsed["locations"][0]["region"] == "NA"
    assert parsed["stakeholders"][0]["department"] == "Engineering"
    assert parsed["stakeholders"][0]["email"] == "pat@nova.test"
    assert parsed["invoicingEntities"] == []
    assert parsed["isInternal"] is False
    assert parsed["clientCategory"] == "direct"


@pytest.mark.parametrize("category", ["direct", "intermediary", "Intermediary"])
def test_parse_client_create_payload_external_categories_keep_location_rules(
    category: str,
) -> None:
    parsed = parse_client_create_payload(_valid_payload(clientCategory=category))
    assert parsed["clientCategory"] == category.lower()
    assert parsed["isInternal"] is False
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(_valid_payload(clientCategory=category, locations=[]))
    assert exc.value.detail == "Add at least one operating location."


def test_parse_client_create_payload_internal_category_sets_internal_flag() -> None:
    parsed = parse_client_create_payload(
        {
            "clientName": "Internal Ops",
            "industry": "Healthcare",
            "clientCategory": "internal",
            "locations": [],
        }
    )
    assert parsed["clientCategory"] == "internal"
    assert parsed["isInternal"] is True


def test_parse_client_create_payload_legacy_is_internal_maps_to_internal_category() -> None:
    parsed = parse_client_create_payload(
        {
            "clientName": "Internal Ops",
            "industry": "Healthcare",
            "isInternal": True,
            "locations": [],
        }
    )
    assert parsed["clientCategory"] == "internal"


def test_parse_client_create_payload_requires_category() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(_valid_payload(clientCategory=None))
    assert exc.value.status_code == 400
    assert exc.value.detail == CLIENT_CATEGORY_REQUIRED


def test_parse_client_create_payload_rejects_unknown_category() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(_valid_payload(clientCategory="partner"))
    assert exc.value.status_code == 400
    assert exc.value.detail == CLIENT_CATEGORY_INVALID


def test_parse_client_create_payload_accepts_address_line_2() -> None:
    parsed = parse_client_create_payload(
        _valid_payload(
            locations=[
                {
                    "locationName": "NYC office",
                    "address": "1 Market St",
                    "addressLine2": "Suite 200",
                    "city": "New York",
                    "stateProvince": "NY",
                    "country": "US",
                    "zip": "10001",
                    "region": "NA",
                }
            ]
        )
    )
    assert parsed["locations"][0]["addressLine2"] == "Suite 200"


def test_parse_client_create_payload_accepts_org_location_id_without_country() -> None:
    location_id = uuid4()
    parsed = parse_client_create_payload(
        {
            "clientName": "Internal Ops",
            "industry": "Healthcare",
            "isInternal": True,
            "locations": [{"locationId": str(location_id)}],
        }
    )
    assert parsed["isInternal"] is True
    assert parsed["locations"][0]["locationId"] == location_id
    assert parsed["locations"][0]["country"] == ""


def test_parse_client_create_payload_rejects_invalid_org_location_id() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(
            {
                "clientName": "Internal Ops",
                "industry": "Healthcare",
                "isInternal": True,
                "locations": [{"locationId": "not-a-uuid"}],
            }
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid locationId"


def test_parse_client_create_payload_allows_empty_locations_when_internal() -> None:
    parsed = parse_client_create_payload(
        {
            "clientName": "Internal Ops",
            "industry": "Healthcare",
            "isInternal": True,
            "locations": [],
        }
    )
    assert parsed["isInternal"] is True
    assert parsed["locations"] == []
    assert parsed["stakeholders"] == []


def test_parse_client_create_payload_allows_optional_nested() -> None:
    parsed = parse_client_create_payload(
        {
            "clientName": "Sparse Co",
            "industry": "Healthcare",
            "isInternal": True,
            "locations": [{"country": "US"}],
        }
    )
    assert parsed["stakeholders"] == []
    assert parsed["invoicingEntities"] == []
    assert parsed["isInternal"] is True


def test_parse_client_create_payload_omits_location_region_when_absent() -> None:
    parsed = parse_client_create_payload(
        {
            "clientName": "No Region Co",
            "industry": "Healthcare",
            "clientCategory": "direct",
            "locations": [{"country": "US"}],
        }
    )
    assert "region" not in parsed["locations"][0]


def test_parse_client_create_payload_requires_country() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(
            {
                "clientName": "Acme",
                "industry": "Healthcare",
                "clientCategory": "direct",
                "locations": [{"locationName": "HQ"}],
            }
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Country is required."


def test_parse_client_create_payload_requires_stakeholder_name_when_started() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(
            _valid_payload(stakeholders=[{"name": "", "title": "Director"}])
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Stakeholder name is required."


def test_parse_client_create_payload_rejects_long_stakeholder_name() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(_valid_payload(stakeholders=[{"name": "A" * 101}]))
    assert exc.value.status_code == 400
    assert "100 characters" in str(exc.value.detail)


def test_parse_client_create_payload_allows_numeric_stakeholder_name() -> None:
    parsed = parse_client_create_payload(
        _valid_payload(stakeholders=[{"name": "454555"}])
    )
    assert parsed["stakeholders"][0]["name"] == "454555"


@pytest.mark.asyncio
async def test_sync_linked_project_names_skips_unchanged() -> None:
    db = AsyncMock()
    await _sync_linked_project_names(db, "Acme", "Acme")
    db.execute.assert_not_called()


@pytest.mark.parametrize(
    "payload,detail",
    [
        ({}, "Client name is required."),
        ({"clientName": "Acme"}, "Industry is required."),
        (
            {"clientName": "Acme", "industry": "Healthcare"},
            CLIENT_CATEGORY_REQUIRED,
        ),
        (
            {"clientName": "Acme", "industry": "Healthcare", "clientCategory": "direct"},
            "Add at least one operating location.",
        ),
    ],
)
def test_parse_client_create_payload_rejects_incomplete(payload, detail) -> None:
    with pytest.raises(HTTPException) as exc:
        parse_client_create_payload(payload)
    assert exc.value.status_code == 400
    assert exc.value.detail == detail


@pytest.mark.asyncio
async def test_assert_active_industry_rejects_unknown() -> None:
    db = AsyncMock()
    miss = MagicMock()
    miss.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=miss)
    with pytest.raises(HTTPException) as exc:
        await _assert_active_industry(db, "Not an industry")
    assert exc.value.status_code == 400
    assert exc.value.detail == INDUSTRY_UNKNOWN


@pytest.mark.asyncio
async def test_create_client_rejects_duplicate_active_name(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_industry(_db, name):
        return name

    monkeypatch.setattr(clients_svc, "_assert_active_industry", fake_industry)
    db = AsyncMock()
    hit = MagicMock()
    hit.scalar_one_or_none.return_value = uuid4()
    db.execute = AsyncMock(return_value=hit)

    with pytest.raises(HTTPException) as exc:
        await create_client(db, {"firstName": "Pat", "lastName": "HR"}, _valid_payload())
    assert exc.value.status_code == 409
    assert exc.value.detail == CLIENT_NAME_TAKEN
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_create_client_creates_nested_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    db = AsyncMock()
    unique_result = MagicMock()
    unique_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=unique_result)
    db.flush = AsyncMock()
    db.add = MagicMock()

    async def fake_industry(_db, name):
        return name

    created_id = uuid4()
    loc_row_id = uuid4()
    stake_id = uuid4()

    async def fake_reload(_db, client_id):
        return SimpleNamespace(
            client_id=client_id,
            client_name="Nova Therapeutics Inc",
            client_status="ACTIVE",
            client_company_type="Healthcare",
            industry="Healthcare",
            account_owner_id=None,
            is_internal=True,
            client_number=1001,
            client_company_contact_name="Pat Client",
            client_company_designation="Director",
            client_contact_email="pat@nova.test",
            client_net_term="30",
            msa_start_date=None,
            msa_end_date=None,
            created_by="Pat HR",
            updated_by="Pat HR",
            created_date=None,
            updated_date=None,
            location_links=[
                SimpleNamespace(
                    id=loc_row_id,
                    display_number=1001,
                    location_name="NYC office",
                    address="1 Market St",
                    city="New York",
                    state_province="NY",
                    country="US",
                    region="NA",
                    location=None,
                )
            ],
            stakeholders=[
                SimpleNamespace(
                    id=stake_id,
                    display_number=1001,
                    name="Pat Client",
                    title="Director",
                    department="Engineering",
                    email="pat@nova.test",
                    phone_number="555-0100",
                )
            ],
            invoicing_entities=[],
        )

    monkeypatch.setattr(clients_svc, "_assert_active_industry", fake_industry)
    monkeypatch.setattr(clients_svc, "_reload_client", fake_reload)

    def _add(obj):
        if getattr(obj, "client_name", None) == "Nova Therapeutics Inc":
            obj.client_id = created_id

    db.add.side_effect = _add

    body = await create_client(
        db,
        {"firstName": "Pat", "lastName": "HR"},
        _valid_payload(clientCategory="internal"),
    )
    assert body["clientName"] == "Nova Therapeutics Inc"
    assert body["id"]
    assert body["industry"] == "Healthcare"
    assert body["isInternal"] is True
    assert body["clientId"] == "CLI01001"
    assert len(body["locations"]) == 1
    assert body["locations"][0]["locationName"] == "NYC office"
    assert body["locations"][0]["clientLocationId"] == "LOC01001"
    assert body["stakeholders"][0]["name"] == "Pat Client"
    assert body["stakeholders"][0]["department"] == "Engineering"
    assert body["invoicingEntities"] == []
    assert db.flush.await_count >= 2


@pytest.mark.asyncio
async def test_update_client_replaces_nested_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    client_id = uuid4()
    customer = SimpleNamespace(
        client_id=client_id,
        client_name="Nova Therapeutics Inc",
        client_status="ACTIVE",
        client_company_type="Healthcare",
        industry="Healthcare",
        account_owner_id=None,
        is_internal=False,
        client_company_contact_name="Pat Client",
        client_company_designation="Director",
        client_contact_email="pat@nova.test",
        client_net_term="30",
        updated_date=None,
        location_links=[],
        stakeholders=[],
        invoicing_entities=[],
    )

    async def fake_industry(_db, name):
        return name

    async def fake_reload(_db, _client_id):
        return customer

    async def fake_get(_db, _client_id):
        return {"id": str(client_id), "clientName": customer.client_name}

    db = AsyncMock()
    unique_result = MagicMock()
    unique_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=unique_result)
    db.flush = AsyncMock()
    db.add = MagicMock()

    monkeypatch.setattr(clients_svc, "_assert_active_industry", fake_industry)
    monkeypatch.setattr(clients_svc, "_reload_client", fake_reload)
    monkeypatch.setattr(clients_svc, "get_client", fake_get)

    synced: dict[str, str] = {}

    async def fake_sync(_db, old_name, new_name):
        synced["old"] = old_name
        synced["new"] = new_name

    monkeypatch.setattr(clients_svc, "_sync_linked_project_names", fake_sync)

    body = await update_client(
        db,
        {"firstName": "Pat", "lastName": "HR"},
        client_id,
        _valid_payload(clientName="Nova Therapeutics Updated"),
    )
    assert body["clientName"] == "Nova Therapeutics Updated"
    assert customer.is_internal is False
    assert customer.client_category == "direct"
    assert synced == {
        "old": "Nova Therapeutics Inc",
        "new": "Nova Therapeutics Updated",
    }
    db.flush.assert_awaited()


@pytest.mark.asyncio
async def test_update_client_updates_stakeholder_email_in_place(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client_id = uuid4()
    loc_id = uuid4()
    stake_id = uuid4()
    location = SimpleNamespace(
        id=loc_id,
        display_number=1015,
        location_id=None,
        location_name="Arohak",
        address="1 Market St",
        city="St Louis",
        state_province="MO",
        country="US",
        zip="63034",
        region="NA",
    )
    stakeholder = SimpleNamespace(
        id=stake_id,
        display_number=1014,
        name="Durga",
        title="Developer",
        description=None,
        department=None,
        email=None,
        phone_number=None,
    )
    customer = SimpleNamespace(
        client_id=client_id,
        client_name="arohak Inc",
        client_status="ACTIVE",
        client_company_type="Technology",
        industry="Technology",
        account_owner_id=None,
        is_internal=False,
        client_company_contact_name="Durga",
        client_company_designation="Developer",
        client_contact_email="unknown@example.com",
        client_net_term="30",
        updated_date=None,
        location_links=[location],
        stakeholders=[stakeholder],
        invoicing_entities=[],
    )

    async def fake_industry(_db, name):
        return name

    async def fake_reload(_db, _client_id):
        return customer

    async def fake_get(_db, _client_id):
        return {
            "id": str(client_id),
            "clientName": customer.client_name,
            "contactEmail": customer.client_contact_email,
            "stakeholders": [
                {"id": str(row.id), "email": row.email, "name": row.name}
                for row in customer.stakeholders
            ],
        }

    db = AsyncMock()
    unique_result = MagicMock()
    unique_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=unique_result)
    db.flush = AsyncMock()

    monkeypatch.setattr(clients_svc, "_assert_active_industry", fake_industry)
    monkeypatch.setattr(clients_svc, "_reload_client", fake_reload)
    monkeypatch.setattr(clients_svc, "get_client", fake_get)
    monkeypatch.setattr(clients_svc, "_sync_linked_project_names", AsyncMock())

    body = await update_client(
        db,
        {"firstName": "Pat", "lastName": "HR"},
        client_id,
        _valid_payload(
            clientName="arohak Inc",
            industry="Technology",
            locations=[
                {
                    "id": str(loc_id),
                    "clientLocationId": 1015,
                    "locationName": "Arohak",
                    "address": "1 Market St",
                    "city": "St Louis",
                    "stateProvince": "MO",
                    "country": "US",
                    "zip": "63034",
                    "region": "NA",
                }
            ],
            stakeholders=[
                {
                    "id": str(stake_id),
                    "stakeholderId": 1014,
                    "name": "Durga",
                    "title": "Developer",
                    "email": "durga@gmail.com",
                }
            ],
        ),
    )
    assert stakeholder.email == "durga@gmail.com"
    assert customer.stakeholders[0] is stakeholder
    assert customer.client_contact_email == "durga@gmail.com"
    assert body["contactEmail"] == "durga@gmail.com"
    assert body["stakeholders"][0]["email"] == "durga@gmail.com"


def test_client_status_maps_inactive_to_archived() -> None:
    from app.core.serialize import client_status_from_api, client_status_to_api

    assert client_status_to_api("INACTIVE") == "Archived"
    assert client_status_to_api("Archived") == "Archived"
    assert client_status_to_api("ACTIVE") == "ACTIVE"
    assert client_status_from_api("Archived") == "INACTIVE"
    assert client_status_from_api("INACTIVE") == "INACTIVE"
    assert client_status_from_api("ACTIVE") == "ACTIVE"
