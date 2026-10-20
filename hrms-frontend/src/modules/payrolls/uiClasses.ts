import { workspaceUi } from "@/shared/ui/workspaceUi";

export { cx } from "@/shared/ui/workspaceUi";

const CARD = "rounded-[0.65rem] border border-app-border bg-app-surface px-[1rem] py-[0.9rem]";
const SECTION_TITLE = "mx-0 mt-0 mb-[0.7rem] text-[1rem]";

export const ui = {
  ...workspaceUi,
  root: `${workspaceUi.root} [@media(max-width:48rem)]:p-[0.85rem]`,
  modeTabs:
    "mb-[1rem] flex w-fit gap-[0.25rem] rounded-[0.65rem] border border-app-border bg-app-raised p-[0.25rem]",
  modeTab:
    "min-h-[2.25rem] cursor-pointer rounded-[0.45rem] border border-transparent bg-transparent px-[0.75rem] py-[0.4rem] font-bold text-app-muted aria-selected:border-app-border aria-selected:bg-app-surface aria-selected:text-app-text",
  workspace: "grid gap-[1rem]",
  myPayPeriod: "w-[min(100%,28rem)]",
  totals:
    "grid grid-cols-[repeat(3,minmax(0,1fr))] gap-[0.75rem] [@media(max-width:48rem)]:grid-cols-[1fr]",
  total: `grid min-w-0 gap-[0.3rem] ${CARD}`,
  totalNet:
    "grid min-w-0 gap-[0.3rem] rounded-[0.65rem] border border-[color:color-mix(in_srgb,var(--app-accent)_35%,transparent)] bg-app-accent-soft px-[1rem] py-[0.9rem]",
  totalLabel: "text-[0.8rem] font-bold text-app-muted",
  totalValue: "[font-size:clamp(1.1rem,2vw,1.45rem)]",
  sections:
    "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-[0.75rem] [@media(max-width:48rem)]:grid-cols-[1fr]",
  section: CARD,
  sectionTitle: SECTION_TITLE,
  sectionList: "m-0 grid gap-[0.5rem]",
  sectionRow:
    "flex items-center justify-between gap-[1rem] border-b border-b-app-border pb-[0.45rem] last:pb-0 last:font-bold last:[border-bottom:0]",
  sectionTerm: "text-app-muted",
  sectionValue: "m-0 text-right",
  sectionNote: "mx-0 mb-0 mt-[0.7rem] text-[0.82rem] leading-[1.45] text-app-muted",
  history: CARD,
  historyTitle: SECTION_TITLE,
} as const;
