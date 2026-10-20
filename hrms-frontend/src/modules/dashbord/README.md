# Dashboard module (`dashbord`)

Self-contained EAOVA HRMS dashboard surface for persona-aware KPI review,
attendance trends, schedule planning, and the employee project list.

## Folder spelling

The directory is intentionally named **`dashbord`** (not `dashboard`). Keep
imports aligned with this path when integrating the module.

```ts
import {
  DashboardModule,
  MOCK_DASHBOARD_DATA,
  type DashboardModuleProps,
} from "./modules/dashbord";
```

## Helper libraries

| Package | Required | Purpose |
| --- | --- | --- |
| `react` / `react-dom` | Yes | Module UI |
| `recharts` | Yes | Responsive attendance trend chart |

Schedule event types, fixtures, and date helpers are imported from the public
[`../schedule`](../schedule) module barrel (not defined locally).

No AG Grid, Chart.js, React Calendar, or UI kits are used.

Install peer helpers in the host app:

```bash
npm install react react-dom recharts
```

## Public interfaces

### `DashboardModule`

Root React component. Mount it anywhere a dashboard overview is needed.

### `DashboardRole`

Alias of shared `HrmsRole` from `eaova-edited-ui/src/shared/`. Seven roles:

`SUPERADMIN` · `ADMIN` · `HR` · `ACCOUNTANT` · `IMMIGRATION` · `ONBOARDING` · `EMPLOYEE`

### `DashboardTheme`

Alias of shared `AppTheme` (`"light" | "dark"`).

### `DashboardDestination`

`"/Company" | "/Clients" | "/Vendors" | "/projects" | "/employees" | "/Revenue"`

### `DashboardData`

Complete data contract:

- `metrics` — count totals/active values for organization KPIs
- `attendance` — daily present / absent / on-leave points
- `schedule` — calendar events
- `employeeProjects` — employee project rows
- `invoices` — revenue source rows (summed for the Revenue KPI)

### `DashboardModuleProps`

| Prop | Behavior |
| --- | --- |
| `role` | Controlled role. When omitted, role is managed locally. |
| `defaultRole` | Initial uncontrolled role. Default: `ADMIN`. |
| `theme` | Controlled theme. When omitted, theme is managed locally. |
| `defaultTheme` | Initial uncontrolled theme. Default: `light`. |
| `data` | Optional full data override. Default: internal mock fixtures. |
| `enabledModules` | When set, KPI cards for disabled destination modules are omitted. |
| `onRoleChange` | Fired when the mock persona changes. |
| `onThemeChange` | Fired when light/dark is toggled. |
| `onNavigate` | Fired with `(destination, metric)` when a KPI card is activated. |

Role and theme are **not persisted** (no `localStorage` / cookies).

In the preview host, the theme toggle lives in the **sidebar footer** (sun in
light mode, moon in dark mode) and themes the entire application. Pass
`theme` / `onThemeChange` into `DashboardModule` so the module stays in sync.

## Controlled vs uncontrolled

```tsx
// Uncontrolled (module owns role + theme; defaults ADMIN / light)
<DashboardModule />

// Controlled by host
<DashboardModule
  role={role}
  theme={theme}
  onRoleChange={setRole}
  onThemeChange={setTheme}
/>
```

## KPI navigation

When `onNavigate` is provided, KPI cards render as buttons and emit the
documented `DashboardDestination` for that metric.

Without `onNavigate`, cards render as non-interactive summaries (no dead
buttons).

```tsx
<DashboardModule
  onNavigate={(destination, metric) => {
    navigate(destination);
    // metric is "company" | "clients" | ... | "revenue"
  }}
/>
```

## Replacing mock data

Pass a complete `DashboardData` object via `data` to replace
`MOCK_DASHBOARD_DATA`. Keep the same field shapes so selectors and surfaces
continue to work.

```tsx
import { DashboardModule, type DashboardData } from "./modules/dashbord";

const liveData: DashboardData = await loadDashboardData();

<DashboardModule data={liveData} role={sessionRole} />;
```

## Theme tokens

Styling is Tailwind utilities in the components (shared panel classes live in
`uiClasses.ts`). The `--dashboard-*` variables in `src/styles/tokens.ts`
cover surface, text, border, accent, success, warning, and chart colors, and are
exposed to Tailwind as `*-dashboard-*` colors in `src/index.css`. There are no
purple tokens. Strong contrast is reserved for text and focus rings.
