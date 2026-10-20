# Employees module

Self-contained EAOVA HRMS employees surface (directory, onboarding wizard,
approvals). Behavior follows the Employees functional reference; implementation
is original — no `eaova-ui` imports.

## Status

**Users-plan Phases 0–6 (complete)** — Directory/access layer on Employees
(not a separate `/users` module): invite/view/edit access panel, soft-delete
with explicit end date, reactivation, Pending Approvals + onboarding wizard
retained. App tokens remain `/employees` and `/PendingApprovals`.

## Folder

```
eaova-edited-ui/src/modules/employees/
```

## Shared contracts

Role and theme come from `eaova-edited-ui/src/shared/` (`HrmsRole`, `AppTheme`).
This module does **not** import from `modules/dashbord`.

## Public surface

| Export | Notes |
| --- | --- |
| `EmployeesModule` | Root component |
| `EmployeeActor` / `EmployeesModuleData` | Actor + session data contracts |
| `EmployeesModuleProps` | Controlled/uncontrolled actor + data, theme, navigation callbacks |
| `employeesReducer` / selectors | Pure policy + lifecycle |
| `EMPTY_EMPLOYEES_DATA` | Empty module snapshot (default until live data loads) |
| `createHttpEmployeesGateway` | Live FastAPI gateway (DB + MinIO documents/avatars). List filters use `GET /employees?status=&q=` (MFTR-60); see backend `employee/MIGRATION.md` (22 routes incl. PUT/GET/DELETE `/employees/{id}/avatar`) |
| `VIA_LINK_AVAILABLE` / `EXCEL_IMPORT_AVAILABLE` | Via-Link stub; CSV import/export live |

### Lifecycle states

Presentation-only: `NEW` · `PENDING` · `ACTIVE` · `REJECTED` · `INACTIVE`

| Transition | Result |
| --- | --- |
| Create | `PENDING` |
| Approve | `ACTIVE` |
| Reject | `REJECTED` (comments required) |
| Soft-delete | `INACTIVE` + `endDate` (never hard-delete) |
| Reactivate `INACTIVE` | `ACTIVE` |

### Invite / creation policy (Phase 2 — corrected)

The Invite button (`canCreateEmployee`) requires **both**:

- `role ∈ SUPERADMIN | ADMIN | HR | ONBOARDING`
- `createAccess || fullAccess`

Roles outside that allow-list (`ACCOUNTANT`, `IMMIGRATION`,
`EMPLOYEE`) never see Invite, regardless of access flags.

Assignable target roles (`getAllowedTargetRoles` /
`CREATION_ASSIGNABLE_ROLES` in `constants.ts`) follow the HTML reference's
explicit `deptPermissions` table — **not** a hierarchy-rank computation:

| Signed-in role | Can invite as… |
| --- | --- |
| `SUPERADMIN` | `SUPERADMIN`, `ADMIN`, `HR`, `ACCOUNTANT`, `ONBOARDING`, `IMMIGRATION` |
| `ADMIN` | `ADMIN`, `HR`, `ACCOUNTANT`, `ONBOARDING`, `IMMIGRATION` |
| `HR` | All configured roles, including `EMPLOYEE` |
| `ONBOARDING` | `EMPLOYEE` only |
| Others | none (empty list) |

An earlier v1 draft used an "equal-or-weaker hierarchy rank" invention for
creation instead of this explicit mapping — that has been replaced. Hierarchy
protection (target must not outrank actor) is still used, but only for
**editing/managing already-existing employees** (`canEditEmployee`,
`canManageWithFullAccess`, `canSoftDeleteEmployee`),
never for what a role may create.

### Other action gates (Phase 2)

| Action | Gate |
| --- | --- |
| View / Edit | Non-drafts: `viewAccess \|\| fullAccess` (EMPLOYEE may always view self) |
| Resume draft | `NEW` drafts only — hire roles with create access |
| Discard | `NEW` drafts only — `fullAccess` (hard-delete API; draft wording) |
| Deactivate (soft delete) | Non-drafts: `fullAccess` **plus hierarchy** |
| Reactivate (`INACTIVE` only) | `fullAccess` **plus hierarchy** |
| Delete permanently | Non-drafts: `fullAccess` **plus hierarchy** |

Draft rows intentionally omit View/Edit, Invite, and Deactivate. Invite remains
the final step inside the hire wizard after mandatory fields are complete.

`EMPLOYEE` remains excluded from the organization directory entirely.
Hierarchy-blocked management actions stay visible but disabled with a clear
explanation string (`selectEmployeeActions`, `describeDisabledManagement`).

### Employment / project contracts (mock, `types.ts`)

`EmployeeRecord` carries `company`, `employmentType` (`FULL_TIME` ·
`CONTRACTOR` · `PART_TIME` · `INTERN` · `CONTRACT_1099`), `vendorId` (required
when `employmentType` is vendor-billed — see `isVendorRequired`), `jobRank`,
and `jobDescription`. `projectIds` remains for compat but is **derived** from
the explicit `projectAssignments: ProjectAssignment[]` (`assignmentType`:
`PRIMARY`/`ADDITIONAL`, `status`: `ACTIVE`/`INACTIVE`) — never hand-edit
`projectIds` independently.

Editing the primary project (`updateEmployeeAccess` with
`primaryProjectChange`) applies one typed `PrimaryProjectTransition`:
`KEEP_OLD_PRIMARY_NEW_ADDITIONAL` · `KEEP_NEW_PRIMARY_OLD_ADDITIONAL` ·
`KEEP_NEW_PRIMARY_OLD_INACTIVE`. The prior primary assignment is never
removed, only re-flagged (never-hard-delete rule).

`ProjectOption` carries `eligibleRoles` / `eligibleRanks` — informational
eligibility metadata only, not used to auto-match project names to roles.

`checkWorkEmailUniqueness` returns a typed `WorkEmailUniquenessResult`
distinguishing an `ACTIVE` conflict (always blocked) from an `INACTIVE`
conflict (invite panel offers reactivation); `isWorkEmailUnique` remains a
boolean convenience wrapper.

### Directory / access UI

Columns: Name · Email · Employee Code · Department · Company · Status · Actions.
Narrow screens use a deliberate card layout (`data-label`). View/Edit open
`EmployeeAccessPanel` (create/view/edit); the full wizard is for onboarding
profile work only. Deactivate opens `DeactivateEmployeeDialog` (project
preview + required end date). Primary-project edits prompt for a typed
`PrimaryProjectTransition`.

Live company/vendor/project options come from the FastAPI snapshot (and
related modules), not UI mock catalogs.

## Guards

- No AG Grid, Bootstrap, SweetAlert, Axios, JWT, or browser storage
- No React Router — host uses state-based navigation
- Mutations require `gateway` (Postgres + MinIO); no in-memory mock catalog
- Via-Link marked unavailable; CSV import/export is live

## Host usage

```ts
import {
  createDefaultActor,
  createHttpEmployeesGateway,
  EmployeesModule,
} from "./modules/employees";

<EmployeesModule
  actor={createDefaultActor("ADMIN")}
  defaultData={liveEmployeesData}
  gateway={createHttpEmployeesGateway({ request: apiRequest })}
  theme={theme}
/>
```

## Tests

Suites live under `eaova-edited-ui/test/employees/` (not colocated with source).

```bash
npm test
```
