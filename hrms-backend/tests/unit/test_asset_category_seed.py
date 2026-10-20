"""Asset category seeding runs at startup only, never on a read endpoint."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

from app.modules.assets import service as svc
from app.modules.assets.constants import SEED_ASSET_CATEGORIES


def _db_with_existing_category(exists: bool) -> AsyncMock:
    result = MagicMock()
    result.first.return_value = ("id",) if exists else None
    db = AsyncMock()
    db.add_all = MagicMock()
    db.execute = AsyncMock(return_value=result)
    return db


async def test_seed_adds_defaults_when_table_is_empty() -> None:
    db = _db_with_existing_category(False)

    added = await svc.seed_default_asset_categories(db)

    assert added == len(SEED_ASSET_CATEGORIES)
    names = [row.category_name for row in db.add_all.call_args.args[0]]
    assert names == list(SEED_ASSET_CATEGORIES)
    assert db.execute.await_count == 1


async def test_seed_does_nothing_when_a_category_exists() -> None:
    db = _db_with_existing_category(True)

    added = await svc.seed_default_asset_categories(db)

    assert added == 0
    db.add_all.assert_not_called()


async def test_read_paths_do_not_seed(monkeypatch) -> None:
    seed = AsyncMock()
    monkeypatch.setattr(svc, "seed_default_asset_categories", seed)
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.all.return_value = []
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    monkeypatch.setattr(svc, "_category_map", AsyncMock(return_value={}))
    monkeypatch.setattr(svc, "_open_allocations_by_asset", AsyncMock(return_value={}))
    monkeypatch.setattr(svc, "_employees_by_id", AsyncMock(return_value={}))

    await svc.list_categories(db)
    await svc.list_assets(db)
    await svc.list_categories_with_stock(db)

    seed.assert_not_awaited()


async def test_catalog_for_category_does_not_seed(monkeypatch) -> None:
    seed = AsyncMock()
    monkeypatch.setattr(svc, "seed_default_asset_categories", seed)
    category = MagicMock()
    category.category_id = uuid.uuid4()
    category.category_name = "Laptop"
    category_result = MagicMock()
    category_result.scalar_one_or_none.return_value = category
    assets_result = MagicMock()
    assets_result.scalars.return_value.all.return_value = []
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[category_result, assets_result])

    await svc.list_asset_catalog_for_category(db, str(category.category_id))

    seed.assert_not_awaited()
