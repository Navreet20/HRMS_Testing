# Backend tests

| Folder | Purpose | Run |
|--------|---------|-----|
| `unit/` | Pure logic, no live app/DB | `pytest tests/unit` or `pytest -m unit` |
| `functional/` | API/feature behavior (ASGI client, mocks) | `pytest tests/functional` or `pytest -m functional` |

All:

```bash
pytest
```

Set `SKIP_DB_TESTS=1` to skip tests that need a live Postgres.
