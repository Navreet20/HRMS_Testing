# Schedule module

Calendar and Agenda for EAOVA HRMS. Mock-backed v1 with original
scoped UI — no legacy EAOVA markup, assets, or calendar/router packages.

Mounted from `eaova-edited-ui/src/App.tsx` when Full SKU enables `schedule`.

## Entitlement and access policy

- **SKU:** Full only (`schedule` in `SKU_MODULES.full`)
- **Roles:** All nine HRMS roles can open Schedule when Full is enabled
- **Mutations:** `ADMIN` and `HR` can create events (session-local via
  `readOnly={false}`); other roles remain read-only. No edit/delete yet.
- Sidebar item comes from the normal entitlement module path (not a placeholder)

Non-Full SKUs never list Schedule. A Schedule path under those packages
normalizes to the entitled landing module.

## Routes

| Path | View |
| --- | --- |
| `/schedule` | Calendar |
| `/schedule/agenda` | Agenda |

Invalid Schedule tails (for example `/schedule/foo`) normalize to Calendar.
Path sync is owned by the App shell — the module never assigns `window.location`.

## Public props and types

Mount via `ScheduleModule` (see `index.ts` for re-exports).

```ts
interface ScheduleModuleProps {
  data?: ScheduleModuleData;       // optional complete override; default MOCK_SCHEDULE_DATA
  theme?: AppTheme;                // controlled "light" | "dark"
  defaultTheme?: AppTheme;         // uncontrolled initial theme
  initialView?: ScheduleView;      // "calendar" | "agenda" (shell-controlled)
  onViewChange?: (view: ScheduleView) => void;
  onNavigate?: (destination: ScheduleDestination) => void;
}

type ScheduleView = "calendar" | "agenda";
type ScheduleEventKind = "meeting" | "deadline" | "leave" | "reminder";
type ScheduleDestination = "/schedule" | "/schedule/agenda" | "/dashboard";

interface ScheduleEvent {
  id: string;
  title: string;
  date: string;        // YYYY-MM-DD local calendar
  startTime: string;
  endTime?: string;
  kind: ScheduleEventKind;
}

interface ScheduleModuleData {
  events: readonly ScheduleEvent[];
}
```

### Controlled view behavior

`initialView` is shell-controlled. When the App changes it (deep link or
in-module tab via `onViewChange` → `navigateTo`), the module syncs through a
`useEffect` on `initialView`. The module calls `onNavigate` with
`/schedule` or `/schedule/agenda` so the shell can update the path; it does
not write `window.location` itself.

### Mock override example

```tsx
import {
  ScheduleModule,
  MOCK_SCHEDULE_DATA,
  type ScheduleModuleData,
} from "./modules/schedule";

const customData: ScheduleModuleData = {
  events: [
    {
      id: "demo-1",
      title: "Ops sync",
      date: "2026-07-27",
      startTime: "09:30",
      endTime: "10:15",
      kind: "meeting",
    },
  ],
};

<ScheduleModule
  theme={theme}
  initialView="calendar"
  data={customData}
  // or data={MOCK_SCHEDULE_DATA}
  onViewChange={(view) => {
    /* shell navigates with replace */
  }}
/>
```

## Views

- **Calendar** — month grid, Previous / Today / Next, selected-day agenda,
  search + kind filters, read-only event details dialog
- **Agenda** — start/end date range grouped by day, same filters, shared details

Event kinds use text labels (Meeting, Deadline, Leave, Reminder), not color alone.

## Persistence

Schedule v1 does not use `localStorage`, `sessionStorage`, cookies, or
any backend write path. Created events (ADMIN/HR) and other UI state
(selected day, filters, open dialog) live only in React state and are
discarded on unmount.

## Deferred backend / product work

Not in v1 — needs product, access-policy, and API contracts first:

- persist create/edit/delete/cancel events to a Schedule API
- recurring events; all-day and multi-timezone semantics
- employee shifts / shift assignment
- attendees, invitations, RSVP, meeting links, notifications
- overlap / conflict enforcement
- private / team / department / company visibility
- live sync from Leaves, Holidays, Projects, Payrolls, or Attendance
- Google, Outlook, or other external calendars
- Schedule REST API, entities, and persistence

`@nestjs/schedule` in the backend is cron infrastructure, not a business
Schedule API.

## Notes

- Tailwind classes live in `uiClasses.ts`; `data-theme` on the root switches light/dark
- Dashboard compact schedule imports the same public Schedule contract/data
- No `react-router`, `react-calendar`, `axios`, or `eaova-ui` imports
- Tests: `eaova-edited-ui/test/schedule/` and `eaova-edited-ui/test/app/scheduleIntegration.test.tsx`
