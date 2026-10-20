import { workspaceUi } from "@/shared/ui/workspaceUi";
import { zClass } from "@/ui/zIndex";

export { cx } from "@/shared/ui/workspaceUi";

const FONT = "font-['Segoe_UI','Source_Sans_3',system-ui,sans-serif]";

/** Inputs, selects, and textareas nested in a projects field or form. */
const FIELD_CONTROLS = [
  "[&_:is(input,select,textarea)]:w-full",
  "[&_:is(input,select)]:min-h-[2.35rem]",
  "[&_:is(input,select,textarea)]:px-[0.65rem]",
  "[&_:is(input,select,textarea)]:py-[0.45rem]",
  "[&_:is(input,select,textarea)]:text-app-text",
  "[&_:is(input,select,textarea)]:bg-app-canvas",
  "[&_:is(input,select,textarea)]:border",
  "[&_:is(input,select,textarea)]:border-app-border",
  "[&_:is(input,select,textarea)]:rounded-[0.45rem]",
  "[&_:is(input,select,textarea):disabled]:cursor-not-allowed",
  "[&_:is(input,select,textarea):disabled]:opacity-100",
  "[&_:is(input,select,textarea):disabled]:[-webkit-text-fill-color:var(--app-text)]",
  "[&_:is(input,textarea):read-only]:cursor-default",
  "[&_:is(input,textarea):read-only]:opacity-100",
  "[&_:is(input,textarea):read-only]:[-webkit-text-fill-color:var(--app-text)]",
  "[&_textarea]:min-h-[4.5rem]",
  "[&_textarea]:resize-y",
].join(" ");

const FIELD = `grid min-w-0 grid-rows-[auto_auto_auto] [align-content:start] gap-[0.3rem] ${FIELD_CONTROLS}`;
const PANEL = "rounded-[0.65rem] border border-app-border bg-app-surface";
const STATUS =
  "inline-flex rounded-[999px] px-[0.4rem] py-[0.1rem] text-[0.72rem] font-semibold";

/* Allocation / stakeholder tables. */
const INLINE_CELL =
  "min-w-0 border-b border-b-app-border bg-app-surface p-[0.5rem_0.55rem]! align-middle leading-[1.375] text-app-text whitespace-nowrap [overflow-wrap:anywhere] [word-break:break-word] [tr:last-child>&]:[border-bottom:none]";
/** Compact kebab column; widens while the inline editor shows Cancel + Update. */
const ACTIONS_WIDTH =
  "box-border w-[4.5rem]! min-w-[4.5rem]! max-w-[4.5rem]! group-data-[editing=true]/tablewrap:w-[11rem]! group-data-[editing=true]/tablewrap:min-w-[11rem]! group-data-[editing=true]/tablewrap:max-w-[11rem]!";
const LOCATION = "flex min-w-0 max-w-full flex-col gap-[0.08rem]";

/** Stakeholder inputs in the (portaled) add-project stakeholder cards. */
const STAKEHOLDER_INPUT =
  "box-border h-[2.35rem] min-h-[2.35rem] w-full rounded-[0.45rem] border! border-[#737373]! bg-app-surface px-[0.65rem] py-0 text-[0.9rem] font-normal leading-[2.35rem] text-app-text [font-family:inherit] placeholder:font-normal placeholder:text-app-muted placeholder:opacity-100 placeholder:[-webkit-text-fill-color:var(--app-text-muted)]";

export const projectsUi = {
  ...workspaceUi,
  root: `box-border w-full rounded-none bg-transparent p-0 text-app-text [border:0] ${FONT} [&_*::before]:box-border [&_*::after]:box-border [&_:focus-visible]:[outline-width:2px]!`,
  notice:
    "flex flex-wrap items-center justify-between gap-[0.65rem] rounded-[0.65rem] border border-app-border bg-app-accent-soft px-[0.85rem] py-[0.7rem]",
  overlay: `fixed inset-0 ${zClass.modal} grid place-items-center bg-[rgba(15,23,42,0.48)] p-[1rem] backdrop-blur-[6px]`,

  field: FIELD,
  fieldWide: `${FIELD} [grid-column:1/-1]`,
  form: `grid gap-[0.75rem] ${FIELD_CONTROLS}`,
  formCard: `grid gap-[0.75rem] px-[1rem] py-[0.85rem] ${PANEL} ${FIELD_CONTROLS}`,
  eyebrow: "mx-0 mb-[0.25rem] mt-0 text-[0.8rem] uppercase tracking-[0.04em] text-app-muted",
  deptNotice:
    "rounded-[0.5rem] border border-app-border bg-app-accent-soft px-[0.75rem] py-[0.55rem] text-[0.84rem] [&_p]:m-0",

  status: STATUS,
  statusTone: {
    active: `${STATUS} bg-[rgba(21,128,61,0.12)] text-module-success`,
    inactive: `${STATUS} bg-[rgba(185,28,28,0.12)] text-module-critical`,
    ended: `${STATUS} bg-[rgba(63,63,63,0.1)] text-app-muted`,
    lead: `${STATUS} bg-app-accent-soft text-app-accent`,
  } as Readonly<Record<string, string>>,
  statusDefault: `${STATUS} bg-app-accent-soft text-app-accent`,
  sortIconActive: "text-app-accent",

  staffing: "grid gap-[1rem]",
  staffingHeader: "flex flex-wrap items-center justify-between gap-[0.75rem]",
  staffingTitle: "m-0 text-[1.25rem]",
  staffingSummary: `grid gap-[0.35rem] px-[0.85rem] py-[0.75rem] ${PANEL} [&_p]:m-0`,
  staffingAdd: `flex flex-wrap items-end gap-[0.75rem] px-[0.85rem] py-[0.75rem] ${PANEL}`,
  staffingAddField: `${FIELD} min-w-[12rem] flex-1`,

  myList: "m-0 grid list-none gap-[0.55rem] p-0",
  myListItem: `flex flex-wrap items-center justify-between gap-[0.65rem] px-[0.85rem] py-[0.75rem] ${PANEL}`,
  myListName: "font-[650]",
  myListMeta: "text-[0.84rem] text-app-muted",

  pagination: "flex flex-wrap items-center justify-between gap-[0.75rem]",
  paginationSummary: "m-0 text-[0.88rem] text-app-muted",
  paginationControls: "flex items-center gap-[0.65rem]",

  /* Directory */
  activeFilters: "bg-[color-mix(in_srgb,var(--app-surface)_80%,transparent)]!",
  cardList: "grid gap-[0.55rem]",
  card: "relative m-0 flex w-full cursor-pointer items-start gap-[0.5rem] rounded-[0.55rem] border! border-app-border! bg-app-surface! py-[0.75rem] pl-[0.85rem] pr-[3.25rem] text-left text-app-text [font:inherit] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
  cardClickable:
    "group relative m-0 flex w-full cursor-pointer items-start gap-[0.5rem] overflow-visible rounded-[0.55rem] border! border-app-border! bg-app-surface! py-[0.75rem] pl-[0.85rem] pr-[3.25rem] text-left text-app-text [font:inherit] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))]!",
  cardActions: `absolute right-[0.55rem] top-[0.55rem] ${zClass.local} inline-flex items-center gap-[0.15rem] text-app-muted`,
  cardIconBtn: `pointer-events-auto relative ${zClass.localRaised} m-0 inline-grid size-[2rem] cursor-pointer place-items-center justify-center rounded-[0.4rem] border border-transparent bg-transparent p-0 text-[color:var(--app-edit-icon,#2563eb)] hover:border-transparent hover:bg-[var(--app-edit-icon-soft,rgba(37,99,235,0.1))] hover:text-[color:var(--app-edit-icon-hover,#1d4ed8)]`,

  /* Allocate resources + stakeholders */
  /** Search, select, and date controls take the dark outline; catalog controls keep their own. */
  allocateForm: `min-w-0 max-w-full [--create-project-control-border:#737373] [&_:is(button[aria-haspopup=listbox],button[aria-haspopup=dialog],input[type=search][role=combobox]:not(.catalog-control))]:border! [&_:is(button[aria-haspopup=listbox],button[aria-haspopup=dialog],input[type=search][role=combobox]:not(.catalog-control))]:border-[#737373]! [&_:is(button[aria-haspopup=listbox]:hover,button[aria-haspopup=listbox][aria-expanded=true],button[aria-haspopup=dialog]:hover,button[aria-haspopup=dialog][aria-expanded=true],button[aria-haspopup=dialog]:focus-visible,input[type=search][role=combobox]:not(.catalog-control):focus,input[type=search][role=combobox]:not(.catalog-control):focus-visible)]:border-app-accent!`,
  /** Modal header copy under the allocate dialog title. */
  allocateModalBody: "[div:has(>form>&)_header_p]:max-w-[42rem]",
  embedded:
    "min-w-0 max-w-full overflow-x-clip [&:has([data-menu-open=true])]:overflow-visible",
  tableTitle: "mx-0 mb-[0.65rem] mt-0 text-[0.95rem] font-bold",
  toolbar:
    "mx-0 mb-[0.55rem] mt-0 flex min-w-0 max-w-full flex-wrap items-center justify-between gap-x-[0.75rem] gap-y-[0.5rem]",
  tableWrap:
    "group/tablewrap max-h-[calc(2.55rem+5*3.35rem)] w-full min-w-0 max-w-full overflow-auto rounded-[0.5rem] border border-app-border bg-app-surface [&:has([data-menu-open=true])]:overflow-visible",
  /** Fills the card; the inline column-sum width is overridden. */
  table:
    "w-full! min-w-full! max-w-full table-fixed border-collapse text-[0.875rem] leading-[1.375] text-app-text",
  employeeName: "font-semibold text-app-text",
  employeeDesignation:
    "mt-[0.15rem] block text-[0.78rem] font-medium leading-[1.3] text-app-muted whitespace-normal",
  location: LOCATION,
  locationEmpty: `${LOCATION} text-app-muted`,
  locationLine: "block truncate",
  locationLineMuted: "block truncate text-[0.72rem] text-app-muted",

  /** Inline editor cell; its controls use the compact 2rem chrome. */
  inlineCell: `${INLINE_CELL} max-w-0 text-left [&_.catalog-control]:w-full [&_.catalog-control]:min-w-0 [&_.catalog-control]:max-w-full [&_.catalog-control]:h-[2rem]! [&_.catalog-control]:min-h-[2rem]! [&_.catalog-control]:px-[0.35rem]! [&_.catalog-control]:py-[0.2rem]! [&_.catalog-control]:text-app-text! [&_.catalog-control]:text-[0.72rem]! [&_.catalog-control]:font-semibold! [&_.catalog-control]:leading-[1.25]! [&_.catalog-control]:rounded-[0.45rem]! [&_div:has(>input[type=search][role=combobox])]:max-w-full [&_input[type=search][role=combobox]:not(.catalog-control)]:box-border! [&_input[type=search][role=combobox]:not(.catalog-control)]:h-[2rem]! [&_input[type=search][role=combobox]:not(.catalog-control)]:min-h-[2rem]! [&_input[type=search][role=combobox]:not(.catalog-control)]:px-[0.35rem]! [&_input[type=search][role=combobox]:not(.catalog-control)]:py-[0.2rem]! [&_input[type=search][role=combobox]:not(.catalog-control)]:text-app-text! [&_input[type=search][role=combobox]:not(.catalog-control)]:text-[0.72rem]! [&_input[type=search][role=combobox]:not(.catalog-control)]:font-semibold! [&_input[type=search][role=combobox]:not(.catalog-control)]:leading-[1.25]! [&_input[type=search][role=combobox]:not(.catalog-control)]:bg-app-surface! [&_input[type=search][role=combobox]:not(.catalog-control)]:border! [&_input[type=search][role=combobox]:not(.catalog-control)]:border-[#737373]! [&_input[type=search][role=combobox]:not(.catalog-control)]:rounded-[0.45rem]!`,
  inlineActionsCell: `${INLINE_CELL} ${ACTIONS_WIDTH} text-right overflow-visible`,
  inlineClip:
    "box-border flex w-full min-w-0 max-w-full flex-col justify-center gap-[0.15rem] overflow-hidden [td:has([data-menu-open=true])_&]:overflow-visible",
  inlineError: "hidden",
  inlineErrors:
    "mt-[0.35rem] rounded-[0.5rem] border border-[color-mix(in_srgb,var(--ds-danger)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--ds-danger)_12%,var(--app-surface))] px-[0.5rem] py-[0.35rem] text-[0.75rem] text-[color:var(--ds-danger)] whitespace-normal",
  inlineReadonly: "pt-[0.45rem] text-[0.78rem] text-app-muted whitespace-normal",
  inlinePeriod:
    "flex w-full min-w-0 max-w-full flex-row items-center gap-[0.25rem] overflow-hidden [&_.app-date-field]:min-w-0 [&_.app-date-field]:max-w-full [&_.app-date-field]:flex-[1_1_0] [&_.app-date-field]:overflow-hidden [&_button[aria-haspopup=dialog]]:box-border! [&_button[aria-haspopup=dialog]]:w-full! [&_button[aria-haspopup=dialog]]:min-w-0! [&_button[aria-haspopup=dialog]]:h-[2rem]! [&_button[aria-haspopup=dialog]]:min-h-[2rem]! [&_button[aria-haspopup=dialog]]:px-[0.3rem]! [&_button[aria-haspopup=dialog]]:py-[0.2rem]! [&_button[aria-haspopup=dialog]]:text-app-text! [&_button[aria-haspopup=dialog]]:text-[0.72rem]! [&_button[aria-haspopup=dialog]]:font-semibold! [&_button[aria-haspopup=dialog]]:leading-[1.25]! [&_button[aria-haspopup=dialog]]:bg-app-surface! [&_button[aria-haspopup=dialog]]:border! [&_button[aria-haspopup=dialog]]:border-[#737373]! [&_button[aria-haspopup=dialog]]:rounded-[0.45rem]! [&_button[aria-haspopup=dialog]]:overflow-hidden! [&_button[aria-haspopup=dialog]>svg]:size-[0.85rem] [&_button[aria-haspopup=dialog]>svg]:shrink-0",
  inlinePeriodSep: "flex-none text-[0.72rem] font-semibold text-app-muted",
  /** `AppCheckbox` root: its shared rules lose on these properties. */
  inlineBillable:
    "gap-[0.35rem]! text-[0.78rem]! font-semibold! [&_input]:size-[0.95rem]! [&_input]:accent-[#2563eb]!",
  pctField: "relative flex w-full min-w-0 max-w-full items-center",
  pctSuffix:
    "pointer-events-none absolute right-[0.7rem] text-[0.88rem] font-semibold text-app-muted",
  inlineActions:
    "flex w-full flex-row flex-nowrap items-center justify-end gap-[0.45rem]",
  hint: "mx-0 mb-0 mt-[0.35rem] text-[0.78rem] leading-[1.35] text-app-muted",
  footer: "flex-wrap items-center justify-between! gap-3",

  /* Create / edit project form */
  createProjectForm: `[--create-project-control-border:#737373] [&_:is(button[aria-haspopup=listbox],button[aria-haspopup=dialog],input[type=search][role=combobox]:not(.catalog-control),[data-picker-control])]:border! [&_:is(button[aria-haspopup=listbox],button[aria-haspopup=dialog],input[type=search][role=combobox]:not(.catalog-control),[data-picker-control])]:border-[#737373]! [&_:is(button[aria-haspopup=listbox]:hover,button[aria-haspopup=listbox][aria-expanded=true],button[aria-haspopup=dialog]:hover,button[aria-haspopup=dialog][aria-expanded=true],button[aria-haspopup=dialog]:focus-visible,input[type=search][role=combobox]:not(.catalog-control):focus,input[type=search][role=combobox]:not(.catalog-control):focus-visible,[data-picker-control]:focus-within)]:border-app-accent! [&_[data-picker-control]_input]:appearance-none! [&_[data-picker-control]_input]:w-auto! [&_[data-picker-control]_input]:min-w-[1.25rem]! [&_[data-picker-control]_input]:max-w-full! [&_[data-picker-control]_input]:h-auto! [&_[data-picker-control]_input]:min-h-0! [&_[data-picker-control]_input]:m-0! [&_[data-picker-control]_input]:p-0! [&_[data-picker-control]_input]:[border:0]! [&_[data-picker-control]_input]:rounded-none! [&_[data-picker-control]_input]:bg-transparent! [&_[data-picker-control]_input]:[box-shadow:none]! [&_[data-picker-control]_input]:[outline:none]!`,
  addStakeholder: "m-0 border-0 bg-transparent p-0 text-[#0f766e]",
  stakeholderCard:
    "mb-2 grid gap-[0.65rem] rounded-[0.55rem] px-[0.85rem] py-[0.75rem]",
  stakeholderGrid:
    "grid grid-cols-1 [align-items:end] gap-x-[0.75rem] gap-y-[0.5rem] min-[40rem]:grid-cols-2",
  stakeholderField:
    "grid min-w-0 grid-rows-[auto_auto_auto] [align-content:start] gap-[0.3rem] [&>span:first-child]:text-[0.72rem] [&>span:first-child]:font-bold [&>span:first-child]:uppercase [&>span:first-child]:leading-[1.25] [&>span:first-child]:tracking-[0.04em] [&>span:first-child]:text-app-text",
  stakeholderInput: STAKEHOLDER_INPUT,
} as const;
