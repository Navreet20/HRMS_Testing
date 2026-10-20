# Manage Access / RBAC — Super Admin & Admin workflow (DATA-8)

Access is grant-based. Role labels (`SUPERADMIN`, `ADMIN`) are identity only.

## Personas (wireframe UI)

| Actor | Directory targets | What they assign |
|-------|-------------------|------------------|
| **Superadmin** | All active employees (excl. Superadmins) | Modules / submodules (`read_only` or `full_access`) — full access = Admin |
| **Admin** | `EMPLOYEE` only | Modules / submodules (`read_only` or `full_access`) |

Both personas need Active **Company Setup → RBAC** `full_access` to open RBAC.

## Screens (match Cognivance wireframes)

- **Employees directory** — search active employees, or choose **Show → All**
  (placeholder "Select employees") to list everyone; the table stays empty
  until one is used; **Grant** (no access yet),
  **View / Edit** (has access), **View** (inactive).
- **Assign access** (`AssignAccessDialog`) — opened by Grant and View / Edit.
  One table of every grantable module (`MOD-00x` code) and its submodules:
  - checkbox per row, **View only / Full access** segmented control (disabled until checked); no search;
  - module row with submodules shows `n/m submodules` and a tri-state checkbox:
    checked = all submodules, dash = some, empty = none. Checking it (from
    empty or dash) selects every submodule; unchecking clears them. Deselecting
    one submodule turns the parent into a dash, not unchecked;
  - the module's View only / Full access level applies to its selected submodules; if they differ,
    neither is highlighted;
  - header: tri-state select-all checkbox, plus a **Clear all** link once any
    row is checked (staged like any other change until Save; selecting all
    keeps existing levels and gives new rows Full access);
  - **Revoke** on rows that already have a grant (confirm, then immediate);
  - **Revoke all** in the header's revoke column, shown only when the employee
    has grants: confirm, then immediately revokes every Active grant
    (`PUT /rbac/employees/{id}/access` with an empty list);
  - footer `N modules selected` · Cancel · **Save access**.
  Save sends the whole table to `PUT /rbac/employees/{id}/access`: newly checked
  rows are granted, changed levels updated, unchecked rows revoked.
- **View access** — read-only grant table with Revoke and Edit access.

## Super Admin

- Bootstrap seeds **Company Setup → full_access** on every Company Setup
  submodule for the Superadmin employee (DATA-10).
- Super Admin grants access to **any active employee**. Superadmins are
  excluded from the directory.

## Admin

- No “Make Admin” button and no CSV bulk import.
- An Admin is someone who received **full_access** grants on each module they need.
- After that, the Admin persona assigns granular access to **Employees**.

## Manage Access gate

- API + UI require Active Company Setup → RBAC `full_access`.
- `Role.ADMIN` / `Role.SUPERADMIN` alone is not enough.

## Employee Portal (not grantable)

Employee Portal is never assigned here. The backend adds it to every session:

- **Self** — every employee, Superadmin included.
- **Manage** — while at least one active employee reports to them.

## Grantable modules

Dashboard (always on, not shown), Employees → Onboarding, Clients, Projects,
Asset Management, Audit Trail, Company Setup → Company Profile / Departments /
Locations / Designations / Leave Policy / RBAC.

Each Company Setup page checks its own submodule (`NAV_GRANT_RULES` in
`src/shared/accessGrants.ts`, `require_module_access(..., submodule_key=...)` on
the API). A legacy module-wide grant still satisfies every submodule.
Nav items in `ROLE_GATED_NAV_IDS` (`src/shell/navPolicy.ts`) are gated by role, not RBAC.

## Adding a new module

1. **Backend catalog** — add a `CatalogModule(key, name, display_order, submodules)`
   to `DEFAULT_RBAC_CATALOG` in `hrms-backend/app/modules/rbac/catalog.py`.
2. **Backend routes** — protect the module's API with
   `require_module_access(<key>, submodule_key=..., min_level=...)`.
3. **Frontend** — add the key to `GRANT_MODULE_KEYS` (and any submodule keys to
   `GRANT_SUBMODULE_KEYS`) and a rule to `NAV_GRANT_RULES` in
   `src/shared/accessGrants.ts`.

Restart the backend: the startup seed inserts the module and it appears in RBAC.
Missing a step fails tests (`test_rbac_key_drift.py`, `navGrantCoverage.test.ts`),
and an unknown key in `require_module_access` stops the API from starting.

This in-app RBAC is temporary until access moves to Azure AD (Entra) roles —
keep it to bug fixes and new catalog entries.
