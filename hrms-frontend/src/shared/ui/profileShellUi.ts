/** Shared profile hero + tab chrome (employee / client profile pages). */

import { PROFILE_FORM_CHROME } from "@/shared/ui/fieldChrome";
import {
  editIconButton,
  editIconButtonActive,
} from "@/shared/ui/sharedUiClasses";

export function profileCx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

export const profileShellUi = {
  page: `grid min-w-0 max-w-full gap-4 border-0 bg-transparent p-0 ${PROFILE_FORM_CHROME}`,
  backRow: "flex flex-wrap items-center gap-2",
  backBtn:
    "inline-flex min-h-[2.15rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.4rem] border border-emp-line bg-emp-surface px-[0.75rem] py-[0.32rem] text-[0.85rem] font-medium text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent",
  profileHero:
    "relative grid gap-4 rounded-[0.75rem] border border-emp-line bg-emp-surface px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08)]",
  profileHeroRow: "flex min-w-0 flex-wrap items-start gap-4",
  profileHeroAvatarCol: "grid shrink-0 justify-items-center",
  profileHeroAvatarWrap: "relative size-[5.5rem] shrink-0",
  profileHeroAvatar:
    "inline-grid size-full place-items-center overflow-hidden rounded-full border border-emp-border bg-emp-accent-soft text-[1.35rem] font-extrabold text-emp-accent",
  profileHeroPhoto: "size-full object-cover",
  profileHeroBody: "grid min-w-0 flex-1 gap-[0.35rem] pt-[0.15rem]",
  profileHeroName:
    "m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[1.45rem] font-extrabold leading-tight text-emp-text",
  profileHeroRole: "m-0 text-[0.92rem] leading-snug text-emp-muted",
  profileHeroMeta:
    "m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] leading-snug text-emp-muted",
  profileHeroMetaItem: "inline-flex min-w-0 items-center gap-[0.35rem]",
  profileHeroMetaIcon: "shrink-0 text-emp-muted",
  profileHeroPills: "mt-1 flex flex-wrap items-center gap-2",
  profileHeroPill:
    "inline-flex max-w-full items-center gap-[0.4rem] rounded-full bg-emp-raised px-[0.7rem] py-[0.28rem] text-[0.85rem] font-semibold text-emp-text",
  profileHeroPillButton:
    "inline-flex max-w-full cursor-pointer items-center gap-[0.4rem] rounded-full border-0 bg-emp-raised px-[0.7rem] py-[0.28rem] text-[0.85rem] font-semibold text-emp-text hover:bg-emp-accent-soft hover:text-emp-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-accent",
  profileHeroPillIcon: "shrink-0 text-emp-muted",
  profileTabsRow:
    "flex items-end justify-between gap-3 border-b border-emp-border",
  profileTabs:
    "m-0 flex min-w-0 flex-1 list-none gap-1 overflow-x-auto border-0 p-0",
  profileTab:
    "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-[0.7rem] text-emp-muted hover:text-emp-text",
  profileTabActive:
    "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-none border-0 border-b-2 border-emp-accent bg-transparent px-3 py-[0.7rem] text-emp-text",
  panel: "grid min-w-0 max-w-full gap-4 pt-[0.85rem]",
  sectionStack: "grid gap-4",
  sectionBar: "flex flex-wrap items-center justify-between gap-2",
  sectionTitle: "m-0 text-[1.3rem] font-bold text-emp-text",
  profileCardEdit: editIconButton,
  profileCardEditActive: editIconButtonActive,
  actions: "flex flex-wrap justify-end gap-[0.45rem]",
  btnPrimary:
    "inline-flex min-h-[2.35rem] cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.45rem] border border-emp-accent bg-emp-accent px-[1rem] py-[0.4rem] text-emp-on-accent hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55",
  btnGhost:
    "inline-flex min-h-[2.35rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.4rem] border border-emp-line bg-emp-surface px-[0.85rem] py-[0.35rem] text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-55",
  error:
    "m-0 rounded-[0.45rem] border-0 border-l-[3px] border-l-emp-critical bg-[rgba(185,28,28,0.12)] px-[0.85rem] py-[0.7rem] text-[0.88rem] leading-[1.35] text-emp-critical",
  muted: "m-0 text-[0.85rem] text-emp-muted",
  projectPicker:
    "m-0 grid list-none gap-2 border-0 p-0 sm:grid-cols-2 lg:grid-cols-3",
  projectPickerItem:
    "cursor-pointer rounded-[0.55rem] border border-emp-line bg-emp-surface px-3 py-2.5 text-left hover:border-emp-accent hover:bg-emp-accent-soft",
  projectPickerItemActive:
    "cursor-pointer rounded-[0.55rem] border border-emp-accent bg-emp-accent-soft px-3 py-2.5 text-left",
  projectPickerName: "m-0 text-[0.9rem] font-semibold text-emp-text",
  projectPickerMeta: "m-0 mt-0.5 text-[0.85rem] text-emp-muted",
} as const;
