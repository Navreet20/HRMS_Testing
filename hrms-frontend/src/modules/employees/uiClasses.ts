/** Shared Tailwind class strings for the employees module (1:1 with former BEM). */

import {
  modalBackdropClass,
  nestedModalBackdropClass,
} from "@/shared/ui/modalBackdrop";
import {
  FIELD_CHROME,
  PHONE_FIELD_CHROME,
  PHONE_INPUT_CHROME,
} from "@/shared/ui/fieldChrome";
import { profileShellUi } from "@/shared/ui/profileShellUi";
import {
  editIconButton,
  editIconButtonActive,
} from "@/shared/ui/sharedUiClasses";
import { zClass } from "@/ui/zIndex";
import { cx } from "@/shared/ui/cx";
import { empUi } from "@/shared/ui/empUi";

export { cx };

export const ui = {
  ...empUi,
  module:
    "box-border w-full border-0 bg-transparent p-[0.25rem_0.15rem_1rem] font-[Segoe_UI,Source_Sans_3,system-ui,sans-serif] text-emp-text focus-within:outline-none",
  moduleAccount:
    "box-border block w-full flex-[1_1_auto] rounded-[0.85rem] border border-emp-line bg-emp-surface p-5 font-[Segoe_UI,Source_Sans_3,system-ui,sans-serif] text-emp-text shadow-[var(--ds-shadow-sm)] focus-within:outline-none",
  lede: "mb-[0.85rem] mt-0 max-w-[70ch] text-[0.85rem] leading-normal text-emp-muted",
  eyebrow:
    "mb-[0.25rem] mt-0 text-[0.85rem] font-bold uppercase tracking-[0.06em] text-emp-muted",
  workspace: "mb-[0.3rem] inline-flex flex-wrap items-center gap-[0.35rem] border-0 bg-transparent p-0",
  chipTab:
    "min-h-0 cursor-pointer rounded-[0.35rem] border border-emp-line bg-transparent px-[0.65rem] py-[0.32rem] text-[0.85rem] font-semibold text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent",
  chipTabActive:
    "min-h-0 cursor-pointer rounded-[0.35rem] border border-emp-accent bg-emp-accent px-[0.65rem] py-[0.32rem] text-[0.85rem] font-semibold text-emp-on-accent",

  approvals: "grid gap-[0.55rem]",
  approvalsTabs: "inline-flex flex-wrap items-center gap-[0.35rem]",
  approvalsPanel: "grid min-w-0 gap-[0.5rem]",
  approvalsTimesheets:
    "flex flex-wrap items-center justify-between gap-[0.65rem] rounded-emp border border-emp-line bg-emp-surface px-[0.75rem] py-[0.65rem] [&_p]:m-0 [&_p]:text-[0.85rem]",

  fieldInputSystem: "emp-field-input--system",
  iconBtn:
    "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[0.35rem] border border-emp-line bg-transparent text-emp-text",

  table:
    "w-full border-collapse text-[0.85rem] [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-b [&_td]:border-b [&_th]:border-emp-border [&_td]:border-emp-border [&_th]:px-4 [&_td]:px-4 [&_th]:py-[0.8rem] [&_td]:py-[0.8rem] [&_th]:text-left [&_td]:text-left [&_th]:align-middle [&_td]:align-middle [&_th[scope=row]]:whitespace-normal [&_th[scope=row]]:font-bold [&_thead_th]:bg-emp-raised [&_thead_th]:text-[0.85rem] [&_thead_th]:font-bold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.04em] [&_thead_th]:text-emp-muted [&_tbody_tr:hover>th]:bg-[var(--employees-row-hover)] [&_tbody_tr:hover>td]:bg-[var(--employees-row-hover)]",
  sortBtn:
    "inline-flex cursor-pointer items-center gap-[0.35rem] border-0 bg-transparent p-0 font-inherit text-inherit tracking-inherit uppercase",
  sortIconActive: "text-emp-accent",
  actions: "flex flex-wrap gap-[0.35rem]",

  dirEmptyCell: "!whitespace-normal !py-10 text-center",
  dirName: "inline-flex min-w-0 flex-wrap items-center gap-[0.55rem]",
  dirAvatar:
    "inline-grid size-[1.85rem] shrink-0 place-items-center overflow-hidden rounded-full border border-emp-border bg-emp-accent-soft text-[0.85rem] font-extrabold text-emp-accent",
  dirAvatarImg: "size-full object-cover",
  pagination: "flex flex-wrap items-center justify-between gap-[0.75rem]",
  paginationSummary: "m-0 text-[0.85rem] text-emp-muted",
  paginationControls: "flex items-center gap-[0.55rem] text-[0.85rem] text-emp-muted",

  overlay: modalBackdropClass,
  overlayNested: nestedModalBackdropClass,
  chooser:
    "max-h-[min(90vh,44rem)] w-[min(28rem,100%)] overflow-auto rounded-[0.5rem] border-0 bg-emp-surface px-[0.95rem] py-[0.85rem] pb-4 text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  panelHeader: "mb-3 flex items-center justify-between gap-3 [&_h2]:m-0 [&_h2]:text-[1.1rem] [&_h2]:font-semibold",
  chooserList: "m-0 grid list-none gap-[0.55rem] p-0",
  chooserOption:
    "grid w-full cursor-pointer gap-[0.2rem] rounded-[0.45rem] border border-emp-line bg-transparent px-[0.85rem] py-[0.75rem] text-left text-inherit hover:border-emp-accent hover:bg-emp-accent-soft disabled:cursor-not-allowed disabled:opacity-65",
  chooserTitle: "font-semibold",
  chooserHint: "text-[0.85rem] text-emp-muted",

  importDialog: "w-[min(32rem,100%)]",
  importActions: "my-[0.85rem] flex flex-wrap gap-2",
  importFile: "relative cursor-pointer overflow-hidden [&_input]:absolute [&_input]:inset-0 [&_input]:cursor-pointer [&_input]:opacity-0",
  importError: "mt-2 mb-0 text-[#b42318]",
  importResult: "mt-3 rounded-[0.45rem] border-0 bg-emp-raised px-[0.75rem] py-[0.65rem] [&_p]:mb-[0.35rem] [&_p]:mt-0",
  importList: "mt-[0.35rem] mb-0 pl-[1.1rem] text-[0.85rem] text-emp-muted",

  deactivatePreview:
    "my-3 rounded-[0.45rem] border border-emp-line bg-emp-raised px-[0.75rem] py-[0.65rem] [&_ul]:mt-[0.35rem] [&_ul]:mb-0 [&_ul]:pl-[1.1rem]",

  form: `emp-form grid gap-[0.75rem] ${FIELD_CHROME}`,
  formPage:
    `emp-form grid grid-cols-1 items-start gap-x-4 gap-y-[0.85rem] min-[40.0625rem]:grid-cols-2 ${FIELD_CHROME}`,
  formActions: "mt-[0.35rem] flex justify-end gap-[0.55rem]",
  formActionsStack: "mt-[0.35rem] flex flex-col items-stretch gap-[0.55rem]",
  fieldset:
    "m-0 rounded-[0.45rem] border border-emp-line px-[0.75rem] py-[0.65rem] [&_legend]:px-1 [&_legend]:text-[0.85rem] [&_legend]:text-emp-muted",
  check: "mt-[0.35rem] flex items-center gap-[0.45rem] text-[0.9rem]",
  datePair:
    "col-span-full grid grid-cols-1 items-start gap-x-4 gap-y-[0.85rem] min-[40.0625rem]:grid-cols-2",
  datePairSide: "flex min-w-0 flex-col gap-[0.2rem]",
  datePairSideSpacer:
    "block min-h-[1.05rem] shrink-0 max-[40rem]:hidden",
  createPage:
    "grid gap-4 rounded-emp border border-emp-line bg-emp-surface px-[0.85rem] py-[0.75rem] pb-4",
  createOverlay: modalBackdropClass,
  createDialog:
    "flex max-h-[min(92vh,52rem)] min-h-0 w-[min(100%,58rem)] flex-col overflow-hidden rounded-[0.85rem] border border-emp-border bg-emp-surface text-emp-text shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_48px_rgba(15,23,42,0.16),inset_0_3px_0_var(--ds-accent)]",
  createDialogHeader:
    "flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5",
  createDialogHeaderMain: "grid min-w-0 flex-1 gap-0",
  createBrand:
    "m-0 text-[0.85rem] font-extrabold leading-none tracking-[-0.02em] text-emp-accent",
  createEyebrow:
    "mb-0 mt-2 text-[0.85rem] font-medium uppercase tracking-[0.14em] text-emp-muted",
  createTitle:
    "m-0 mt-1.5 text-[1.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-emp-text",
  createLede:
    "mb-0 mt-1.5 max-w-[36ch] text-[0.875rem] font-normal leading-[1.45] text-emp-muted",
  createCloseBtn:
    "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[0.45rem] border-0 bg-transparent text-emp-muted hover:bg-emp-accent-soft hover:text-emp-accent",
  createDialogForm: "flex min-h-0 flex-1 flex-col",
  createDialogFields: "min-h-0 flex-1 overflow-y-auto px-5 py-4",
  createDialogActions:
    "mt-0 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-emp-border bg-emp-surface px-5 py-3.5 [&_button]:min-h-[2.5rem] [&_button]:rounded-[0.5rem]",
  createDialogActionsPrimary: "ml-auto flex flex-wrap items-center justify-end gap-2",
  createContinueBtn:
    "inline-flex min-h-[2.5rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.5rem] border border-emp-accent bg-emp-accent px-[1.05rem] py-[0.4rem] text-emp-on-accent disabled:cursor-not-allowed disabled:opacity-55",
  colSpanFull: "col-span-full",
  createStepperWrap:
    "relative mx-5 mt-1 border-b border-[var(--app-border-soft)] pb-4",
  createStepper:
    `relative ${zClass.local} m-0 grid w-full list-none grid-cols-4 gap-0 p-0`,
  createStepperIndex:
    "group relative flex w-full min-w-0 cursor-pointer flex-col items-center justify-start gap-[0.4rem] border-0 bg-transparent p-0 text-center focus-visible:outline-none disabled:cursor-default",
  createStepperIndexActive:
    "group relative flex w-full min-w-0 cursor-pointer flex-col items-center justify-start gap-[0.4rem] border-0 bg-transparent p-0 text-center focus-visible:outline-none disabled:cursor-default",
  createStepperIndexDone:
    "group relative flex w-full min-w-0 cursor-pointer flex-col items-center justify-start gap-[0.4rem] border-0 bg-transparent p-0 text-center focus-visible:outline-none disabled:cursor-default",
  createStepperMark:
    "inline-grid size-[1.15rem] place-items-center rounded-full border-[1.5px] border-emp-line bg-emp-surface text-[0.85rem] font-bold leading-none text-emp-muted group-focus-visible:shadow-[0_0_0_3px_var(--ds-accent-ring)]",
  createStepperMarkDone:
    "inline-grid size-[1.15rem] place-items-center rounded-full border-[1.5px] border-emp-accent bg-emp-accent text-[0.85rem] font-bold leading-none text-emp-on-accent group-focus-visible:shadow-[0_0_0_3px_var(--ds-accent-ring)]",
  createStepperMarkActive:
    "inline-grid size-[1.15rem] place-items-center rounded-full border-[1.5px] border-emp-accent bg-emp-accent text-[0.85rem] font-bold leading-none text-emp-on-accent shadow-[0_0_0_3px_var(--ds-accent-ring)]",
  createStepperLabel:
    "min-w-0 text-[0.85rem] font-semibold leading-tight tracking-[0.01em] text-emp-muted",
  createStepperLabelActive:
    "min-w-0 text-[0.85rem] font-bold leading-tight tracking-[0.01em] text-emp-accent",
  createStepperProgress:
    "pointer-events-none absolute left-[12.5%] right-[12.5%] top-[calc(0.575rem)] h-0.5 overflow-hidden rounded-full bg-emp-border",
  createStepperProgressFill:
    "h-full w-full origin-left rounded-full bg-emp-accent transition-transform duration-200 ease-out motion-reduce:transition-none",
  createReview:
    `emp-create-review emp-form grid grid-cols-1 items-start gap-4 min-[40rem]:grid-cols-2 ${FIELD_CHROME}`,
  createReviewControl:
    "flex h-[2.35rem] min-h-[2.35rem] w-full min-w-0 items-center gap-[0.65rem] overflow-x-auto overflow-y-hidden rounded-[0.45rem] border-0 bg-emp-raised px-[0.65rem] text-[0.95rem] font-semibold text-emp-text [&_label]:mt-0 [&_label]:shrink-0",
  reviewCard:
    "rounded-emp border border-emp-line bg-emp-surface px-[0.85rem] py-[0.75rem]",
  reviewCardHeader: "mb-[0.75rem] flex items-center justify-between gap-2",
  reviewCardTitle: "m-0 text-[1.05rem] font-bold text-emp-text",
  reviewCardGrid:
    "grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] items-start gap-x-4 gap-y-[0.85rem]",
  reviewCardEdit: editIconButton,
  reviewCardEditActive: editIconButtonActive,

  wizard: profileShellUi.page,
  wizardHeader: "grid grid-cols-[minmax(0,1fr)] items-start gap-[0.55rem]",
  wizardIdentity:
    "w-full min-w-0 gap-4 rounded-none border-0 bg-transparent p-0",
  wizardAudit:
    "m-0 flex flex-wrap gap-x-6 gap-y-3 rounded-[0.75rem] border border-emp-line bg-emp-surface px-5 py-4 [&_dd]:m-0 [&_dd]:text-[0.9rem] [&_dd]:text-emp-text [&_div]:grid [&_div]:min-w-[8rem] [&_div]:gap-[0.1rem] [&_dt]:m-0 [&_dt]:text-[0.85rem] [&_dt]:font-semibold [&_dt]:uppercase [&_dt]:tracking-[0.04em] [&_dt]:text-emp-muted",
  wizardTabs: "flex flex-wrap gap-[0.4rem]",
  wizardPanel: "pt-[0.85rem]",
  wizardSections: "grid gap-5 pt-1",
  wizardSection: "scroll-mt-6 grid gap-3",
  wizardSectionTitle: profileShellUi.sectionTitle,
  wizardSectionStack: profileShellUi.sectionStack,
  wizardStep:
    "grid grid-cols-1 items-end gap-x-3 gap-y-[0.85rem] min-[36.0625rem]:grid-cols-2 min-[64.0625rem]:grid-cols-4",
  profileHero: profileShellUi.profileHero,
  profileHeroPhoto: profileShellUi.profileHeroPhoto,
  profileHeroPillButton: profileShellUi.profileHeroPillButton,
  profileTabsRow: profileShellUi.profileTabsRow,
  profileTabs: profileShellUi.profileTabs,
  profileTab: profileShellUi.profileTab,
  profileTabActive: profileShellUi.profileTabActive,
  profileTabCheck: "size-3.5 shrink-0 text-emp-accent",
  profileTabDot: "size-1.5 shrink-0 rounded-full bg-emp-critical",
  profileTabStatus: "inline-flex items-center",
  profileTabsLegend:
    "mb-[0.7rem] flex shrink-0 items-center gap-3 whitespace-nowrap",
  profileTabsLegendItem:
    "inline-flex items-center gap-1.5 text-[0.85rem] font-semibold",
  profileTabsLegendComplete: "text-emp-accent",
  profileTabsLegendIncomplete: "text-emp-critical",
  onboardingPacket: "grid gap-[0.85rem]",
  onboardingPacketHeader: "grid min-w-0 gap-1",
  onboardingPacketList: "m-0 grid list-none gap-[0.75rem] p-0",
  onboardingPacketCard:
    "grid gap-[0.85rem] rounded-[0.75rem] border border-emp-line bg-emp-surface px-[1rem] py-[0.9rem] shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-[40rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[40rem]:items-center",
  onboardingPacketCardMain: "flex min-w-0 items-start gap-[0.75rem]",
  onboardingPacketIcon:
    "inline-grid size-[2.4rem] shrink-0 place-items-center rounded-[0.55rem] bg-emp-raised text-emp-accent",
  onboardingPacketMeta: "grid min-w-0 gap-[0.2rem]",
  onboardingPacketTitle:
    "m-0 text-[0.95rem] font-semibold leading-tight text-emp-text",
  onboardingPacketStatus:
    "m-0 inline-flex flex-wrap items-center gap-[0.35rem] text-[0.85rem] font-semibold",
  onboardingPacketStatusOk: "text-emp-accent",
  onboardingPacketStatusPending: "text-emp-critical",
  onboardingPacketVersion: "font-medium text-emp-muted",
  onboardingPacketActions:
    "flex flex-wrap items-center justify-center gap-[0.75rem] justify-self-center",
  onboardingPacketPrimaryActions:
    "inline-flex flex-wrap items-center justify-center gap-[0.45rem]",
  onboardingPacketIconSlot:
    "inline-flex min-w-[4.5rem] shrink-0 items-center justify-center gap-[0.15rem] border-l border-emp-border pl-[0.75rem]",
  onboardingPacketSubmittedActions:
    "inline-flex flex-wrap items-center gap-[0.15rem]",
  onboardingPacketLink:
    "inline-flex min-h-[2rem] cursor-pointer items-center justify-center gap-[0.3rem] rounded-[0.35rem] border-0 bg-transparent px-[0.45rem] py-[0.2rem] text-[0.85rem] font-semibold text-emp-accent hover:bg-emp-accent-soft disabled:cursor-not-allowed disabled:opacity-55",
  onboardingPacketIconBtn:
    "inline-flex size-[2rem] cursor-pointer items-center justify-center rounded-[0.35rem] border-0 bg-transparent p-0 text-emp-text hover:bg-emp-raised disabled:cursor-not-allowed disabled:opacity-55",
  onboardingPacketIconBtnPlaceholder: "inline-block size-[2rem] shrink-0",
  onboardingPacketDownload:
    "inline-flex min-h-[2.2rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.45rem] border border-emp-line bg-[color-mix(in_srgb,var(--employees-accent-soft)_70%,white)] px-[0.85rem] py-[0.35rem] text-[0.85rem] font-semibold text-emp-text hover:border-emp-accent hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55",
  onboardingPacketUpload:
    "inline-flex min-h-[2.2rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.45rem] border border-emp-accent bg-emp-accent px-[0.85rem] py-[0.35rem] text-[0.85rem] font-semibold text-emp-on-accent disabled:cursor-not-allowed disabled:opacity-55",
  onboardingPacketVersionList: "m-0 grid list-none gap-[0.55rem] p-0",
  onboardingPacketVersionRow:
    "flex flex-wrap items-center justify-between gap-[0.75rem] rounded-[0.55rem] border border-emp-line bg-emp-raised px-[0.85rem] py-[0.7rem]",
  onboardingPacketVersionMeta: "grid min-w-0 flex-1 gap-[0.15rem]",
  onboardingPacketVersionTitle:
    "m-0 flex flex-wrap items-baseline gap-x-[0.45rem] gap-y-[0.1rem] text-[0.88rem] font-semibold text-emp-text",
  onboardingPacketVersionFile: "font-medium text-emp-muted",
  onboardingPacketVersionDate: "m-0 text-[0.85rem] text-emp-muted",
  onboardingPacketVersionActions:
    "inline-flex shrink-0 items-center gap-[0.15rem]",
  profileCard:
    "rounded-[0.85rem] border border-emp-line bg-emp-surface px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
  profileCardElevated:
    "rounded-[0.75rem] border border-emp-line bg-emp-surface px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08)]",
  profileCardBlock:
    "scroll-mt-6 grid gap-3 border-t border-emp-border py-5 first:border-t-0 first:pt-0 last:pb-0",
  profileCardLede: "m-0 text-[0.85rem] text-emp-muted",
  profileInnerCard:
    "grid gap-4 rounded-[0.7rem] border border-emp-line bg-emp-surface px-4 py-4",
  profileInnerCardTitle: "m-0 text-[0.95rem] font-bold text-emp-text",
  profileInnerCardHeader: "flex items-start justify-between gap-3",
  profileAddRow:
    "flex w-full cursor-pointer items-center justify-center gap-2 rounded-[0.7rem] border border-dashed border-emp-line bg-transparent px-4 py-3 text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-emp-line disabled:hover:bg-transparent disabled:hover:text-emp-text",
  skillsHeader:
    "flex flex-wrap items-start justify-between gap-3",
  skillsHeaderCopy: "grid min-w-0 gap-1",
  skillsHeaderActions: "flex shrink-0 flex-wrap items-center justify-end gap-2",
  /** Profile tab section title — shared by Skills, Onboarding, Assets, etc. */
  sectionHeaderTitle:
    "m-0 text-[1.15rem] font-bold tracking-tight text-emp-text",
  skillsHeaderTitle: "m-0 text-[1.15rem] font-bold tracking-tight text-emp-text",
  skillsHeaderLede: "m-0 text-[0.88rem] leading-normal text-emp-muted",
  skillsAddBtn:
    "inline-flex min-h-[2.2rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[0.45rem] border border-emp-line bg-emp-surface px-3.5 py-[0.35rem] text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-emp-line disabled:hover:bg-emp-surface disabled:hover:text-emp-text",
  skillsTableWrap: "overflow-x-auto",
  skillsTable:
    "w-full min-w-[44rem] table-fixed border-collapse text-[0.88rem] [&_th]:border-b [&_td]:border-b [&_th]:border-emp-border [&_td]:border-emp-border [&_th]:px-3 [&_td]:px-3 [&_th]:py-3.5 [&_td]:py-3.5 [&_th]:text-left [&_td]:text-left [&_th]:align-middle [&_td]:align-middle [&_td]:min-w-0 [&_thead_th]:text-[0.85rem] [&_thead_th]:font-semibold [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-emp-muted",
  skillsName:
    "m-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-bold text-emp-text",
  skillsColName: "w-[24%]",
  skillsColChoice: "w-[16%] min-w-[8.5rem]",
  skillsColCert: "w-[28%] min-w-[10rem]",
  skillsCellValue: "px-[0.65rem]",
  skillsSelectWrap: "block w-full min-w-0",
  skillsExperience: "text-[0.88rem] text-emp-text",
  skillPill:
    "inline-flex rounded-full bg-emp-raised px-[0.65rem] py-[0.18rem] text-[0.85rem] font-semibold text-emp-text",
  skillPillExpert:
    "inline-flex rounded-full bg-emp-success-soft px-[0.65rem] py-[0.18rem] text-[0.85rem] font-semibold text-emp-success",
  skillPillBeginner:
    "inline-flex rounded-full bg-emp-raised px-[0.65rem] py-[0.18rem] text-[0.85rem] font-semibold text-emp-text",
  skillPillIntermediate:
    "inline-flex rounded-full bg-[rgba(37,99,235,0.12)] px-[0.65rem] py-[0.18rem] text-[0.85rem] font-semibold text-[#1d4ed8]",
  skillsCert:
    "inline-flex w-full max-w-full items-center gap-2 overflow-hidden text-[0.88rem] text-emp-text",
  skillsCertIcon: "mt-0.5 shrink-0 self-start text-[#2563eb]",
  skillsCertCopy: "grid min-w-0 flex-1 gap-0.5",
  skillsCertMeta: "text-[0.85rem] font-medium text-emp-muted",
  skillsCertNone: "italic text-emp-muted",
  skillsCertIconActions: "ml-auto inline-flex shrink-0 items-center gap-0.5",
  skillsCertIconBtn:
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-[0.4rem] border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-raised hover:text-emp-accent",
  skillsActions: "w-[12%] min-w-[4.75rem] !text-right whitespace-nowrap",
  skillsActionRow: "inline-flex items-center justify-end",
  skillsSaveRow: "flex justify-end",
  skillsDialogBody: "grid gap-4",
  skillsDialogField: "grid min-w-0 content-start gap-1.5",
  skillsDialogLabel: "text-[0.85rem] font-semibold text-emp-text",
  skillsDialogOptional: "font-medium text-emp-muted",
  skillsDialogInput:
    "box-border flex h-[2.45rem] min-h-[2.45rem] w-full appearance-none items-center rounded-[0.45rem] border border-emp-line bg-emp-surface px-3 text-[0.9rem] font-semibold leading-[1.25] text-emp-text",
  skillsDialogSplit:
    "grid grid-cols-1 gap-4 min-[28rem]:grid-cols-2",
  skillsCertToggleRow:
    "flex items-center justify-between gap-3",
  skillsCertSwitch:
    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 bg-emp-line p-0 aria-checked:bg-emp-accent after:absolute after:top-[0.15rem] after:left-[0.15rem] after:h-[1.2rem] after:w-[1.2rem] after:rounded-[999px] after:[background:#fff] after:[box-shadow:0_1px_2px_rgba(15,23,42,0.2)] after:[transition:transform_140ms_ease] after:content-[''] aria-checked:after:[transform:translateX(1.25rem)]",
  /** DialogShell `className`s; `!` beats DialogShell's own utilities. */
  skillDialog:
    "w-[min(100%,34rem)]! overflow-visible! [&>div]:overflow-visible emp-skill-dialog-input:box-border emp-skill-dialog-input:flex emp-skill-dialog-input:items-center emp-skill-dialog-input:w-full emp-skill-dialog-input:h-[2.45rem] emp-skill-dialog-input:min-h-[2.45rem] emp-skill-dialog-input:p-[0_0.75rem] emp-skill-dialog-input:text-[color:var(--employees-text,var(--ds-ink))] emp-skill-dialog-input:[font-family:inherit] emp-skill-dialog-input:[font-style:inherit] emp-skill-dialog-input:[font-variant:inherit] emp-skill-dialog-input:[font-stretch:inherit] emp-skill-dialog-input:text-[0.9rem] emp-skill-dialog-input:font-semibold emp-skill-dialog-input:leading-[1.25] emp-skill-dialog-input:[background:var(--employees-surface,var(--ds-paper))] emp-skill-dialog-input:[border:1px_solid_var(--employees-line,var(--ds-border))] emp-skill-dialog-input:rounded-[0.45rem] emp-skill-dialog-date:appearance-none emp-skill-dialog-date:pr-[0.7rem] emp-skill-dialog-date:[color-scheme:light] emp-skill-dialog-date-dark:[color-scheme:dark] emp-skill-dialog-date-edit:flex emp-skill-dialog-date-edit:items-center emp-skill-dialog-date-edit:p-0 emp-skill-dialog-date-indicator:cursor-pointer emp-skill-dialog-date-indicator:opacity-70 emp-skill-dialog-invalid:border-[color:var(--employees-critical,#b91c1c)]",
  profileNoticeDialog: "w-[min(100%,28rem)]!",
  profileNoticeDialogError:
    "border-[rgba(180,35,24,0.35)]! [&>header_h2]:text-[#b42318]! [[data-theme=dark]_&>header_h2]:text-[#fca5a5]!",
  certificatePreviewDialog: "w-[min(100%,56rem)]!",
  certificatePreview:
    "grid min-h-[20rem] max-h-[min(72dvh,40rem)] place-items-stretch overflow-hidden rounded-[0.5rem] [background:var(--employees-surface-raised,var(--app-surface-raised))]",
  certificatePreviewImage:
    "mx-auto my-0 block max-h-[min(72dvh,40rem)] max-w-full object-contain",
  certificatePreviewFrame:
    "h-[min(72dvh,40rem)] min-h-[min(72dvh,40rem)] w-full [border:0] [background:var(--employees-surface-raised,var(--app-surface-raised))]",
  certificatePreviewFallback:
    "grid gap-[0.35rem] p-6 text-center text-[color:var(--employees-text-muted,var(--ds-ink-muted))] [&_p]:m-0",
  skillsDialogCertBlock: "grid gap-3",
  skillsCertRemove:
    "ml-auto shrink-0 cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-2 py-1 text-[0.85rem] font-semibold text-emp-critical hover:bg-[rgba(185,28,28,0.08)]",
  profileStep:
    "grid grid-cols-1 items-start gap-x-8 gap-y-5 min-[40rem]:grid-cols-2 [&_.emp-field>span:first-child]:normal-case [&_.emp-field>span:first-child]:tracking-normal [&_.emp-field>span:first-child]:font-medium",
  profileStepRowLead:
    "col-span-full grid grid-cols-1 items-start gap-x-8 gap-y-5 min-[40rem]:grid-cols-3 [&_.emp-field>span:first-child]:normal-case [&_.emp-field>span:first-child]:tracking-normal [&_.emp-field>span:first-child]:font-medium",
  profileFooter:
    "flex w-full flex-col items-stretch gap-3 bg-transparent p-0",
  wizardFooter:
    "flex flex-wrap items-center justify-end gap-3 border-t border-emp-border pt-[0.35rem]",
  wizardNav: "flex flex-wrap gap-[0.45rem]",
  wizardActions: "flex flex-wrap justify-end gap-[0.45rem]",
  wizardSummary:
    "m-0 grid gap-[0.65rem] [&_dd]:m-0 [&_dd]:font-semibold [&_div]:grid [&_div]:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] [&_div]:gap-x-3 [&_div]:rounded-[0.45rem] [&_div]:border [&_div]:border-emp-line [&_div]:bg-transparent [&_div]:px-[0.8rem] [&_div]:py-[0.7rem] [&_dt]:text-[0.85rem] [&_dt]:text-emp-muted",

  docs: "mt-4 border-t border-emp-border pt-[0.85rem]",
  docsHeader: "mb-[0.55rem] flex items-center justify-between gap-3 [&_h3]:m-0 [&_h3]:text-base",
  docsList: "m-0 grid list-none gap-[0.55rem] p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:justify-between [&_li]:gap-[0.65rem] [&_li]:rounded-[0.45rem] [&_li]:border [&_li]:border-emp-line [&_li]:bg-transparent [&_li]:px-[0.75rem] [&_li]:py-[0.65rem]",
  docsName: "m-0 font-semibold",
  photoControls: "flex flex-col items-center gap-1",
  photoOverlay:
    `absolute -bottom-0.5 -right-0.5 ${zClass.dropdownLocal} flex items-center gap-1`,
  photoOverlayBtn:
    "inline-grid size-7 cursor-pointer place-items-center rounded-full border border-emp-line bg-emp-surface text-emp-text shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_10px_rgba(15,23,42,0.12)] hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent",
  photoAvatarHit:
    `absolute inset-0 ${zClass.local} cursor-pointer rounded-full border-0 bg-transparent p-0`,
  photoEditorDialog:
    "grid w-[min(24rem,100%)] gap-3 rounded-[0.5rem] border-0 bg-emp-surface px-[0.95rem] py-[0.85rem] pb-4 text-emp-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
  photoEditorHint: "m-0 text-[0.85rem] leading-normal text-emp-muted",
  photoEditorStage: "grid justify-items-center py-1",
  photoEditorViewport:
    "relative cursor-grab overflow-hidden rounded-full border border-emp-border bg-emp-raised touch-none select-none active:cursor-grabbing",
  photoEditorImage:
    "pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none",
  photoEditorZoom: "flex items-center gap-2 px-1",
  photoEditorZoomLabel: "m-0 flex min-w-0 flex-1 items-center",
  photoEditorZoomRange:
    "m-0 w-full min-w-0 cursor-pointer accent-emp-accent",
  phoneField:
    `emp-phone-field relative flex h-[2.35rem] min-h-[2.35rem] w-full min-w-0 overflow-visible rounded-[0.45rem] border border-emp-line bg-emp-surface ${PHONE_FIELD_CHROME}`,
  phoneFieldPrefix:
    "relative flex h-full w-[9.75rem] min-w-[9.75rem] shrink-0 items-stretch overflow-visible border-r border-emp-border",
  phoneFieldSelect: "h-full w-full",
  phoneFieldNumber:
    "m-0 min-h-0 min-w-0 flex-1 border-0 bg-transparent px-[0.65rem] text-[0.95rem] font-semibold text-emp-text",
  /**
   * react-phone-input-2 root. `isolate` + local z keeps the closed flag from
   * stacking over in-flow AppSelect menus (Ethnicity, Gender, …).
   */
  phoneInput:
    `emp-react-phone-input relative isolate ${zClass.local} ${PHONE_INPUT_CHROME}`,
  /**
   * Layout `!` overrides; fill/border come from `PHONE_INPUT_CHROME`. Profile
   * forms put the 1px outline on the container (flag + number), not the field.
   */
  phoneInputField:
    "emp-react-phone-input__field !box-border !m-0 !w-full !min-w-0 !overflow-x-auto !overflow-y-hidden !rounded-[0.45rem] !pl-[3.15rem] !pr-[0.65rem] !text-[0.95rem] !font-semibold !leading-[2.35rem] !text-emp-text !tracking-normal",
  phoneInputButton: "emp-react-phone-input__button !border-0",
  phoneInputDropdown: "emp-react-phone-input__dropdown",
  /**
   * `appearance="inline"`: compact 2rem cell editor (project stakeholders). The
   * profile form rules supply the outline; hover/invalid keep their own colors.
   */
  phoneInline: {
    field:
      "block! m-0! gap-0! w-full min-w-0 max-w-full [&>span:first-child:empty]:hidden!",
    container:
      "h-[2rem]! min-h-[2rem]! min-w-0 max-w-full [&:not(:hover):not(:has([aria-invalid=true]))]:border-[#737373]! [&_.selected-flag]:w-[2.45rem]! [&_.selected-flag]:pl-[0.4rem]! [&_.selected-flag_.flag]:left-[0.4rem]! [&_.selected-flag_.arrow]:left-[1.45rem]!",
    button: "w-[2.45rem]!",
    input: "",
    inputEmpty: "",
  },
  /** `appearance="form"`: one outline around flag + number (add-project stakeholders). */
  phoneForm: {
    field:
      "col-auto w-full min-w-0 [&>span:first-child]:text-[0.75rem] [&>span:first-child]:font-medium [&>span:first-child]:normal-case [&>span:first-child]:leading-[1.25] [&>span:first-child]:tracking-normal [&>span:first-child]:text-app-muted",
    container:
      "box-border h-[2.35rem] min-h-[2.35rem] min-w-0 overflow-hidden! rounded-[0.45rem] border border-[#737373] bg-app-surface focus-within:overflow-visible! focus-within:border-app-accent focus-within:[box-shadow:0_0_0_2px_var(--ds-accent-ring)] [&:has(.flag-dropdown.open)]:overflow-visible! [&_.selected-flag]:w-[2.75rem]! [&_.selected-flag]:pl-[0.5rem]! [&_.selected-flag]:bg-app-surface! [&_.selected-flag_.flag]:left-[0.45rem]! [&_.selected-flag_.arrow]:left-[1.55rem]!",
    button: "w-[2.75rem]! bg-app-surface!",
    input:
      "h-full! min-h-0! bg-app-surface! [border:0]! [box-shadow:none]! [-webkit-text-fill-color:var(--app-text)]!",
    inputEmpty:
      "h-full! min-h-0! bg-app-surface! [border:0]! [box-shadow:none]! [-webkit-text-fill-color:var(--app-text-muted)]!",
  },
  profileCardEdit: profileShellUi.profileCardEdit,
  profileCardEditActive: profileShellUi.profileCardEditActive,

  notice:
    "flex flex-wrap items-center justify-between gap-[0.65rem] rounded-[0.45rem] border-0 border-l-[3px] border-l-emp-accent bg-emp-accent-soft px-[0.85rem] py-[0.7rem] [&_p]:m-0",
  profileReview:
    "my-3 rounded-[0.5rem] border border-emp-border bg-[rgba(15,23,42,0.03)] px-4 py-[0.85rem]",
  profileReviewTitle: "mb-[0.65rem] mt-0 text-[0.95rem]",
  profileReviewGrid: "mb-3 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3",
  profileReviewBlock:
    "mt-1 mb-0 whitespace-pre-wrap rounded-[0.35rem] border border-emp-border bg-emp-surface px-[0.65rem] py-2 font-inherit text-[0.85rem] leading-[1.35]",

  toast:
    `pointer-events-auto relative ${zClass.toast} grid max-w-[min(20rem,70vw)] grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 rounded-[0.5rem] border border-emp-border bg-emp-surface px-[0.8rem] py-[0.65rem] text-emp-text opacity-100 shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-[opacity,transform] duration-300 ease-in-out`,
  toastLeaving: "pointer-events-none translate-y-[0.35rem] opacity-0",
  toastFallback: `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${zClass.toast}`,
  toastMessage: "m-0 pr-[0.15rem] text-[0.88rem] leading-[1.35]",
  toastClose:
    "mt-[-0.2rem] mr-[-0.2rem] inline-grid size-[1.6rem] cursor-pointer place-items-center rounded-[0.3rem] border-0 bg-transparent p-0 text-emp-muted hover:bg-emp-accent-soft hover:text-emp-text focus-visible:bg-emp-accent-soft focus-visible:text-emp-text focus-visible:outline-none",

  select: "relative w-full min-w-0",
  selectOpen: `relative ${zClass.dropdown} w-full min-w-0`,
  selectCompact: "h-full w-full",
  selectTrigger:
    "m-0 box-border flex h-[2.35rem] min-h-[2.35rem] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[0.45rem] border border-emp-line bg-emp-surface px-[0.65rem] text-left text-[0.95rem] font-semibold leading-tight text-emp-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus disabled:cursor-not-allowed disabled:bg-emp-raised disabled:text-emp-muted disabled:opacity-70",
  selectTriggerEmpty:
    "m-0 box-border flex h-[2.35rem] min-h-[2.35rem] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[0.45rem] border border-emp-line bg-emp-surface px-[0.65rem] text-left text-[0.95rem] font-normal leading-tight text-emp-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus disabled:cursor-not-allowed disabled:bg-emp-raised disabled:opacity-70",
  selectTriggerCompact:
    "m-0 box-border flex h-full min-h-0 w-full cursor-pointer items-center justify-between gap-1 rounded-none border-0 bg-transparent px-2.5 text-left text-[0.88rem] font-semibold leading-tight text-emp-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emp-focus disabled:cursor-not-allowed disabled:text-emp-muted disabled:opacity-45",
  selectValue: "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
  selectPlaceholder: "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-normal italic text-emp-muted",
  selectChevron: "size-[0.75rem] h-2 w-3 shrink-0 text-emp-muted transition-transform duration-[120ms] ease-in-out",
  selectChevronEmpty: "size-[0.75rem] h-2 w-3 shrink-0 text-emp-accent transition-transform duration-[120ms] ease-in-out",
  selectChevronOpen: "size-[0.75rem] h-2 w-3 shrink-0 rotate-180 text-emp-muted transition-transform duration-[120ms] ease-in-out",
  selectRequired:
    "pointer-events-none absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 opacity-0 [clip:rect(0,0,0,0)]",
  selectMenu:
    `fixed ${zClass.menu} m-0 max-h-56 list-none overflow-auto rounded-[0.5rem] border border-emp-line bg-emp-surface p-[0.3rem] text-emp-text shadow-[0_0.45rem_1.1rem_rgba(15,23,42,0.12)]`,
  selectOption:
    "m-0 block w-full cursor-pointer rounded-[0.35rem] border-0 bg-transparent px-[0.6rem] py-2 text-left text-inherit hover:bg-emp-accent-soft hover:text-emp-accent",
  selectOptionSelected:
    "m-0 block w-full cursor-pointer rounded-[0.35rem] border-0 bg-emp-accent-soft px-[0.6rem] py-2 text-left text-emp-accent",

  systemAccount: "grid w-full min-w-0 gap-4",
  systemAccountHeader:
    "flex flex-wrap items-center justify-between gap-x-5 gap-y-[0.65rem]",
  systemAccountHeaderMain:
    "flex min-w-0 flex-wrap items-center gap-[0.65rem]",
  systemAccountAvatar:
    "inline-grid size-[2.35rem] shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--ds-accent-ring)] bg-emp-accent-soft text-[0.85rem] font-extrabold text-emp-accent",
  systemAccountName:
    "m-0 text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] text-emp-text",
  systemAccountBadge:
    "inline-flex rounded-full bg-emp-accent-soft px-[0.4rem] py-[0.1rem] text-[0.85rem] font-semibold uppercase leading-tight tracking-[0.04em] text-emp-accent",
  systemAccountCopy: "m-0 text-[0.9rem] leading-[1.45] text-emp-muted",
  systemAccountBody: "grid gap-4",
  systemAccountSection:
    "m-0 grid min-w-0 gap-[0.95rem] rounded-[0.7rem] border border-emp-border bg-emp-raised px-[1.15rem] pb-[1.2rem] pt-[1.05rem] [&_legend]:col-span-full [&_legend]:float-none [&_legend]:m-0 [&_legend]:w-full [&_legend]:border-0 [&_legend]:p-0 [&_legend]:text-[0.95rem] [&_legend]:font-bold [&_legend]:tracking-[-0.015em] [&_legend]:text-emp-text",
  systemAccountGrid:
    "col-span-full grid min-w-0 grid-cols-1 gap-x-4 gap-y-[0.85rem] min-[40rem]:grid-cols-2",
  systemAccountField: "grid min-w-0 content-start gap-[0.3rem]",
  systemAccountFieldLabel:
    "text-[0.85rem] font-medium leading-[1.25] text-emp-muted",
  systemAccountFieldValue:
    "m-0 min-w-0 border-0 bg-transparent text-[0.95rem] font-semibold leading-[1.35] text-emp-text [overflow-wrap:anywhere]",
  systemAccountRoleCode:
    "mt-[0.12rem] block font-mono text-[0.85rem] font-semibold tracking-[0.02em] text-emp-muted",
} as const;

export function chipTabClass(active: boolean): string {
  return active ? ui.chipTabActive : ui.chipTab;
}

export function employeeStatusClass(status: string): string {
  const key = status.toLowerCase();
  if (key === "pending" || key === "new") {
    return cx(ui.status, ui.statusPending);
  }
  if (key === "active") {
    return cx(ui.status, ui.statusActive);
  }
  if (key === "rejected" || key === "inactive") {
    return cx(ui.status, ui.statusInactive);
  }
  return ui.status;
}

export function btnGhostCompact(): string {
  return cx(ui.btnGhost, ui.btnCompact);
}

export function btnPrimaryCompact(): string {
  return cx(ui.btnPrimary, ui.btnCompact);
}
