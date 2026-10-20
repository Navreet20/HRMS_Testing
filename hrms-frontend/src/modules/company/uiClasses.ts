import { workspaceUi } from "@/shared/ui/workspaceUi";

const STATUS =
  "inline-flex rounded-[999px] px-[0.4rem] py-[0.1rem] text-[0.72rem] font-semibold";

export const companyUi = {
  /** Unframed root; text fields and comboboxes show their own focus chrome instead of an outline. */
  root: "w-full font-['Segoe_UI','Source_Sans_3',system-ui,sans-serif] text-app-text [&_:focus-visible]:[outline-width:2px]! [&_:is(input,select,textarea,.catalog-control,[role=combobox]):is(:focus,:focus-visible)]:[outline:none]!",
  error: workspaceUi.error,
  notice: workspaceUi.notice,
  noticeText: workspaceUi.noticeText,
  btnGhostCompact: workspaceUi.btnGhostCompact,
  empty:
    "m-0 rounded-[0.65rem] border border-app-border bg-app-surface p-[1rem] text-app-muted",
  srOnly: workspaceUi.srOnly,
  page: "grid gap-[1rem]",
  pageHeader:
    "flex flex-wrap items-center justify-between gap-[0.65rem_1.25rem]",
  pageHeaderMain: "flex min-w-0 flex-wrap items-center gap-[0.65rem]",
  pageTitle:
    "m-0 text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] text-app-text",
  sections: "grid gap-[1rem]",
  statusActive: `${STATUS} bg-[rgba(21,128,61,0.12)] text-module-success`,
  statusInactive: `${STATUS} bg-[rgba(185,28,28,0.12)] text-module-critical`,
  select: "relative grid w-full min-w-0 gap-[0.25rem] normal-case",
} as const;
