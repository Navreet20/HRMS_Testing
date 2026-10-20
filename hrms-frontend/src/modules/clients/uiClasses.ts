import { workspaceUi } from "@/shared/ui/workspaceUi";
import { zClass } from "@/ui/zIndex";

export { cx } from "@/shared/ui/workspaceUi";

const FONT = "font-['Segoe_UI','Source_Sans_3',system-ui,sans-serif]";
const ROOT = `box-border w-full min-w-0 max-w-full rounded-none bg-transparent p-0 text-app-text [border:0] ${FONT}`;

/** Inputs, selects, and textareas nested anywhere in a clients field. */
const FIELD_CONTROLS = [
  "[&_:is(input,select,textarea)]:w-full",
  "[&_:is(input,select,textarea)]:min-h-[2.35rem]",
  "[&_:is(input,select,textarea)]:px-[0.65rem]",
  "[&_:is(input,select,textarea)]:py-[0.45rem]",
  "[&_:is(input,select,textarea)]:text-app-text",
  "[&_:is(input,select,textarea)]:bg-app-surface",
  "[&_:is(input,select,textarea)]:border",
  "[&_:is(input,select,textarea)]:border-app-border",
  "[&_:is(input,select,textarea)]:rounded-[0.45rem]",
  "[&_:is(input,select):disabled]:cursor-not-allowed",
  "[&_:is(input,select):disabled]:opacity-100",
  "[&_:is(input,select):disabled]:[-webkit-text-fill-color:var(--app-text)]",
  "[&_input:read-only:not([type=checkbox]):not([type=file])]:cursor-default",
  "[&_input:read-only:not([type=checkbox]):not([type=file])]:opacity-100",
  "[&_input:read-only:not([type=checkbox]):not([type=file])]:[-webkit-text-fill-color:var(--app-text)]",
  "[&_textarea:read-only]:cursor-default",
  "[&_textarea:read-only]:opacity-100",
  "[&_textarea:read-only]:[-webkit-text-fill-color:var(--app-text)]",
].join(" ");

const FIELD_LABEL =
  "text-[0.72rem] font-bold uppercase leading-[1.25] tracking-[0.04em] text-app-text";

const FIELD = `grid min-w-0 grid-rows-[auto_auto_auto] [align-content:start] gap-[0.3rem] ${FIELD_CONTROLS} [&>span:first-child]:text-[0.72rem] [&>span:first-child]:font-bold [&>span:first-child]:uppercase [&>span:first-child]:leading-[1.25] [&>span:first-child]:tracking-[0.04em] [&>span:first-child]:text-app-text`;

/** Dark control outline shared by create-client inputs and search selects. */
const STRONG_CONTROL =
  "[&_.catalog-control]:bg-app-surface! [&_.catalog-control]:border! [&_.catalog-control]:border-app-text!";

const PROJECT_CARD_SHADOW = "shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08)]";

export const clientsUi = {
  ...workspaceUi,
  root: `${ROOT} [&_*::before]:box-border [&_*::after]:box-border [&_:focus-visible]:[outline-width:2px]!`,
  muted: "text-app-muted",
  /** Portaled overlays sit outside the app layout, so they carry the whole focus ring. */
  overlay: `fixed inset-0 ${zClass.modal} grid place-items-center bg-[rgba(15,23,42,0.48)] p-[1rem] backdrop-blur-[6px]`,
  toolbarFilters:
    "overflow-visible! rounded-[0.65rem]! border-app-border! bg-app-raised!",
  activeFilters: "bg-[color-mix(in_srgb,var(--app-surface)_80%,transparent)]!",
  filtersRow: "max-[42rem]:grid-cols-[1fr]!",

  field: FIELD,
  /** Direct inputs in the create-client grid use the dark control outline. */
  fieldGrid: `${FIELD} [&>:is(input,select,textarea)]:bg-app-surface! [&>:is(input,select,textarea)]:border! [&>:is(input,select,textarea)]:border-app-text!`,
  /** Any control inside a create-client modal field uses the dark outline. */
  fieldModal: `${FIELD} [&_:is(input,select,textarea)]:bg-app-surface! [&_:is(input,select,textarea)]:border! [&_:is(input,select,textarea)]:border-app-text!`,
  fieldLabel: FIELD_LABEL,
  fieldOptional: "font-medium normal-case tracking-normal text-app-muted",
  requiredMark: "font-bold normal-case tracking-normal text-[#b91c1c]",

  iconBtn:
    "m-0 inline-grid size-[2rem] cursor-pointer place-items-center justify-center rounded-[0.45rem] border border-transparent bg-transparent p-0 text-[color:var(--app-edit-icon,#2563eb)] hover:border-transparent hover:bg-[var(--app-edit-icon-soft,rgba(37,99,235,0.1))] hover:text-[color:var(--app-edit-icon-hover,#1d4ed8)]",

  rowMenu: "relative inline-flex justify-end",
  rowMenuTrigger:
    "inline-grid size-[1.75rem] cursor-pointer place-items-center rounded-[0.5rem] border border-transparent bg-transparent p-0 text-app-muted hover:border-app-border hover:bg-app-raised hover:text-app-text aria-expanded:border-app-border aria-expanded:bg-app-raised aria-expanded:text-app-text",
  rowMenuPanel: `absolute right-0 top-[calc(100%+0.35rem)] ${zClass.chrome} min-w-[9.5rem] rounded-[1rem] border border-app-border bg-app-surface p-[0.4rem] [box-shadow:0_12px_28px_rgba(0,0,0,0.08)]`,
  rowMenuItem:
    "flex w-full cursor-pointer items-center gap-[0.55rem] rounded-[0.7rem] bg-transparent px-[0.7rem] py-[0.55rem] text-left text-[0.88rem]! font-semibold! text-app-text [border:0] [font:inherit] [&:hover:not(:disabled)]:bg-app-accent-soft [&:hover:not(:disabled)]:text-app-accent",
  rowMenuItemDanger:
    "flex w-full cursor-pointer items-center gap-[0.55rem] rounded-[0.7rem] bg-transparent px-[0.7rem] py-[0.55rem] text-left text-[0.88rem]! font-semibold! text-module-critical [border:0] [font:inherit] [&:hover:not(:disabled)]:bg-[rgba(185,28,28,0.08)]",

  pagination: "flex flex-wrap items-center justify-between gap-[0.75rem]",
  paginationSummary: "m-0 text-[0.88rem] text-app-muted",
  paginationControls: "flex items-center gap-[0.65rem]",

  dirCardSpacious: "pr-[6.5rem]!",
  dirCardActions: "inline-flex items-center gap-[0.15rem]",
  cardAvatar: "block size-full rounded-[inherit] object-cover",

  /* Create-client modal (portaled; its overlay is also a module root). */
  createOverlay: `box-border w-full min-w-0 max-w-full rounded-none text-app-text [border:0] ${FONT} fixed inset-0 ${zClass.modal} grid place-items-center bg-[rgba(15,23,42,0.48)] p-[1rem] backdrop-blur-[6px] [&_:focus-visible]:[outline:2px_solid_var(--app-accent)] [&_:focus-visible]:[outline-offset:2px]`,
  createModal: `relative flex max-h-[min(92vh,56rem)] w-[min(52rem,100%)] flex-col overflow-hidden rounded-[0.85rem] border border-app-border bg-app-surface text-app-text [box-shadow:0_1px_2px_rgba(0,0,0,0.04),0_18px_48px_rgba(15,23,42,0.16)] after:pointer-events-none after:absolute after:inset-0 after:box-border after:rounded-[inherit] after:content-[''] after:[box-shadow:inset_0_3px_0_var(--ds-accent)] ${STRONG_CONTROL} [&_.text-emp-critical]:text-[#b91c1c]`,
  createModalHeader:
    "flex items-start justify-between gap-[1rem] border-b border-b-app-border px-[1.25rem] pb-[0.85rem] pt-[1.15rem]",
  createModalTitle: "m-0 text-[1.2rem]",
  createModalSubtitle: "mx-0 mb-0 mt-[0.3rem] text-[0.88rem] text-app-muted",
  createModalBody: "grid gap-[1.15rem] overflow-auto px-[1.25rem] py-[1rem]",
  createModalFooter:
    "flex flex-wrap items-center justify-end gap-[0.75rem] border-t border-t-app-border px-[1.25rem] pb-[1.1rem] pt-[0.85rem]",
  createModalActions: "m-0 flex justify-end gap-[0.55rem]",

  createSection: "grid gap-[0.7rem] [&_h3]:m-0! [&_h3]:text-[0.92rem]!",
  createSectionTitle: "m-0 text-[0.92rem]",
  createSectionBar: "flex flex-wrap items-center justify-between gap-[0.5rem]",
  createAdd:
    "cursor-pointer bg-transparent p-0 text-[0.88rem]! font-semibold! text-app-accent [border:0] [font:inherit]",
  createGrid: `grid grid-cols-1 gap-x-[2rem] gap-y-[0.75rem] min-[40rem]:grid-cols-2 ${STRONG_CONTROL} [&_.catalog-control]:font-normal [&_.catalog-control]:text-app-text`,
  createGridCols3: `grid grid-cols-1 gap-x-[2rem] gap-y-[0.75rem] min-[40rem]:grid-cols-3 ${STRONG_CONTROL} [&_.catalog-control]:font-normal [&_.catalog-control]:text-app-text`,
  /** Plain label + input checkbox. */
  createCheck:
    "flex min-h-[2.35rem] items-center gap-[0.5rem] [align-self:end] justify-self-start text-[0.92rem] text-app-text [&_input]:size-[1rem] [&_input]:accent-app-accent",
  /** `AppCheckbox` root: its shared rules lose on these properties. */
  createAppCheck:
    "flex! min-h-[2.35rem]! items-center gap-[0.5rem]! [align-self:end] justify-self-start text-[0.92rem]! text-app-text [&_input]:size-[1rem]! [&_input]:accent-app-accent",
  /** Internal / Direct / Intermediary checkbox row; spans the form grid. */
  categoryField: "grid gap-[0.35rem] col-span-full",
  categoryGroup: "flex flex-wrap items-center gap-x-[1.5rem] gap-y-[0.25rem]",
  logoTile: "flex items-start gap-[0.75rem]",
  logoPreviewWrap: "relative size-[3.25rem] shrink-0",
  logoPreview:
    "grid size-full shrink-0 place-items-center overflow-hidden rounded-[999px] border border-app-border bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-surface))] text-[0.85rem] font-bold text-app-accent [&_img]:block [&_img]:size-full [&_img]:object-cover",
  logoMeta: "grid min-w-0 gap-[0.35rem]",
  logoHint: "text-[0.75rem] leading-[1.35] text-app-muted",

  createCard:
    "grid gap-[0.65rem] rounded-[0.55rem] border border-app-border bg-app-surface px-[0.85rem] py-[0.75rem]",
  /** Profile cards float with the profile shadow. */
  createCardRaised: `grid gap-[0.65rem] rounded-[0.55rem] border border-app-border bg-app-surface px-[0.85rem] py-[0.75rem] ${CARD_SHADOW}`,
  createCardBar: "flex items-center justify-between gap-[0.5rem]",
  createCardTitle: "m-0 text-[0.92rem] font-bold text-app-text",

  /* Client profile — project detail and list. */
  projectsWorkspace: "grid grid-cols-1 [align-items:start] gap-[1rem]",
  projectsList: "grid min-w-0 gap-[0.65rem]",
  projectsListTitle: "m-0 text-[1.05rem] font-bold text-app-text",
  projectsListItems: "m-0 grid list-none gap-[0.55rem] p-0",
  projectDetail: "grid w-full min-w-0 max-w-full gap-[0.85rem]",
  projectDetailForm: "grid min-w-0 max-w-full gap-[0.85rem]",
  projectSectionCard: `grid min-w-0 max-w-full gap-[0.85rem] rounded-[0.75rem] border border-app-border bg-app-surface px-[1rem] py-[0.9rem] ${CARD_SHADOW}`,
  projectSectionBar: "flex items-center justify-between gap-[0.75rem]",
  projectSectionActions: "inline-flex items-center gap-[0.25rem]",
  projectSectionTitle: "m-0 text-[0.98rem] font-bold text-app-text",
  projectHero:
    "flex min-w-0 max-w-full flex-wrap items-center justify-between gap-[0.75rem] border-b border-b-app-border pb-[0.9rem]",
  projectHeroMain: "flex min-w-0 items-center gap-[0.75rem]",
  projectHeroIcon:
    "inline-grid size-[2.6rem] shrink-0 place-items-center rounded-[0.55rem] bg-[color-mix(in_srgb,var(--app-accent)_12%,white)] text-app-accent",
  projectHeroText: "min-w-0",
  projectHeroName:
    "m-0 text-[1.15rem] font-extrabold text-app-text [overflow-wrap:anywhere]",
  projectHeroMeta:
    "mx-0 mb-0 mt-[0.3rem] flex flex-wrap items-center gap-[0.4rem] text-[0.8rem] text-app-muted",

  /** Profile hero opens the client when clickable. */
  profileHeroClickable:
    "cursor-pointer transition-[border-color] duration-150 ease-[ease] hover:border-app-accent focus-visible:[outline:2px_solid_var(--app-accent)] focus-visible:[outline-offset:2px]",

  /** Selectable project card in the client profile list. */
  projectCardSelectable: `relative flex w-full cursor-pointer items-start gap-[0.5rem] overflow-visible rounded-[0.55rem] border! border-app-border! bg-app-surface! py-[0.75rem] pl-[0.85rem] pr-[2.5rem] text-left text-inherit [font:inherit] ${PROJECT_CARD_SHADOW} [[data-module=projects]_&]:m-0 [[data-module=projects]_&]:pr-[3.25rem] [[data-module=projects]_&]:text-app-text [[data-module=projects]_&]:hover:border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))]!`,
  projectCardMain:
    "m-0 flex min-w-0 flex-1 cursor-default items-start gap-[0.75rem] bg-transparent p-0 text-left [border:0] [[data-module=projects]_&]:cursor-[inherit]",
  projectCardIcon:
    "inline-grid size-[2.35rem] shrink-0 place-items-center rounded-[999px] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-surface))] text-app-accent",
  projectCardBody: "grid min-w-0 flex-1 gap-[0.3rem]",
  projectCardName: "text-[0.98rem] font-bold text-app-text",
  projectCardCodes: "text-[0.8rem] text-app-muted",
  projectCardSelectableActions:
    "pointer-events-none absolute right-[0.55rem] top-[0.55rem] inline-flex items-center gap-[0.15rem] text-app-muted",
} as const;
