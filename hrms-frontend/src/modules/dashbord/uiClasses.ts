/** Tailwind classes shared by dashboard panels. */
export const ui = {
  panel: "p-[0.75rem_0.85rem]",
  panelCompact: "p-0",
  panelCard:
    "rounded-[0.5rem] border border-dashboard-line bg-dashboard-surface p-[0.75rem_0.85rem]",
  panelHead: "mb-[0.85rem]",
  panelHeadCompact: "mb-[0.45rem]",
  panelTitle:
    "m-0 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-dashboard-muted",
  /** Chart and workspace panels use a larger sentence-case title. */
  panelTitleStrong:
    "m-0 text-[0.9rem] font-bold normal-case tracking-[0] text-dashboard-text",
  empty:
    "m-0 rounded-[0.4rem] bg-dashboard-raised px-[0.65rem] py-[0.5rem] text-[0.84rem] text-dashboard-muted",
  emptyInline:
    "m-0 flex-[1_1_auto] rounded-[0.4rem] p-0 text-[0.84rem] text-dashboard-muted",
  emptyBlock: "grid gap-[0.5rem]",
  emptyBlockInline: "flex flex-wrap items-center gap-[0.45rem_0.65rem]",
  emptyCta:
    "cursor-pointer justify-self-start rounded-[0.35rem] [border:0] bg-dashboard-accent-soft px-[0.55rem] py-[0.3rem] text-[0.8rem] font-[650] text-dashboard-accent hover:[background:color-mix(in_srgb,var(--dashboard-accent)_16%,transparent)]",
  chartSummary:
    "mt-0 mb-[0.55rem] text-[0.84rem] leading-[1.4] text-dashboard-text",
  chart: "min-h-[220px] w-full",
} as const;
