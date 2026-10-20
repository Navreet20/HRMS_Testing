# Projects module

Self-contained EAOVA HRMS projects surface (directory, create/edit/view panel,
staffing/lead workspace, employee “My projects”). Behavior follows
`eaova-projects-module.html`; visuals follow `BRANDING.md`. Implementation is
original — no `eaova-ui` imports.

## Status

Directory + definition panel + staffing/lead + soft-deactivate. Legacy
`ProjectDetails.js` is intentionally not ported.

## Folder

```
eaova-edited-ui/src/modules/projects/
```

## Shared contracts

Role and theme come from `eaova-edited-ui/src/shared/` (`HrmsRole`, `AppTheme`).

## Views

| View | Who | Purpose |
| --- | --- | --- |
| `directory` | Staff read roles | Searchable ACTIVE project list |
| `staffing` | Write personas | Roster, add members, set lead, end membership |
| `mine` | `EMPLOYEE` | Assigned projects only |

Paths: `/projects` · `/projects/:projectId`

## Project kinds

- **COMMERCIAL** — client, vendor, invoice period, work contact
- **DEPARTMENT** — protected container names: `ADMIN`, `ACCOUNTANT`, `HR`,
  `IMMIGRATION`, `MARKETING`, `ONBOARDING`, `EMPLOYEE` (non-SUPERADMIN view-only)

## Policy (Nest-aligned)

| Action | Gate |
| --- | --- |
| List | Read roles; `EMPLOYEE` excluded |
| Create | Write roles ∩ (`createAccess \|\| fullAccess`) |
| View | `viewAccess \|\| fullAccess` |
| Edit | Write roles ∩ (`editAccess \|\| fullAccess`); protected names SUPERADMIN only |
| Deactivate | Write roles ∩ `fullAccess`; soft → `INACTIVE` |
| Staff / lead | Write roles ∩ (`editAccess \|\| fullAccess`) |

Write roles: `ADMIN`, `SUPERADMIN`, `HR`, `ACCOUNTANT`  
Read-only specialists (`ONBOARDING`, `IMMIGRATION`) may list/view
but cannot create (fixes legacy UI/API mismatch).

## Mock data

`MOCK_PROJECTS_DATA` seeds commercial projects `proj-1`…`proj-3` (aligned with
Employees), department containers, clients/vendors, and memberships including
`emp-5` for the EMPLOYEE persona.

## Anti-patterns

No React Router, AG Grid, Bootstrap, axios, SweetAlert, or `localStorage` inside
this module.
