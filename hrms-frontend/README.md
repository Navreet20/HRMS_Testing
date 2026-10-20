# hrms-frontend

Next.js (App Router) + React host for HRMS modules. FastAPI remains the API.

Local pair: **Next.js http://localhost:3000** + **uvicorn http://localhost:5001**.

**Node.js:** **20.9+** required (Next.js 16). Prefer **22 LTS** (`nvm use` in this folder reads `.nvmrc`).

## Auth (FastAPI) — required

`NEXT_PUBLIC_API_BASE` is **required**. The app talks to FastAPI through Next rewrites (`/api/*` → `:5001`) so httpOnly cookies stay same-origin. Open **http://localhost:3000**, not the API port.

| Env | Behavior |
|-----|----------|
| `NEXT_PUBLIC_API_BASE=/api/v1` | Login → `POST /auth/login`; cookie session; modules load via REST gateways |
| Unset | Host treats the live API as unconfigured |

```env
# hrms-frontend/.env (copy from .env.example)
NEXT_PUBLIC_API_BASE=/api/v1
NEXT_PUBLIC_AUTH_BYPASS=false
API_PROXY_TARGET=http://localhost:5001
```

```bash
# Backend (run_dev.py: reliable Ctrl+C with --reload)
cd hrms-backend
python scripts/run_dev.py

# Frontend
cd hrms-frontend
npm install
npm run dev
```

Then open http://localhost:3000

Dev login (bootstrap admin): `developer@example.com` / `Password123!`

Routes live under `src/app` (Next.js App Router). Paths are `/employees`, `/profile`, `/attendance`, etc.

## Tests

```bash
npm test                 # all Jest
npm run test:unit
npm run test:functional
npm run test:regression
npm run lint             # ESLint (next lint was removed in Next.js 16)
npm run check:z-index    # fail on raw z-[…] / numeric zIndex outside zIndex.ts
npm run test:e2e         # Playwright against http://localhost:3000
```

Layout: `test/unit`, `test/functional`, `test/regression`, plus `test/support` fixtures. Jest still runs module tests against `src/` (no Next required).

Playwright needs FastAPI `:5001` (seeded) and Next `:3000` with `AUTH_BYPASS` / `NEXT_PUBLIC_AUTH_BYPASS` off. It reuses an already-running Next server.

### Live vs mock modules

| Module | Live | Notes |
|--------|------|-------|
| Attendance | Yes | Full HTTP gateway (reads + writes) |
| Dashboard, Employees, Leaves, Projects, Company, Clients, Vendors, Billing, Payrolls, Revenue | Yes (reads) | Host bootstraps snapshots via REST; local edits stay in-module until write paths are wired through gateways |
| Profile | Yes | Uses session + live employee directory when available |
| Schedule | Yes | Events load through the schedule gateway |

## Checks before you push

There is no pre-commit hook in this repo yet (husky is not installed). Run these yourself before pushing; CI (`.github/workflows/frontend-ci.yml`) runs the same checks and fails the build if one breaks:

```bash
npm run typecheck
npm run lint             # ESLint (`eslint .`)
npm run check:z-index    # fix stacking tokens in `src/ui/zIndex.ts` if it fails
npm test
```

After clone, run `npm install` in this directory.
