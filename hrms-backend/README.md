# hrms-backend (FastAPI)

Python FastAPI API for `hrms-frontend`, REST under `/api/v1`.

## Prerequisites

- Python 3.12+
- PostgreSQL: the team's Neon database by default. For a local database, use a natively installed Postgres and point `DB_*` in `.env` at it (`DB_HOST=localhost`, `DB_PORT=5432`, `DB_SSL=false`).
- S3-compatible file storage (MinIO) for uploaded documents: set the `MINIO_*` values in `.env`.

Load schema if empty (from this package — **code-only**, no SQL patch files):

```bash
python scripts/bootstrap_db.py --schema-only
```

Or start the API; lifespan runs `app/db/schema_ensure.py` automatically after models are present.

## Setup

```bash
cd hrms-backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # adjust JWT_SECRET / DB if needed
```

Or with [uv](https://docs.astral.sh/uv/) (installs everything and starts the API):

```bash
cd hrms-backend
cp .env.example .env            # adjust JWT_SECRET / DB if needed
uv run main.py                  # API on PORT from .env (default 5001); options: --port, --no-reload
uv run pytest tests/unit -q     # run the tests
```

`pyproject.toml` (uv) and `requirements.txt` (CI) list the same packages; update both when you add one.

Dev login: sign in with Microsoft. Emails in `SUPERADMIN_EMAILS` (comma-separated) get a
Superadmin account on their first sign-in.

### Temporary auth bypass (local only)

Set in `hrms-backend/.env`:

```
AUTH_BYPASS=true
```

And in `hrms-frontend/.env`:

```
NEXT_PUBLIC_AUTH_BYPASS=true
```

This skips JWT/CSRF and loads all modules as a synthetic SUPERADMIN. **Turn both off before any shared/prod use.**

## Run

```bash
cd hrms-backend
.venv/bin/python -m uvicorn app.main:app --reload --reload-dir app --reload-delay 2 --port 5001
```

`--reload` uses **watchfiles** (see below). Without `--reload-dir app`, uvicorn watches all of `hrms-backend/` (including `tests/`) and reloads too aggressively (`--reload-delay` defaults to 0.25s), which can cause reload storms and frontend proxy `socket hang up` errors — especially if the repo lives in iCloud-synced `Documents/`.

Optional macOS launcher with cleaner Ctrl+C shutdown: `python scripts/run_dev.py`

- App UI: [http://localhost:3000](http://localhost:3000) (Next.js)
- Health: [http://localhost:5001/health](http://localhost:5001/health)
- OpenAPI: [http://localhost:5001/docs](http://localhost:5001/docs)
- Login: `POST /api/v1/auth/login` → `{ userDetails, token }` (row stored in `AUTH_SESSION`)
- Current session: `GET /api/v1/auth/me` (Bearer or httpOnly cookie)
- Logout: `POST /api/v1/auth/logout` (revokes `AUTH_SESSION`)



## Tests

```bash
pytest                         # all
pytest tests/unit              # unit
pytest tests/functional        # functional (API/mocks; includes former regression locks)
# or by marker:
pytest -m unit
pytest -m functional
```

Set `SKIP_DB_TESTS=1` to skip tests that need a live Postgres.

**Schema note:** Schema is defined in SQLAlchemy models (`app/models/`) and applied via `app/db/schema_ensure.py` on API startup (and by `scripts/bootstrap_db.py` for greenfield DBs). There is no `db/*-patch.sql` workflow.

**Skills catalog:** Platform-wide shared list in `"SKILL"` (`ID` + `SKILL_NAME`), seeded from embedded SQL in `app/db/embedded_sql.py` during schema ensure. Catalog is not editable via Admin UI/API; employees pick skills with `GET /skills`.

## Scheduled jobs (ops)

| Job | Script | When |
|-----|--------|------|
| Leave Jan 1 grant + rollover (LEAVE-DATA-6) | `python scripts/run_annual_leave_grant.py [--year YYYY]` | Cron Jan 1 (e.g. `0 0 1 1 *`). Idempotent; creates missing year balances and applies prior-year rollover caps. |
| Timesheet reminder | `python scripts/run_timesheet_reminder.py` | Weekly (company config weekday) |
| Document expiry | `python scripts/run_document_expiry.py` | As needed |

## Auth policy

- Missing/invalid Bearer **or** httpOnly `eaova_access` cookie on `/api/v1/`* → **401**
- Valid JWT with missing/revoked/expired `AUTH_SESSION` → **401**
- Mutating requests without matching `eaova_csrf` cookie + `X-CSRF-Token` header → **403** (login/csrf bootstrap exempt)
- Valid JWT, wrong role → **403**
- Public: `GET /`, `GET /api/v1/auth/csrf`, `POST /api/v1/auth/login`
- Password hashes: **argon2** for new writes; **bcrypt** still verifies (legacy rows)
- Login creates durable `AUTH_SESSION` + sets httpOnly access cookie and CSRF cookie
- Superadmin allowlist: `SUPERADMIN_EMAILS` (comma-separated). A listed person's account is
created on their first Microsoft sign-in, named from Microsoft, no password — see `.env.example`
- Sign-in matches the saved Microsoft object id (`oid`); the email is used only once, to link it

## RBAC modules

- Module access comes from `resolve_session_grants()` in `app/modules/rbac/session_grants.py`
(source set by `RBAC_GRANT_SOURCE`, currently `db` = Manage Access grant rows).
- Grantable modules and their stable keys live in `app/modules/rbac/catalog.py`; the
startup seed syncs them to `MODULE` / `SUBMODULE`, deactivates removed modules, and
drops grants on them (history stays in `ACCESS_GRANT_AUDIT`).
- Employee Portal is derived per session (Self for everyone, Manage for managers) and
is not in the catalog.
- Employees has one submodule (Onboarding); Company Setup has one per sidebar page
(Company Profile, Departments, Locations, Designations, Leave Policy, RBAC). Each
Company Setup route checks its own submodule, e.g. `/rbac/*` needs Company Setup → RBAC.
When a module gains submodules, the seed turns each module-wide grant into one grant
per submodule at the same level.
- `PUT /rbac/employees/{id}/access` with `{grants: [{moduleId, submoduleId?, accessLevel}]}`
saves the Assign access dialog: the listed rows become the employee's full Active set
(new rows granted, changed levels updated, missing rows revoked, all audited).
An empty list revokes everything (the dialog's Revoke all).
- To add a module, follow "Adding a new module" in
`hrms-frontend/src/modules/manageAccess/README.md`.



### Auth flow (hrms-frontend host)

1. Use same-origin Next.js rewrites: `NEXT_PUBLIC_API_BASE=/api/v1` (open **[http://localhost:3000](http://localhost:3000)**, not a direct `localhost:5001` browser URL).
2. Backend CORS must include the Next origin (`http://localhost:3000`); cookies use `SameSite=Lax` (set `COOKIE_SECURE=true` in production HTTPS).
3. Superadmin accounts come from `SUPERADMIN_EMAILS` on first Microsoft sign-in.

Then start FastAPI:

```bash
cd hrms-backend
python scripts/run_dev.py
```

1. Frontend:

```bash
cd hrms-frontend
cp .env.example .env
npm run dev
```

UI: **[http://localhost:3000](http://localhost:3000)** (Next.js). API: **[http://localhost:5001](http://localhost:5001)**.

1. Sign in → CSRF bootstrap → `POST /api/v1/auth/login` sets httpOnly cookie. Refresh restores via `GET /api/v1/auth/me`. Sign out revokes DB session and clears cookies.
2. JWT is **not** stored in `localStorage` / `sessionStorage`. Modules must not own auth storage.



## hrms-frontend cutover

```env
NEXT_PUBLIC_API_BASE=/api/v1
API_PROXY_TARGET=http://localhost:5001
```

Use `createApiRequest({ basePath: "/api/v1", getToken })` and `createHttpAttendanceGateway({ request })`. Same-origin `/api/*` is rewritten to FastAPI.