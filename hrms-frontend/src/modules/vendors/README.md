# Vendors Module

Self-contained HRMS vendor management module.

## Quick Start

```tsx
import { VendorsModule } from "./modules/vendors";

<VendorsModule />
```

## Architecture

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript types and interfaces |
| `constants.ts` | Configuration, role lists, geo data, EIN regex |
| `mockData.ts` | 7 sample vendors (1 INACTIVE) + employee links |
| `selectors.ts` | Pure functions: filtering, validation, permissions |
| `reducer.ts` | Immutable state machine (useReducer-compatible) |
| `VendorsModule.tsx` | Root component wiring state + UI |
| `VendorsModule.css` | Scoped styles (`.eaova-vendors-*`) |
| `index.ts` | Public barrel export |

## Views

Controlled via URL path or `initialView` prop:

- **directory** — Searchable, paginated vendor table
- **details** — Summary + MSA editor + linked employees table

## Directory Columns

Name | Type | Contact Name | EIN | Payment Method | Net Pay Term | Corporate State | Status | Actions

## Panel Sections

1. **Name and contact** — name*, type, contact name*, designation, EIN* (##-#######), net pay term*
2. **Corporate address** — Required full address
3. **Billing address** — "Same as corporate" checkbox; if unchecked, separate required address
4. **Payment** — type (ACH | Checks); ACH shows optional account/routing/bank/accountType; Checks shows optional addressType hint
5. **Additional contacts** — accountingteam | paymentteam | others

## Permissions

| Action | Requirement |
|--------|-------------|
| Create | `createAccess \|\| fullAccess` |
| View / Details | `viewAccess \|\| fullAccess` |
| Edit | `editAccess \|\| fullAccess` |
| Deactivate | `fullAccess` |

List access: all staff roles except EMPLOYEE.

No "Internal" vendor special-casing (unlike Clients).

## Reducer Actions

- `SET_VIEW` — Switch between directory / details
- `CREATE_VENDOR` — Add a new vendor record
- `UPDATE_VENDOR` — Patch an existing vendor
- `DEACTIVATE_VENDOR` — Soft deactivate ACTIVE → INACTIVE
- `UPDATE_MSA` — Set MSA start/end dates
- `REPLACE_DATA` — Full data replacement (for controlled mode)

## Validation

- EIN: `/^\d{2}-\d{7}$/`
- Both corporate and billing addresses required (billing copies from corporate when "Same as" is checked)
- Name, contactName required; duplicate active vendor names rejected
- MSA end must be after start
