import { cx, workspaceParts, workspaceUi } from "@/shared/ui/workspaceUi";

export { cx };

const { card } = workspaceParts;

const ON_ACCENT =
  "text-white [[data-theme=dark]_&]:text-[color:var(--ds-on-accent)]";
const REDUCED_MOTION =
  "motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]!";

const NAV_BTN =
  "min-h-[1.85rem] cursor-pointer rounded-[0.35rem] border border-app-border bg-app-raised font-semibold text-app-text hover:border-app-accent";
const CELL = "p-[0.12rem] text-center align-middle";
const DAY =
  "relative grid aspect-square min-h-[2.04rem] w-full cursor-pointer place-items-center rounded-[0.38rem] border p-0 text-[0.78rem] font-semibold text-app-text [transition:background-color_0.15s_ease,border-color_0.15s_ease] hover:border-app-border hover:bg-app-raised [@media(max-width:40rem)]:min-h-[2.25rem]";
const EVENT_CARD = "rounded-[0.5rem] border px-[0.85rem] py-[0.75rem]";
const BTN =
  "min-h-[2.25rem] cursor-pointer rounded-[0.45rem] border px-[0.9rem] py-[0.4rem] font-semibold";
/** `!` where AppCheckbox's own utilities set the same property. */
const KIND_OPTION =
  "gap-[0.35rem]! min-h-[2.1rem]! rounded-[999px] border px-[0.7rem] py-[0.25rem] text-[0.88rem]! font-semibold!";

export const scheduleUi = {
  root: `${workspaceParts.root} flex min-w-0 flex-col gap-[1rem] p-[1.25rem] [@media(max-width:40rem)]:p-[0.9rem] ${REDUCED_MOTION}`,
  srOnly: workspaceUi.srOnly,

  header: "flex flex-wrap items-start justify-between gap-[0.85rem_1.25rem]",
  headerPrimary: "flex min-w-0 flex-wrap items-center gap-[0.75rem_1rem]",
  title: "m-0 text-[1.35rem] font-[650] [overflow-wrap:anywhere]",
  scope: "mx-0 mt-[0.2rem] mb-0 text-[0.82rem] font-semibold text-app-muted",
  switcher:
    "inline-flex flex-wrap gap-[0.35rem] rounded-[999px] border border-app-border bg-app-surface p-[0.3rem]",
  tab: workspaceUi.tab,
  tabActive: workspaceUi.tabActive,
  formError:
    "m-0 text-[0.9rem] text-[#b42318] [[data-theme=dark]_&]:text-[#f97066]",

  createBtn: `inline-flex size-[2.25rem] shrink-0 cursor-pointer items-center justify-center rounded-[999px] border border-app-accent bg-app-accent p-0 leading-[0] ${ON_ACCENT} hover:[filter:brightness(1.08)]`,
  createIcon: "block size-[0.95rem]",
  kindFilters: "m-0 min-w-0 p-0 [border:0]",
  kindOptions: "flex flex-wrap gap-[0.35rem]",
  kindOption: `${KIND_OPTION} border-app-border bg-app-surface`,
  kindOptionActive: `${KIND_OPTION} border-[color:color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-app-accent-soft text-app-accent!`,

  calendarLayout: `grid min-w-0 grid-cols-[minmax(0,0.935fr)_minmax(0,1.065fr)] gap-[1rem] p-[1rem] ${card} [@media(max-width:52rem)]:grid-cols-[1fr]`,
  calendarPanel: "min-w-0",
  calendar: "w-[85%] max-w-full [@media(max-width:52rem)]:w-full",
  toolbar: "mb-[0.5rem] flex flex-wrap items-center justify-between gap-[0.4rem]",
  monthLabel: "m-0 text-[0.95rem] font-bold [overflow-wrap:anywhere]",
  toolbarNav: "flex flex-wrap gap-[0.2rem]",
  navBtn: `${NAV_BTN} px-[0.5rem] py-[0.25rem] text-[0.78rem]`,
  navBtnIcon: `${NAV_BTN} inline-flex w-[1.85rem] items-center justify-center p-0 text-[0.95rem] leading-none`,
  calendarTable: "w-full table-fixed border-collapse",
  weekday:
    "px-0 py-[0.3rem] text-[0.68rem] font-bold uppercase tracking-[0.04em] text-app-muted",
  weekdayAbbr: "[text-decoration:none]",
  cell: CELL,
  cellEmpty: `${CELL} min-h-[2.04rem]`,
  day: `${DAY} border-transparent bg-transparent`,
  daySelected: `${DAY} border-app-accent bg-app-accent-soft`,
  dayToday: "[box-shadow:inset_0_0_0_1px_var(--app-accent)]",
  eventMarker:
    "absolute bottom-[0.28rem] size-[0.28rem] rounded-[50%] bg-app-accent",

  dayAgenda: "min-w-0",
  sectionHeading:
    "mx-0 mt-0 mb-[0.7rem] text-[0.98rem] font-bold [overflow-wrap:anywhere]",
  empty: "m-0 text-[0.95rem] leading-[1.45] text-app-muted",
  eventList: "m-0 grid list-none gap-[0.65rem] p-0",
  eventCard: `${EVENT_CARD} border-app-border bg-app-raised`,
  eventCardSelected: `${EVENT_CARD} border-app-accent bg-app-accent-soft`,
  eventCardHeader: "grid min-w-0 gap-[0.35rem]",
  eventTitleButton:
    "block w-full cursor-pointer bg-transparent p-0 text-left text-inherit [border:0]",
  eventTitle:
    "m-0 text-[0.95rem] font-[650] leading-[1.35] [overflow-wrap:anywhere]",
  eventMeta:
    "m-0 flex flex-wrap gap-[0.45rem_0.75rem] text-[0.82rem] text-app-muted",
  eventKind: "font-bold text-app-accent",
  eventTime: "[overflow-wrap:anywhere]",

  agendaView: `grid min-w-0 gap-[1rem] p-[1rem] ${card}`,
  agendaRange: "flex flex-wrap gap-[0.75rem_1rem]",
  agendaGroups: "grid gap-[1.15rem]",
  agendaGroup: "min-w-0",
  field: "grid min-w-0 gap-[0.3rem]",
  fieldLabel: "text-[0.8rem] font-bold text-app-muted",
  fieldRow:
    "grid grid-cols-[1fr_1fr] gap-[0.75rem] [@media(max-width:40rem)]:grid-cols-[1fr]",
  fieldInput:
    "min-h-[2.25rem] w-full rounded-[0.45rem] border border-app-border bg-app-surface px-[0.65rem] py-[0.4rem] text-app-text [font:inherit]",

  overlay: workspaceUi.overlay,
  dialog:
    "max-h-[min(90vh,44rem)] w-[min(28rem,100%)] overflow-auto rounded-[0.75rem] border border-app-border bg-app-surface px-[1.1rem] py-[1rem] text-app-text [box-shadow:0_12px_32px_rgba(0,0,0,0.18)] [[data-theme=dark]_&]:[box-shadow:0_12px_32px_rgba(0,0,0,0.45)]",
  dialogHeader: "mb-[0.85rem] flex items-start justify-between gap-[0.75rem]",
  dialogTitle:
    "m-0 text-[1.1rem] font-[650] leading-[1.35] [overflow-wrap:anywhere]",
  iconBtn:
    "inline-flex size-[2.1rem] shrink-0 cursor-pointer items-center justify-center rounded-[0.45rem] border border-app-border bg-transparent text-[1.25rem] leading-none text-app-text hover:bg-app-raised",
  detailsList: "m-0 grid gap-[0.65rem]",
  detailsItem: "min-w-0",
  detailsTerm: "m-0 text-[0.8rem] font-bold text-app-muted",
  detailsValue: "mx-0 mt-[0.15rem] mb-0 [overflow-wrap:anywhere]",
  createForm: "grid gap-[0.85rem]",
  formActions: "mt-[0.25rem] flex flex-wrap justify-end gap-[0.5rem]",
  btnGhost: `${BTN} border-app-border bg-transparent text-app-text hover:bg-app-raised`,
  btnPrimary: `${BTN} border-app-accent bg-app-accent ${ON_ACCENT} hover:[filter:brightness(1.08)]`,
} as const;

export function calendarDayClass(selected: boolean, today: boolean): string {
  return cx(
    selected ? scheduleUi.daySelected : scheduleUi.day,
    today && !selected && scheduleUi.dayToday,
  );
}
