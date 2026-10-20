/** App shell (sidebar, header) class groups. Sidebar context is resolved in JS, not by ancestor selectors. */

/** App-wide focus outline; sorts after `focus-visible:` utilities, so it wins equal-specificity ties. */
export const shellFocusRing =
  "[&_:focus-visible]:[outline:3px_solid_var(--app-focus)] [&_:focus-visible]:[outline-offset:2px]";

export type SidebarLinkState = "idle" | "active" | "disabled";

interface SidebarLinkOptions {
  readonly state: SidebarLinkState;
  readonly collapsed?: boolean;
  /** Row inside a nested folder list (Company Setup, Employee Portal). */
  readonly inTree?: boolean;
  /** Folder toggle row (label grows, chevron trails). */
  readonly folder?: boolean;
}

const LINK_BASE =
  "flex w-full max-w-full min-w-0 items-center gap-[0.7rem] text-left no-underline [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.95rem] [border:0] [box-shadow:none] [&&]:focus-visible:[box-shadow:inset_0_0_0_2px_var(--app-accent-border)] [&&]:focus-visible:[outline:none]";

const LINK_STATE: Record<SidebarLinkState, string> = {
  idle: "cursor-pointer font-medium text-[color:var(--app-nav-ink)] [background:transparent] hover:text-[color:var(--app-text)] hover:[background:var(--app-nav-active-soft)]",
  active:
    "app-sidebar__link--active cursor-pointer font-semibold text-[color:var(--app-nav-active)] [background:var(--app-nav-active-fill)]",
  disabled:
    "app-sidebar__link--disabled cursor-not-allowed font-medium text-[color:var(--app-nav-ink)] opacity-[0.62] [background:transparent]",
};

export function sidebarLinkClass({
  state,
  collapsed = false,
  inTree = false,
  folder = false,
}: SidebarLinkOptions): string {
  const layout = collapsed
    ? "min-h-[2.9rem] w-[2.9rem] justify-center rounded-[0.7rem] p-[0.5rem]"
    : [
        "rounded-[0.7rem]",
        inTree ? "min-h-[2rem] p-[0.62rem_0.7rem_0.62rem_0.55rem]" : "p-[0.62rem_0.7rem]",
        folder ? "justify-start" : "",
      ].join(" ");
  return `${LINK_BASE} ${LINK_STATE[state]} ${layout}`;
}

export function sidebarLinkIconClass(collapsed: boolean): string {
  return collapsed
    ? "m-0 grid size-[1.5rem] shrink-0 place-items-center [color:inherit]"
    : "grid size-[1.15rem] shrink-0 place-items-center [color:inherit]";
}

export function sidebarLinkCopyClass(collapsed: boolean): string {
  return collapsed ? "hidden" : "flex min-w-0 flex-1 items-center gap-[0.4rem]";
}

export function sidebarLinkLabelClass({
  collapsed = false,
  inTree = false,
  folder = false,
}: {
  readonly collapsed?: boolean;
  readonly inTree?: boolean;
  readonly folder?: boolean;
}): string {
  if (collapsed) {
    return "app-sidebar__link-label hidden";
  }
  return [
    "app-sidebar__link-label min-w-0 truncate",
    folder ? "flex-1" : "",
    inTree ? "text-[0.92em]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function sidebarFolderChevronClass(open: boolean, collapsed: boolean): string {
  if (collapsed) {
    return "hidden";
  }
  return `ml-auto grid place-items-center [color:inherit] [transition:transform_140ms_ease] ${
    open ? "[transform:rotate(180deg)]" : "[transform:rotate(90deg)]"
  }`;
}

/** Nested folder list (`ul`). */
export function sidebarTreeClass(collapsed: boolean): string {
  return collapsed
    ? "m-[0.1rem_0_0.15rem_0] grid w-full list-none justify-items-center gap-[0.12rem] p-0 [border-left:0]"
    : "m-[0.1rem_0_0.15rem_1.5rem] grid w-auto list-none gap-[0.12rem] p-0";
}

export const sidebarListItem = "w-full min-w-0";

export const sidebarBadge =
  "inline-flex min-w-[1.1rem] items-center justify-center rounded-[999px] p-[0.12rem_0.32rem] text-[0.68rem] font-bold leading-none text-[color:var(--app-on-accent)] [background:var(--app-accent)]";

export const sidebarStatusBadge =
  "app-sidebar__status-badge inline-flex shrink-0 items-center whitespace-nowrap rounded-[999px] p-[0.12rem_0.38rem] text-[0.62rem] font-[650] leading-none tracking-[0.01em] text-[color:var(--app-text-muted)] [background:color-mix(in_srgb,var(--app-text-muted)_12%,transparent)] [border:1px_solid_var(--app-border)]";
