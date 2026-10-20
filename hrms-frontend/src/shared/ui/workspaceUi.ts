/**
 * Tailwind classes shared by the record-workspace modules (payrolls, billing,
 * vendors, revenue, schedule, onboarding): bordered module root, filter panels, fields, buttons,
 * dialogs, and detail cards.
 */
import { zClass } from "@/ui/zIndex";

export { cx } from "./cx";

const BTN =
  "inline-flex cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.45rem] border disabled:cursor-not-allowed disabled:opacity-55";
const BTN_SIZE = "min-h-[2.35rem] px-[0.85rem] py-[0.4rem]";
const BTN_COMPACT = "min-h-[1.9rem] px-[0.55rem] py-[0.25rem] text-[0.85rem]";
const GHOST = "border-app-border bg-transparent text-app-text";
const ACCENT =
  "border-transparent bg-app-accent text-white [[data-theme=dark]_&]:text-[color:var(--ds-on-accent)]";
const PRIMARY = `${ACCENT} font-bold [box-shadow:0_1px_2px_rgba(15,23,42,0.12)]`;
const TAB =
  "min-h-[2.1rem] cursor-pointer rounded-[999px] px-[0.9rem] py-[0.3rem] font-semibold [border:0]";
const DANGER = "border-transparent bg-module-critical text-white";

/** Inputs and selects nested anywhere inside a field or form. */
const NESTED_CONTROLS =
  "[&_:is(input,select)]:min-h-[2.35rem] [&_:is(input,select)]:w-full [&_:is(input,select)]:rounded-[0.45rem] [&_:is(input,select)]:border [&_:is(input,select)]:border-app-border [&_:is(input,select)]:bg-app-canvas [&_:is(input,select)]:px-[0.65rem] [&_:is(input,select)]:py-[0.45rem] [&_:is(input,select)]:text-app-text [&_:is(input,select):disabled]:cursor-not-allowed [&_:is(input,select):disabled]:opacity-70";

const CARD = "rounded-[0.65rem] border border-app-border bg-app-surface";
const ROOT =
  "w-full rounded-[0.85rem] border border-app-border bg-app-canvas font-['Segoe_UI','Source_Sans_3',system-ui,sans-serif] text-app-text [&_:focus-visible]:[outline-width:2px]!";
const DIALOG =
  "max-h-[min(90vh,44rem)] overflow-auto rounded-[0.75rem] border border-app-border bg-app-surface p-[1rem_1.1rem_1.15rem] text-app-text [box-shadow:0_18px_40px_rgba(0,0,0,0.18)]";

/** Building blocks for modules whose padding, widths, or button colors differ. */
export const workspaceParts = {
  root: ROOT,
  btn: BTN,
  btnSize: BTN_SIZE,
  btnCompact: BTN_COMPACT,
  card: CARD,
  dialog: DIALOG,
} as const;

export const workspaceUi = {
  root: `${ROOT} p-[1.25rem]`,
  error: "mx-0 mt-0 mb-[0.85rem] text-module-critical",
  muted: "text-app-muted",
  srOnly:
    "absolute -m-px size-px overflow-hidden whitespace-nowrap p-0 [clip:rect(0,0,0,0)] [border:0]",
  notice:
    "mb-[1rem] flex flex-wrap items-center justify-between gap-[0.65rem] rounded-[0.65rem] border border-app-border bg-app-accent-soft px-[0.85rem] py-[0.7rem]",
  noticeText: "m-0",
  directory: "grid gap-[0.9rem]",
  /** Pill tabs inside a rounded switcher. */
  tab: `${TAB} bg-transparent text-app-text`,
  tabActive: `${TAB} bg-app-accent text-white [[data-theme=dark]_&]:text-[color:var(--ds-on-accent)]`,
  toolbar: "flex flex-wrap items-end justify-between gap-[0.7rem]",
  filters:
    "grid min-w-[min(100%,22rem)] flex-1 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-[0.75rem] rounded-[0.65rem] border border-app-border bg-app-raised px-[0.9rem] py-[0.75rem]",
  field: `grid min-w-0 grid-rows-[auto_auto_auto] [align-content:start] gap-[0.3rem] ${NESTED_CONTROLS}`,
  fieldLabel: "text-[0.8rem] font-semibold leading-[1.25] text-app-text",
  fieldHint: "text-[0.75rem] leading-[1.35] text-app-muted",
  btnGhost: `${BTN} ${BTN_SIZE} ${GHOST}`,
  btnGhostCompact: `${BTN} ${BTN_COMPACT} ${GHOST}`,
  btnPrimary: `${BTN} min-h-[2.45rem] px-[1rem] py-[0.4rem] text-[0.88rem] ${PRIMARY}`,
  btnPrimaryCompact: `${BTN} ${BTN_COMPACT} ${PRIMARY}`,
  /** Primary colors at the base size, without the bold weight and shadow. */
  btnAccent: `${BTN} ${BTN_SIZE} ${ACCENT}`,
  btnAccentCompact: `${BTN} ${BTN_COMPACT} ${ACCENT}`,
  btnDanger: `${BTN} ${BTN_SIZE} ${DANGER}`,
  btnDangerCompact: `${BTN} ${BTN_COMPACT} ${DANGER}`,
  iconBtn:
    "inline-flex size-[2rem] cursor-pointer items-center justify-center rounded-[0.4rem] border border-app-border bg-transparent text-app-text",
  empty: `m-0 px-[1rem] py-[2.5rem] ${CARD}`,
  tableWrap: `overflow-x-auto ${CARD}`,
  table: "w-full border-collapse text-[0.84rem]",
  th: "whitespace-nowrap border-b border-b-app-border bg-app-raised px-[0.65rem] py-[0.35rem] text-left align-middle font-semibold text-app-muted",
  td: "whitespace-nowrap border-b border-b-app-border px-[0.65rem] py-[0.35rem] text-left align-middle",
  /** Prefixed blur only: Chromium ignores it, so the backdrop blurs in WebKit alone. */
  overlay:
    `fixed inset-0 ${zClass.modal} grid place-items-center bg-[rgba(15,23,42,0.48)] p-[1rem] [-webkit-backdrop-filter:blur(6px)]`,
  dialog: `${DIALOG} w-[min(28rem,100%)]`,
  formPage: "grid gap-[1rem]",
  formPageHeader: "flex flex-wrap items-center gap-[0.75rem]",
  formPageTitle: "m-0 text-[1.25rem]",
  formCard: `px-[1rem] py-[0.85rem] ${CARD}`,
  form: `grid gap-[0.75rem] ${NESTED_CONTROLS}`,
  formSection:
    "m-0 grid gap-[0.65rem] rounded-[0.5rem] border border-app-border px-[0.85rem] py-[0.75rem]",
  formLegend: "px-[0.25rem] py-0 text-[0.8rem] font-semibold text-app-muted",
  formActions: "mt-[0.35rem] flex justify-end gap-[0.55rem]",
  details: "grid gap-[1rem]",
  detailsHeader: "flex flex-wrap items-center gap-[0.75rem]",
  detailsTitle: "m-0 text-[1.25rem]",
  detailsCard: `px-[1rem] py-[0.85rem] ${CARD}`,
  detailsCardTitle: "mx-0 mt-0 mb-[0.65rem] text-[1.05rem]",
  detailsCardText: "mx-0 mt-0 mb-[0.45rem]",
  status:
    "inline-flex rounded-[999px] px-[0.4rem] py-[0.1rem] text-[0.72rem] font-semibold",
  statusActive: "bg-[rgba(21,128,61,0.12)] text-module-success",
  statusInactive: "bg-[rgba(185,28,28,0.12)] text-module-critical",
  statusPending: "bg-[rgba(180,83,9,0.12)] text-module-warning",
} as const;
