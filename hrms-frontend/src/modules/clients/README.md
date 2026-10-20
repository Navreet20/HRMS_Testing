# Clients module

Self-contained EAOVA HRMS clients surface (directory, create/edit/view panel,
details with MSA + employees, soft-deactivate). Behavior follows legacy
`eaova-ui` Clients screens; visuals follow `BRANDING.md`.

## Status

Directory + definition panel + details (MSA/employees) + soft-deactivate.
Payments, nested company/project create, and local document uploads are not
ported.

## Policy

| Action | Gate |
| --- | --- |
| List | Staff roles; `EMPLOYEE` excluded |
| Create | `createAccess \|\| fullAccess` |
| View / details | `viewAccess \|\| fullAccess` |
| Edit | `editAccess \|\| fullAccess` |
| Deactivate | `fullAccess`; soft → `INACTIVE` |

Paths: `/clients` · `/clients/:clientId`

## Anti-patterns

No React Router, AG Grid, Bootstrap, axios, SweetAlert, or `localStorage`.
