import {
  modalBackdropClass,
  nestedModalBackdropClass,
} from "@/shared/ui/modalBackdrop";
import {
  EMPLOYEES_MODULE_ROOT,
  FIELD_CHROME,
  TOOLBAR_FIELD_CHROME,
} from "@/shared/ui/fieldChrome";
import { zClass } from "@/ui/zIndex";

export { cx } from "./cx";

/** Shared bordered + accent-focus chrome for catalog inputs and selects.
 * Disabled/read-only soft grey text: `emp-field-catalog-locked` in `FIELD_CHROME`. */
export const CATALOG_CONTROL =
  "catalog-control !box-border !border !border-solid !border-[var(--employees-control-border)] !bg-emp-surface focus:!border-emp-accent focus:!ring-2 focus:!ring-emp-accent/20 focus:!outline-none focus-visible:!border-emp-accent focus-visible:!ring-2 focus-visible:!ring-emp-accent/20 focus-visible:!outline-none disabled:!cursor-not-allowed disabled:!opacity-100 read-only:!cursor-default";
export const catalogUi = {
  module:
    `${EMPLOYEES_MODULE_ROOT} box-border w-full border-0 bg-transparent p-[0.25rem_0.15rem_1rem] text-emp-text`,
  breadcrumb:
    "mb-[0.35rem] mt-0 text-[0.85rem] font-semibold tracking-[0.01em] text-emp-muted",
  srOnly:
    "absolute m-[-1px] h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]",
  lede: "mb-[0.85rem] mt-0 max-w-[70ch] text-[0.85rem] leading-normal text-emp-muted",
  error: "mb-[0.85rem] mt-0 text-emp-critical",
  empty:
    "m-0 rounded-[0.4rem] border-0 bg-emp-raised px-[0.65rem] py-[0.5rem] text-[0.85rem] text-emp-muted",
  emptyState:
    "grid justify-items-center gap-[0.7rem] px-[1.25rem] py-[2.25rem] text-center",
  emptyLead:
    "m-0 max-w-[22rem] text-[0.85rem] leading-normal text-emp-muted",
  emptyIcon: "shrink-0 text-emp-muted opacity-70",
  fieldHint: "m-0 text-[0.85rem] leading-[1.35] text-emp-muted",
  notice:
    "mb-[0.85rem] flex flex-wrap items-center justify-between gap-[0.65rem] rounded-[0.45rem] border-0 border-l-[3px] border-l-emp-accent bg-emp-accent-soft px-[0.85rem] py-[0.7rem] [&_p]:m-0",
  errorBanner:
    "mb-[0.85rem] flex flex-wrap items-center justify-between gap-[0.65rem] rounded-[0.45rem] border-0 border-l-[3px] border-l-emp-critical bg-[var(--employees-critical-soft)] px-[0.85rem] py-[0.7rem] text-emp-critical [&_p]:m-0",
  directory: "grid gap-[0.9rem]",
  toolbar:
    "flex flex-col gap-[0.7rem] min-[42.0625rem]:flex-row min-[42.0625rem]:items-end min-[42.0625rem]:justify-between",
  toolbarFilters:
    `flex min-w-0 flex-1 items-center rounded-emp border border-emp-line bg-emp-raised px-[0.9rem] py-[0.75rem] ${TOOLBAR_FIELD_CHROME}`,
  searchWrap: "relative min-w-[12rem] w-full max-w-[26rem]",
  searchIcon:
    "pointer-events-none absolute left-[0.7rem] top-1/2 h-4 w-4 -translate-y-1/2 text-emp-muted",
  searchField: `emp-field m-0 [&_input]:!pl-[2.15rem] ${FIELD_CHROME}`,
  field: `emp-field grid min-w-0 content-start gap-[0.2rem] ${FIELD_CHROME}`,
  fieldLabel:
    "inline-flex max-w-full flex-wrap items-baseline text-[0.85rem] font-bold uppercase leading-tight tracking-[0.04em] text-emp-text",
  requiredMark:
    "ml-[0.22em] inline-block align-baseline !text-[1rem] font-bold leading-none tracking-normal text-emp-critical [text-transform:none]",
  optionalMark:
    "whitespace-nowrap font-medium normal-case tracking-normal text-emp-muted",
  requiredHint: "m-0 text-[0.85rem] text-emp-muted",
  control: CATALOG_CONTROL,
  controlSelect: CATALOG_CONTROL,
  dialogSection:
    "mx-[-1.15rem] mb-0 mt-8 grid w-auto min-w-0 content-start gap-4 border-0 border-t border-solid border-emp-line px-[1.15rem] pt-5",
  dialogSectionTitle:
    "m-0 mb-0.5 w-full min-w-0 px-0 text-[0.88rem] font-bold leading-tight text-emp-text",
  btnPrimary:
    "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border border-emp-accent bg-emp-accent px-[0.75rem] py-[0.32rem] text-[0.85rem] font-semibold text-emp-on-accent disabled:cursor-not-allowed disabled:opacity-55",
  btnGhost:
    "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border border-emp-line bg-transparent px-[0.75rem] py-[0.32rem] text-[0.85rem] font-semibold text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55",
  btnDanger:
    "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border border-transparent bg-emp-critical px-[0.75rem] py-[0.32rem] text-[0.85rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55",
  toolbarActions: "flex shrink-0 flex-wrap items-center justify-end gap-[0.5rem]",
  toolbarBtnGhost:
    "inline-flex min-h-[2.15rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.4rem] border border-emp-line bg-emp-surface px-[0.75rem] py-[0.32rem] text-[0.85rem] font-medium text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55",
  toolbarBtnPrimary:
    "inline-flex min-h-[2.45rem] cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.45rem] border border-emp-accent bg-emp-accent px-[1rem] py-[0.4rem] text-emp-on-accent shadow-[0_1px_2px_rgba(15,23,42,0.12)] hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55",
  dirEmptyCell: "!whitespace-normal !py-10 text-center",
  dirEmptyPanel:
    "rounded-emp border border-emp-line bg-emp-surface px-6 py-12 text-center",
  tableWrap: "overflow-x-auto bg-emp-surface",
  table:
    "w-full table-fixed border-collapse text-[0.875rem] leading-snug text-emp-text [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-b [&_td]:border-b [&_th]:border-emp-border [&_td]:border-emp-border [&_th]:px-5 [&_td]:px-5 [&_th]:py-[0.9rem] [&_td]:py-[0.9rem] [&_th]:text-left [&_td]:text-left [&_th]:align-middle [&_td]:align-middle [&_th[scope=row]]:whitespace-normal [&_th[scope=row]]:font-semibold [&_th[scope=row]]:text-emp-text [&_tbody_td]:text-emp-text [&_tbody_th]:text-emp-text [&_thead_th]:bg-emp-raised [&_thead_th]:text-[0.85rem] [&_thead_th]:font-bold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.05em] [&_thead_th]:text-emp-muted [&_tbody_tr:last-child>th]:border-b-0 [&_tbody_tr:last-child>td]:border-b-0",
  tableRowsHover:
    "[&_tbody_tr>th]:transition-colors [&_tbody_tr>td]:transition-colors [&_tbody_tr:hover>th]:!bg-[var(--employees-row-hover)] [&_tbody_tr:hover>td]:!bg-[var(--employees-row-hover)] [&_tbody_tr:hover_.dept-tree-cell]:!bg-[var(--employees-row-hover)]",
  dataRow:
    "[&:hover>th]:!bg-[var(--employees-row-hover)] [&:hover>td]:!bg-[var(--employees-row-hover)] [&:hover_.dept-tree-cell]:!bg-[var(--employees-row-hover)]",
  /** Shared catalog column rhythm — Status sits left of a dedicated Actions lane. */
  colName: "w-[28%]",
  colParent: "w-[22%]",
  colHead: "w-[22%]",
  colStatus: "w-[16%]",
  colActions: "w-[10.5rem]",
  colTitle: "w-auto",
  cellStatus: "align-middle",
  cellActions: "!pr-3 !text-right align-middle",
  cellMuted: "text-emp-muted",
  status:
    "inline-flex min-w-[4.25rem] items-center justify-center rounded-full px-2.5 py-[0.2rem] text-[0.85rem] font-semibold tracking-[0.01em]",
  statusActive: "bg-emp-success-soft text-emp-success",
  statusInactive: "bg-[var(--employees-critical-soft)] text-emp-critical",
  actions: "flex flex-wrap justify-end gap-[0.35rem]",
  rowMenu: "relative inline-flex w-full justify-end",
  rowMenuTrigger:
    "inline-grid size-8 cursor-pointer place-items-center rounded-[0.45rem] border border-transparent bg-transparent p-0 text-emp-muted hover:border-emp-line hover:bg-emp-raised hover:text-emp-text aria-expanded:border-emp-line aria-expanded:bg-emp-raised aria-expanded:text-emp-text",
  rowMenuPanel:
    `fixed ${zClass.menu} w-[10.5rem] rounded-[0.5rem] border-0 bg-emp-surface p-[0.3rem] shadow-[0_6px_18px_rgba(15,23,42,0.16)]`,
  rowMenuItem:
    "flex w-full cursor-pointer items-center gap-[0.55rem] rounded-[0.4rem] border-0 bg-transparent px-[0.65rem] py-[0.5rem] text-left text-emp-text hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-emp-text",
  rowMenuItemSuccess:
    "text-emp-success hover:bg-emp-success-soft hover:text-emp-success",
  rowMenuItemWarn: "text-emp-warning hover:text-emp-warning",
  rowMenuItemDanger: "text-emp-critical hover:bg-[rgba(185,28,28,0.08)] hover:text-emp-critical",
  /** Readable disabled row action — avoid washed-out opacity over table chrome. */
  rowMenuItemDisabled:
    "flex-col items-start gap-[0.15rem] text-emp-muted hover:text-emp-muted disabled:!opacity-100 disabled:!text-emp-muted disabled:hover:!bg-transparent disabled:hover:!text-emp-muted",
  rowMenuItemHint: "font-medium text-[0.85rem] leading-tight text-emp-muted",
  rowMenuSeparator: "mx-[0.35rem] my-[0.2rem] h-px border-0 bg-emp-line",
  iconBtn:
    "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[0.35rem] border border-emp-line bg-transparent text-emp-text hover:border-emp-accent hover:text-emp-accent",
  iconBtnCircle:
    "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 text-emp-text disabled:cursor-not-allowed disabled:opacity-55",
  iconBtnEdit: "bg-emp-raised text-emp-muted hover:text-emp-text",
  iconBtnDeactivate: "bg-emp-warning-soft text-emp-warning hover:opacity-90",
  iconBtnActivate: "bg-emp-success-soft text-emp-success hover:opacity-90",
  iconBtnDelete: "bg-[var(--employees-critical-soft)] text-emp-critical hover:opacity-90",
  iconBtnDanger:
    "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[0.35rem] border border-emp-line bg-transparent text-emp-critical hover:border-emp-critical",
  dirCell: "flex min-w-0 items-center",
  dirName:
    `relative ${zClass.local} inline-flex min-w-0 items-center gap-[0.45rem] border-0 bg-transparent p-0 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none`,
  dirParent: "truncate font-semibold text-emp-text",
  dirLeaf: "truncate font-medium text-emp-text",
  treeGuide: "pointer-events-none w-8 shrink-0 self-stretch",
  treeLine:
    "pointer-events-none absolute z-0 w-px -translate-x-1/2 bg-emp-border",
  treeElbow:
    "pointer-events-none absolute z-0 h-px w-3.5 -translate-y-1/2 bg-emp-border",
  chevronSpacer: "inline-block size-8 shrink-0",
  folderBranch: "shrink-0 text-emp-accent",
  folderLeaf: "shrink-0 text-emp-muted",
  pagination: "flex flex-wrap items-center justify-between gap-[0.75rem] px-0.5",
  paginationSummary: "m-0 text-[0.85rem] text-emp-muted",
  paginationControls: "flex items-center gap-[0.55rem] text-[0.85rem] text-emp-muted",
  overlay: modalBackdropClass,
  overlayNested: nestedModalBackdropClass,
  createOverlay: modalBackdropClass,
  dialog:
    "max-h-[min(90vh,44rem)] w-[min(28rem,100%)] overflow-auto rounded-[0.5rem] border-0 bg-emp-surface px-[0.95rem] py-[0.85rem] pb-4 text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  dialogNarrow:
    "flex max-h-[min(90vh,44rem)] min-h-0 w-[min(28rem,100%)] flex-col overflow-hidden rounded-[0.5rem] border-0 bg-emp-surface text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  dialogCompact:
    "flex max-h-[min(90vh,44rem)] min-h-0 w-[min(24rem,100%)] flex-col overflow-hidden rounded-[0.5rem] border-0 bg-emp-surface text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  dialogWide:
    "flex max-h-[min(90vh,44rem)] min-h-0 w-[min(52rem,100%)] flex-col overflow-hidden rounded-[0.5rem] border-0 bg-emp-surface text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  dialogXLarge:
    "flex max-h-[min(92vh,54rem)] min-h-0 w-[min(96rem,calc(100vw-2.5rem))] max-w-full flex-col overflow-hidden rounded-[0.5rem] border-0 bg-emp-surface text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  dialogHeader:
    "mb-3 flex shrink-0 justify-between gap-3 px-[1.15rem] pt-[0.85rem] [&_h2]:m-0 [&_h2]:text-[1.1rem] [&_h2]:font-semibold",
  dialogBrand:
    "m-0 text-[0.85rem] font-extrabold leading-none tracking-[-0.02em] text-emp-accent",
  dialogEyebrow:
    "mb-0 mt-2 text-[0.85rem] font-medium uppercase tracking-[0.14em] text-emp-muted",
  dialogTitleCreate:
    "m-0 mt-1.5 text-[1.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-emp-text",
  dialogSubtitle:
    "mt-1 mb-0 max-w-[22rem] text-[0.85rem] font-normal leading-normal text-emp-muted",
  dialogCloseQuiet:
    "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[0.45rem] border-0 bg-transparent text-emp-muted hover:bg-emp-accent-soft hover:text-emp-accent",
  dialogBody: "min-h-0 flex-1 overflow-y-auto px-[1.15rem] pt-1 pb-6",
  dialogFooter:
    "mt-0 flex shrink-0 justify-end gap-[0.55rem] border-0 border-t border-solid border-emp-line bg-transparent px-[1.15rem] pt-5 pb-3.5",
  chooser:
    "max-h-[min(90vh,44rem)] w-[min(28rem,100%)] overflow-auto rounded-[0.5rem] border-0 bg-emp-surface px-[0.95rem] py-[0.85rem] pb-4 text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  panelHeader:
    "mb-3 flex items-center justify-between gap-3 [&_h2]:m-0 [&_h2]:text-[1.1rem] [&_h2]:font-semibold",
  form: `emp-form grid gap-[0.75rem] ${FIELD_CHROME}`,
  formActions: "mt-[0.35rem] flex justify-end gap-[0.55rem]",
  menu:
    `absolute right-0 ${zClass.dropdownLocal} mt-1 min-w-[13rem] rounded-[0.5rem] border-0 bg-emp-surface p-[0.3rem] shadow-[0_6px_18px_rgba(15,23,42,0.16)]`,
  menuItem:
    "block w-full cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.65rem] py-2 text-left text-emp-text hover:bg-emp-accent-soft hover:text-emp-accent",

  selectSrOnly:
    "absolute h-px w-px overflow-hidden border-0 p-0 [clip:rect(0,0,0,0)] whitespace-nowrap",
  select: "relative w-full min-w-0",
  selectOpen: `relative ${zClass.dropdown} w-full min-w-0`,
  selectTrigger:
    "flex h-[2.35rem] min-h-[2.35rem] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[0.45rem] border border-solid border-[var(--employees-control-border)] bg-emp-surface px-[0.65rem] text-left text-[0.95rem] font-semibold leading-tight text-emp-text focus-visible:border-emp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emp-accent/20 disabled:cursor-not-allowed disabled:opacity-100",
  selectValue: "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
  selectPlaceholder:
    "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-emp-muted",
  selectChevron:
    "size-[0.75rem] h-2 w-3 shrink-0 text-emp-muted transition-transform duration-[120ms] ease-in-out",
  selectChevronOpen:
    "size-[0.75rem] h-2 w-3 shrink-0 rotate-180 text-emp-muted transition-transform duration-[120ms] ease-in-out",
  selectMenu:
    `fixed ${zClass.menu} m-0 flex max-h-64 w-full flex-col overflow-hidden rounded-[0.5rem] border border-emp-line bg-emp-surface p-0 text-emp-text shadow-[0_0.45rem_1.1rem_rgba(15,23,42,0.12)]`,
  selectSearchWrap: "shrink-0 border-0 border-b border-solid border-emp-line p-[0.4rem]",
  selectSearch:
    "box-border w-full rounded-[0.35rem] border border-solid border-[var(--employees-control-border)] bg-emp-surface px-[0.55rem] py-[0.4rem] text-[0.88rem] text-emp-text focus:border-emp-accent focus:outline-none focus:ring-2 focus:ring-emp-accent/20",
  selectOptions: "m-0 min-h-0 flex-1 list-none overflow-auto p-[0.3rem]",
  selectOption:
    "m-0 block w-full cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.6rem] py-2 text-left text-inherit hover:bg-emp-accent-soft hover:text-emp-accent",
  selectOptionSelected:
    "m-0 block w-full cursor-pointer rounded-[0.35rem] border-0 bg-emp-accent-soft px-[0.6rem] py-2 text-left text-emp-accent",
  selectEmpty:
    "m-0 px-[0.6rem] py-2 text-[0.85rem] text-emp-muted",
} as const;
