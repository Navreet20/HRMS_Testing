# Org catalogs — API wiring (no screens)

Handoff for the frontend teammate on **`feat/ui-org-masters`**. Merge this branch, drop your screens onto it, then push to **`feat/employee-master`**. This is a wiring-only handoff — it is not already on the collect branch.

## What this is / what it is not

**This is:** HTTP gateway + role gate + friendly error mapping for departments, locations, and designations.

**This is not:**

- No `/org` App Router page
- No Setup nav item (Setup still only has Company)
- No Admin UI, directories, or forms — you own screens and wireframes

Do not restyle existing Employees/Company chrome. Do not invent extra fields.

## How to wire your screens

Public surface is `src/modules/org/index.ts`. From another module (for example `src/modules/employees/`):

```ts
import { apiRequest, userFacingApiError } from "../../shared";
import {
  canManageOrgCatalogs,
  createHttpOrgGateway,
  departmentToCreateBody,
  designationToCreateBody,
  locationToCreateBody,
  normalizeDepartments,
  normalizeDesignations,
  normalizeLocations,
  validateDepartmentDraft,
  validateDesignationDraft,
  validateLocationDraft,
  type DepartmentDraft,
  type LocationDraft,
  type DesignationDraft,
} from "../org";
```

From a file inside `src/modules/org/`, import the barrel as `"."` and shared as `"../../shared"`. There is no `@/` alias.

### Construct the gateway yourself

`HrmsProvider` does **not** inject an org gateway. `liveModuleGateways` has employees, leaves, company, etc. — not org.

```ts
const orgGateway = createHttpOrgGateway({ request: apiRequest });
```

Pass `apiRequest` from `src/shared` (cookie + CSRF). Do not call `/departments`, `/locations`, or `/designations` by hand.

### List / create / edit / deactivate

`OrgGateway` methods (`src/modules/org/gateway/orgGateway.ts`):

| Action | Departments | Locations | Designations |
| --- | --- | --- | --- |
| List | `listDepartments()` | `listLocations()` | `listDesignations()` |
| Create | `createDepartment(body)` | `createLocation(body)` | `createDesignation(body)` |
| Edit / status | `updateDepartment(id, body)` | `updateLocation(id, body)` | `updateDesignation(id, body)` |

Deactivate is a PATCH, not a delete:

```ts
await orgGateway.updateDepartment(departmentId, { status: "Inactive" });
```

Same `{ status: "Inactive" }` / `{ status: "Active" }` on locations and designations.

There are **no** `delete*` methods on `OrgGateway`. Do not add hard-delete UX. Backend `DELETE` exists for admins; the gateway does not wrap it.

List returns `unknown`. Normalize before render. Empty catalog is **`[]`** (API empty list, or a non-array payload):

```ts
const departments = normalizeDepartments(await orgGateway.listDepartments());
const locations = normalizeLocations(await orgGateway.listLocations());
const designations = normalizeDesignations(await orgGateway.listDesignations());
```

Single-row helpers: `normalizeDepartment`, `normalizeDesignation`, `normalizeLocation` (return `null` if id/name missing).

### Create bodies and client validation

Validate drafts, then map to camelCase POST bodies:

```ts
const error = validateDepartmentDraft(draft); // "Department name is required."
if (error) { /* show error */ }
await orgGateway.createDepartment(departmentToCreateBody(draft));
```

| Draft → body | Required on draft |
| --- | --- |
| `departmentToCreateBody` | `departmentName` |
| `locationToCreateBody` | `locationName`, `addressLine1`, `city`, `state`, `zip`, `country`, `timezone` |
| `designationToCreateBody` | `title` |

Optional strings become `null` when blank (`parentDepartmentId`, `departmentHeadId`, `addressLine2`, `locationCode`, `locationType`, `jobFamily`).

For PATCH edits, send only the fields that changed (plus `{ status }` for activate/deactivate). You can reuse the same camelCase keys as the create helpers.

### Who can manage vs who can pick

```ts
canManageOrgCatalogs({ role: actor.role })
```

`ORG_WRITE_ROLES` is `ADMIN` and `SUPERADMIN` only (`src/modules/org/constants.ts`). Hide create/edit/deactivate for everyone else.

| Role | GET list | Writes (POST/PATCH) |
| --- | --- | --- |
| Admin / Superadmin | Active **and** Inactive | Allowed |
| HR | **Active only** | **403** |
| Other staff | Active only (same GET as HR) | 403 |

`isOrgActor` type-guards `{ role }`. Status literals: `ORG_STATUS_VALUES` → `"Active"` \| `"Inactive"` (`OrgMasterStatus`).

### Friendly errors

```ts
try {
  await orgGateway.createDepartment(departmentToCreateBody(draft));
} catch (error) {
  setNotice(userFacingApiError(error));
}
```

`userFacingApiError` lives in `src/shared` (re-export of `toUserFacingApiError`). The gateway already runs `mapApiHttpError`; this maps remaining text (duplicates, assigned-employee blocks, CSRF, 401) into sentences for the UI.

### Employee form on this branch

Employee wizard **Organization** dropdowns (department / location / designation) still load through **`createHttpEmployeesGateway`** (`listDepartments`, `listLocations`, `listDesignations` in `EmployeesModule`). They do **not** use `createHttpOrgGateway` yet. Use the Employees invite/create wizard to confirm GET while you build Admin screens.

## Local setup

The team's shared Neon Postgres is the default. For a local database, use a natively installed Postgres on **localhost:5432**.

Example local credentials (your own install; Neon values come from the team):

| | |
| --- | --- |
| User | `postgres` |
| Password | the one you set |
| Database | `hrms` |
| Host | `localhost` |

Copy `hrms-backend/.env.example` → `.env` and fill in the `DB_*` values. Keep **`AUTH_BYPASS=false`**.

Copy `hrms-frontend/.env.example` → `.env`. Keep **`NEXT_PUBLIC_AUTH_BYPASS=false`**. `NEXT_PUBLIC_API_BASE=/api/v1` and `API_PROXY_TARGET=http://localhost:5001` stay as in the example. Open **http://localhost:3000**, not `:5001`.

```bash
# Backend — schema (the API adds starter data on startup)
cd hrms-backend
python scripts/bootstrap_db.py
python scripts/run_dev.py

# Frontend
cd hrms-frontend
npm run dev                             # :3000
```

### Persona logins

Header **Dev account** switcher (`src/shared/devPersonaAccounts.ts`). Superadmin /
Admin / HR match backend `BOOTSTRAP_*` env:

| Persona | Email | Password | Catalog writes |
| --- | --- | --- | --- |
| Superadmin | `developer@example.com` | `Password123!` | Yes (SUPERADMIN) |
| Admin | `admin@example.com` | `Password123!` | Yes |
| HR | `hr@example.com` | `Password123!` | No (GET active-only, writes 403) |

**Confirm GET** (no `/org` page): sign in as Admin → Employees → invite/create → **Organization** step → department, location, and designation dropdowns. Switch to HR and confirm those dropdowns still populate (active rows only).

## API cheat sheet

Browser calls go through Next (`/api/v1/...`). Gateway paths are relative to that base:

| Method | Path | Who |
| --- | --- | --- |
| GET | `/departments` `/locations` `/designations` | Staff (HR = active-only) |
| POST | same collections | Admin / Superadmin |
| PATCH | `/departments/{id}` `/locations/{id}` `/designations/{id}` | Admin / Superadmin |

Bodies and responses are **camelCase**. Status is **`Active`** or **`Inactive`** (`ORG_STATUS_VALUES`). Creates start Active.

POST bodies (same keys the `*ToCreateBody` helpers emit):

- Department: `departmentName`, `parentDepartmentId`, `departmentHeadId`
- Location: `locationName`, `addressLine1`, `addressLine2`, `city`, `state`, `zip`, `country`, `timezone`, `locationCode`, `locationType` (`HQ` / `Warehouse` / `Client site` / `Remote hub` / `Other`)
- Designation: `title`, `jobFamily`

HR GET = active-only. HR POST/PATCH = **403** (`You do not have access to create or change this. Ask an admin.`).

## Out of scope

Not this wiring, not these screens:

- Skills admin
- National ID type admin
- Dev 2 extra employee fields
- Dev 3 ID number / draft save

## Tests to run

From `hrms-frontend`:

```bash
npx jest test/unit/org/selectors.test.ts test/unit/shared/userFacingApiError.test.ts test/regression/httpGateways.routes.test.ts
```
