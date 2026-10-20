import { cx, workspaceParts, workspaceUi } from "@/shared/ui/workspaceUi";

export { cx };

const { btn, btnSize, btnCompact, card } = workspaceParts;

const PRIMARY =
  "border-app-accent bg-app-accent text-white [[data-theme=dark]_&]:text-[color:var(--ds-on-accent)]";
const HOVER_CARD =
  "cursor-pointer hover:border-app-accent hover:bg-app-accent-soft";
const CONTROL =
  "min-h-[2.35rem] w-full rounded-[0.45rem] border border-app-border bg-app-canvas px-[0.65rem] py-[0.45rem] text-app-text";

const KPI_BOX = `m-0 text-left text-inherit ${card}`;
const KPI = `${KPI_BOX} flex flex-col items-start justify-start px-[0.65rem] py-[0.5rem]`;
const KPI_VALUE = "m-0 text-[1.05rem] leading-[1.15]";

const LINK =
  "cursor-pointer p-0 text-left font-semibold [background:none] [border:0]";

export const revenueUi = {
  root: `${workspaceParts.root} p-[1rem]`,
  eyebrow:
    "mx-0 mt-0 mb-[0.25rem] text-[0.8rem] uppercase tracking-[0.04em] text-app-muted",
  error: workspaceUi.error,
  muted: workspaceUi.muted,
  notice: workspaceUi.notice,
  noticeText: workspaceUi.noticeText,
  empty: workspaceUi.empty,
  directory: "grid gap-[0.75rem]",
  srOnly: workspaceUi.srOnly,

  kpis: "grid gap-0",
  kpisMain:
    "grid grid-cols-[minmax(0,1fr)_minmax(13.5rem,16.5rem)] items-stretch gap-[0.65rem] [@media(max-width:56rem)]:grid-cols-[1fr]",
  kpisPrimary: "grid min-w-0 [align-content:start] gap-[0.55rem]",
  kpiGrid:
    "m-0 grid min-w-0 list-none grid-cols-[repeat(3,minmax(0,1fr))] gap-[0.45rem] p-0 [@media(max-width:64rem)_and_(not_(max-width:36rem))]:grid-cols-[repeat(2,minmax(0,1fr))] [@media(max-width:36rem)]:grid-cols-[1fr]",
  kpi: KPI,
  kpiInteractive: `${KPI} ${HOVER_CARD}`,
  kpiHero: `${KPI_BOX} flex flex-row items-center justify-between gap-[0.75rem] px-[0.85rem] py-[0.6rem] [@media(max-width:36rem)]:flex-col [@media(max-width:36rem)]:items-start`,
  kpiHeroCopy: "grid min-w-0 gap-[0.1rem]",
  kpiLabel:
    "mx-0 mt-0 mb-[0.15rem] text-[0.72rem] font-semibold tracking-[0.02em] text-app-muted",
  kpiValue: `${KPI_VALUE} font-bold`,
  kpiValueCritical: `${KPI_VALUE} font-semibold text-module-critical`,
  kpiValueHero:
    "m-0 whitespace-nowrap text-[1.35rem] font-bold leading-[1.1]",
  kpiHint: "m-0 text-[0.72rem] text-app-muted",

  highlights:
    "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-[0.45rem] [@media(max-width:36rem)]:grid-cols-[1fr]",
  highlight: `grid gap-[0.15rem] px-[0.7rem] py-[0.55rem] text-left text-inherit ${card} ${HOVER_CARD}`,
  highlightEyebrow:
    "text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-app-muted",
  highlightName: "text-[0.9rem] font-bold [overflow-wrap:anywhere]",
  highlightValue: "text-[0.95rem] font-bold text-app-accent",

  breakdown: `flex h-full min-w-0 flex-col p-[0.7rem_0.85rem_0.55rem] ${card} [@media(max-width:56rem)]:h-auto`,
  breakdownTitle: "m-0 text-[0.85rem] font-bold",
  breakdownChart:
    "mt-[0.15rem] min-h-[11.75rem] w-full flex-[1_1_auto] [@media(max-width:56rem)]:min-h-[12.5rem]",
  breakdownLegend: "text-[0.75rem] text-app-text",
  breakdownEmpty: "mx-0 mt-[0.75rem] mb-0 text-[0.85rem] text-app-muted",

  viewToggle: "inline-flex gap-[0.4rem]",
  btnGhost: workspaceUi.btnGhost,
  btnGhostCompact: workspaceUi.btnGhostCompact,
  btnPrimary: `${btn} ${btnSize} ${PRIMARY}`,
  btnPrimaryCompact: `${btn} ${btnCompact} ${PRIMARY}`,
  iconBtn: `${workspaceUi.iconBtn} disabled:cursor-not-allowed disabled:opacity-55`,

  link: `${LINK} text-app-accent`,
  linkCritical: `${LINK} text-module-critical`,
  amountCritical: "font-semibold text-module-critical",

  cardGrid:
    "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-[0.75rem] p-0",
  card: `relative grid w-full gap-[0.3rem] overflow-visible px-[1rem] py-[0.9rem] text-left text-inherit ${card} ${HOVER_CARD}`,
  cardName: "font-bold",
  cardValue: "text-[1.15rem] font-bold text-app-accent",
  cardMeta: "text-[0.8rem] text-app-muted",

  tableWrap: workspaceUi.tableWrap,
  table: workspaceUi.table,
  overlay: workspaceUi.overlay,
  dialog: workspaceUi.dialog,
  dialogWide: `${workspaceParts.dialog} w-[min(42rem,100%)]`,
  dialogHeader:
    "mb-[0.85rem] flex flex-wrap items-start justify-between gap-[0.75rem]",
  dialogTitle: "m-0 text-[1.25rem]",
  dialogHero:
    "mx-0 mt-0 mb-[0.85rem] text-[1.45rem] font-bold text-app-accent",
  metricGrid:
    "grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-[0.65rem]",
  metric:
    "m-0 rounded-[0.5rem] border border-app-border bg-app-raised px-[0.8rem] py-[0.7rem]",

  form: "grid gap-[0.75rem]",
  field: "grid min-w-0 grid-rows-[auto_auto] [align-content:start] gap-[0.3rem]",
  fieldLabel: workspaceUi.fieldLabel,
  input: CONTROL,
  formActions: workspaceUi.formActions,
} as const;
