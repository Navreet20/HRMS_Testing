# Database / schema

Schema follows an ORM-first pattern:

| Step | Where |
|------|--------|
| Table definitions | `app/models/` (SQLAlchemy) |
| New tables | `Base.metadata.create_all()` on API boot / bootstrap |
| Additive columns/indexes | `app/db/schema_ensure.py` (idempotent) |
| Legacy one-off SQL | `app/db/embedded_sql.py` |

## Day-to-day

1. Change models under `app/models/`.
2. New column on an existing table → also add `ADD COLUMN IF NOT EXISTS` in `schema_ensure.py`.
3. Restart the API — `create_all` + ensure run automatically.

```bash
.venv/bin/python -m uvicorn app.main:app --reload --port 5001
```

## Fresh database

If the Postgres **database** does not exist yet:

```bash
python scripts/bootstrap_db.py --schema-only
```

That creates the DB (if missing), then the same `create_all` + ensure path.
The API adds its own starter data (default company, admin, catalogs) on startup.
