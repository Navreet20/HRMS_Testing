# Company module

Self-contained EAOVA HRMS company directory (list, create/edit/view panel,
soft-deactivate). Behavior follows the legacy `eaova-ui` Company screens;
visuals follow `BRANDING.md`. Implementation is original — no `eaova-ui`
imports.

## Status

Directory + definition panel + soft-deactivate. Nested client/vendor creation
from the legacy form is intentionally not ported (dead UI in the source).

## Folder

```
eaova-edited-ui/src/modules/company/
```

## Shared contracts

Role and theme come from `eaova-edited-ui/src/shared/` (`HrmsRole`, `AppTheme`).

## Views

Single directory workspace. Path: `/company/overview`

## Policy (legacy-aligned)

| Action | Gate |
| --- | --- |
| List | Staff roles; `EMPLOYEE` excluded |
| Create | `SUPERADMIN` ∩ (`createAccess \|\| fullAccess`) |
| View | `viewAccess \|\| fullAccess` |
| Edit | `SUPERADMIN` ∩ (`editAccess \|\| fullAccess`) |
| Deactivate | `SUPERADMIN` ∩ `fullAccess`; soft → `INACTIVE` |

## Form contract

- **Name and contact:** name, type, email, phone, website (required); logo optional JPG/PNG ≤ 25KB
- **Address:** line 1, country, state, city, ZIP (required); line 2 optional
- Country/state/city options come from `country-state-city` via `@/modules/org/geo`

## Mock data

`MOCK_COMPANY_DATA` seeds seven companies (`co-1`…`co-7`), including one
`INACTIVE` row for filter coverage.

## Anti-patterns

No React Router, AG Grid, Bootstrap, axios, SweetAlert, or `localStorage` inside
this module.
