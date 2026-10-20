/** Employees-style Tailwind classes shared by directory, toolbar, and form screens across modules. */

import {
  DATE_FIELD_CHROME,
  FIELD_CHROME,
  TOOLBAR_FIELD_CHROME,
} from "@/shared/ui/fieldChrome";
import { profileShellUi } from "@/shared/ui/profileShellUi";
import { zClass } from "@/ui/zIndex";

export { cx } from "./cx";

export const empUi = {
  srOnly: "absolute m-[-1px] h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]",
  muted: "text-emp-muted",
  error:
    "mb-[0.85rem] mt-0 rounded-[0.45rem] border-0 border-l-[3px] border-l-emp-critical bg-[rgba(185,28,28,0.12)] px-[0.85rem] py-[0.7rem] text-[0.88rem] leading-[1.35] text-emp-critical",
  empty:
    "m-0 rounded-[0.4rem] border-0 bg-emp-raised px-[0.65rem] py-[0.5rem] text-[0.85rem] text-emp-muted",
  directory: "grid gap-[0.9rem]",
  toolbar: "grid gap-[0.7rem]",
  toolbarFilters:
    `grid min-w-0 w-full content-start gap-0 rounded-emp border border-emp-line bg-emp-raised ${TOOLBAR_FIELD_CHROME}`,
  toolbarFiltersRow:
    "grid min-w-0 grid-cols-1 gap-[0.75rem] px-[0.9rem] py-[0.75rem] min-[42.0625rem]:grid-cols-[minmax(0,1.55fr)_minmax(11rem,1fr)_minmax(10rem,0.9fr)]",
  toolbarActiveFilters:
    "flex flex-wrap items-center gap-[0.5rem] bg-emp-surface/80 px-[0.9rem] py-[0.6rem]",
  toolbarFilterChipList:
    "flex min-w-0 flex-1 flex-wrap items-center gap-[0.4rem]",
  toolbarFilterChip:
    "inline-flex max-w-full items-center gap-[0.3rem] rounded-full border border-emp-line bg-emp-surface py-[0.18rem] pl-[0.55rem] pr-[0.28rem] text-[0.85rem] leading-tight shadow-[0_1px_0_rgba(255,255,255,0.03)]",
  toolbarFilterChipLabel:
    "shrink-0 text-[0.85rem] font-bold uppercase tracking-[0.04em] text-emp-muted",
  toolbarFilterChipValue:
    "max-w-[12rem] truncate font-semibold text-emp-text",
  toolbarFilterChipRemove:
    "inline-grid size-[1.4rem] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-accent-soft hover:text-emp-accent",
  toolbarClearFilters:
    "ml-auto shrink-0 cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.35rem] py-[0.15rem] text-[0.85rem] font-semibold text-emp-muted underline-offset-[0.2em] hover:text-emp-accent hover:underline",
  toolbarActions: "flex shrink-0 flex-wrap items-center justify-end gap-[0.5rem]",
  toolbarBtnGhost:
    "inline-flex min-h-[2.15rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.4rem] border border-emp-line bg-emp-surface px-[0.75rem] py-[0.32rem] text-[0.85rem] font-medium text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-emp-line disabled:hover:bg-emp-surface disabled:hover:text-emp-text",
  toolbarBtnPrimary:
    "inline-flex min-h-[2.45rem] cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.45rem] border border-emp-accent bg-emp-accent px-[1rem] py-[0.4rem] text-[0.88rem] font-bold text-emp-on-accent shadow-[0_1px_2px_rgba(15,23,42,0.12)] hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100",
  field: `emp-field grid min-w-0 content-start gap-[0.2rem] ${FIELD_CHROME}`,
  fieldLabel:
    "text-[0.85rem] font-bold uppercase leading-tight tracking-[0.04em] text-emp-text",
  fieldLabelOptional:
    "text-[0.85rem] font-medium normal-case leading-tight tracking-normal text-emp-muted",
  fieldRequired: "font-bold text-emp-critical",
  fieldHint: "text-[0.85rem] leading-[1.35] text-emp-muted",
  viewField: "grid min-w-0 content-start gap-[0.3rem]",
  viewFieldLabel:
    "text-[0.85rem] font-medium leading-[1.25] text-emp-muted",
  viewFieldValue:
    "m-0 min-w-0 bg-transparent text-[0.95rem] font-semibold leading-[1.35] text-emp-text",
  viewFieldValueMuted:
    "m-0 min-w-0 bg-transparent text-[0.95rem] font-medium leading-[1.35] text-emp-muted",
  fieldError: "m-0 text-[0.85rem] leading-[1.35] text-emp-critical",
  btnQuiet:
    "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border-0 bg-transparent px-[0.55rem] py-[0.32rem] text-[0.85rem] font-medium text-emp-muted hover:bg-transparent hover:text-emp-text disabled:cursor-not-allowed disabled:opacity-45",
  btnPrimary:
    "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border border-emp-accent bg-emp-accent px-[0.75rem] py-[0.32rem] text-[0.85rem] font-semibold text-emp-on-accent disabled:cursor-not-allowed disabled:opacity-55",
  btnGhost:
    "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border border-emp-line bg-transparent px-[0.75rem] py-[0.32rem] text-[0.85rem] font-semibold text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-emp-line disabled:hover:bg-transparent disabled:hover:text-emp-text",
  btnDanger:
    "inline-flex min-h-[2.1rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border border-transparent bg-emp-critical px-[0.75rem] py-[0.32rem] text-[0.85rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55",
  btnCompact: "min-h-[1.9rem] px-[0.55rem] py-[0.25rem] text-[0.85rem]",
  tableWrap: "overflow-x-auto rounded-emp border border-emp-line bg-emp-surface",
  dirEmptyPanel:
    "rounded-emp border border-emp-line bg-emp-surface px-6 py-12 text-center",
  dirEmpty:
    "mx-auto grid max-w-[24rem] justify-items-center gap-[0.45rem] px-4 py-1",
  dirEmptyIcon:
    "mb-1 grid size-12 place-items-center rounded-full bg-emp-accent-soft text-emp-accent",
  dirEmptyTitle: "m-0 text-[0.98rem] font-semibold text-emp-text",
  dirEmptyCopy: "m-0 text-[0.85rem] leading-normal text-emp-muted",
  dirCardList: "grid gap-3",
  dirCard:
    "relative grid gap-4 rounded-[0.75rem] border border-emp-line bg-emp-surface px-5 py-5 pr-12 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08)]",
  dirCardInteractive:
    "group relative grid cursor-pointer gap-4 overflow-visible rounded-[0.75rem] border border-emp-line bg-emp-surface px-5 py-5 pr-12 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08)] hover:border-emp-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus",
  dirCardActions: "absolute right-3 top-3",
  dirBadge:
    "inline-flex rounded-[0.35rem] bg-emp-warning-soft px-[0.45rem] py-[0.1rem] text-[0.85rem] font-semibold text-emp-warning",
  status:
    "inline-flex rounded-full bg-emp-accent-soft px-[0.4rem] py-[0.1rem] text-[0.85rem] font-semibold text-emp-accent",
  statusPending: "bg-emp-warning-soft text-emp-warning",
  statusActive: "bg-emp-success-soft text-emp-success",
  statusInactive: "bg-[rgba(185,28,28,0.12)] text-emp-critical",
  rowMenu: "relative inline-flex justify-end",
  rowMenuTrigger:
    "inline-grid size-7 cursor-pointer place-items-center rounded-[0.5rem] border border-transparent bg-transparent p-0 text-emp-muted hover:border-emp-border hover:bg-emp-raised hover:text-emp-text aria-expanded:border-emp-border aria-expanded:bg-emp-raised aria-expanded:text-emp-text",
  rowMenuPanel:
    `fixed ${zClass.menu} min-w-[9.5rem] rounded-[0.5rem] border-0 bg-emp-surface p-[0.4rem] shadow-[0_6px_18px_rgba(15,23,42,0.16)]`,
  rowMenuItem:
    "flex w-full cursor-pointer items-center gap-[0.55rem] rounded-[0.7rem] border-0 bg-transparent px-[0.7rem] py-[0.55rem] text-left text-[0.88rem] font-semibold text-emp-text hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:text-emp-muted disabled:hover:bg-transparent disabled:hover:text-emp-muted",
  rowMenuItemDanger:
    "text-emp-critical hover:bg-[rgba(185,28,28,0.08)] hover:text-emp-critical",
  rowMenuItemDisabled:
    "flex-col items-start gap-[0.15rem] text-emp-muted hover:text-emp-muted disabled:!opacity-100 disabled:!text-emp-muted disabled:hover:!bg-transparent disabled:hover:!text-emp-muted",
  rowMenuItemHint: "font-medium text-[0.85rem] leading-tight text-emp-muted",
  rowMenuSeparator: "mx-[0.35rem] my-[0.2rem] h-px border-0 bg-emp-line",
  createFormPage:
    `emp-form grid grid-cols-1 items-start gap-x-3 gap-y-4 min-[28rem]:grid-cols-2 ${FIELD_CHROME}`,
  dateField: `emp-date relative ${DATE_FIELD_CHROME}`,
  profileHeroRow: profileShellUi.profileHeroRow,
  profileHeroAvatarCol: profileShellUi.profileHeroAvatarCol,
  profileHeroAvatarWrap: profileShellUi.profileHeroAvatarWrap,
  profileHeroAvatar: profileShellUi.profileHeroAvatar,
  profileHeroBody: profileShellUi.profileHeroBody,
  profileHeroName: profileShellUi.profileHeroName,
  profileHeroRole: profileShellUi.profileHeroRole,
  profileHeroMeta: profileShellUi.profileHeroMeta,
  profileHeroMetaItem: profileShellUi.profileHeroMetaItem,
  profileHeroMetaIcon: profileShellUi.profileHeroMetaIcon,
  profileHeroPills: profileShellUi.profileHeroPills,
  profileHeroPill: profileShellUi.profileHeroPill,
  profileHeroPillIcon: profileShellUi.profileHeroPillIcon,
  /** Profile tab support line under the section title. */
  sectionHeaderLede: "m-0 text-[0.88rem] leading-normal text-emp-muted",
  skillsCertName:
    "max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-bold text-emp-text",
  skillsDropzone:
    "grid cursor-pointer justify-items-center gap-1.5 rounded-[0.7rem] border border-dashed border-emp-line bg-emp-surface px-4 py-6 text-center hover:border-emp-accent hover:bg-emp-accent-soft",
  skillsDropzoneActive: "border-emp-accent bg-emp-accent-soft",
  skillsDropzoneIcon: "text-emp-muted",
  skillsDropzoneCopy: "text-[0.88rem] font-medium text-emp-text",
  skillsDropzoneBrowse: "font-semibold text-emp-accent",
  skillsDropzoneHint: "text-[0.85rem] text-emp-muted",
  skillsCertCurrent:
    "flex min-w-0 items-center gap-2 rounded-[0.55rem] border border-emp-line bg-emp-raised px-3 py-2",
  profileStepPersonal:
    "grid grid-cols-1 items-start gap-x-8 gap-y-5 min-[40rem]:grid-cols-3 [&_.emp-field>span:first-child]:normal-case [&_.emp-field>span:first-child]:tracking-normal [&_.emp-field>span:first-child]:font-medium",
  photoCapsule:
    "inline-flex min-h-[1.7rem] cursor-pointer items-center justify-center rounded-full border-0 bg-[rgba(37,99,235,0.1)] px-[0.75rem] py-[0.22rem] text-[0.85rem] font-semibold text-[#2563eb] hover:bg-[rgba(37,99,235,0.16)]",
} as const;
