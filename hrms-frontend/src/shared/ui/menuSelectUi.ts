import { zClass } from "@/ui/zIndex";

/** Compact custom select (Dev account switcher, company picker). */

const MENU_BASE = `absolute ${zClass.shellMenu} grid gap-[0.15rem] rounded-[0.55rem] p-[0.45rem] [font-family:inherit] text-[0.9rem] font-semibold normal-case tracking-[0] text-[color:var(--app-text)] [background:var(--app-surface)] [border:1px_solid_var(--app-border)] [box-shadow:0_10px_28px_rgba(0,0,0,0.35)]`;

const OPTION_BASE =
  "block w-full cursor-pointer rounded-[0.35rem] p-[0.45rem_0.55rem] text-left [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.9rem] font-semibold normal-case tracking-[0] [border:0]";

export const menuSelectUi = {
  root: "app-persona-selector relative grid gap-[0.25rem] text-[0.72rem] font-bold uppercase tracking-[0.04em] text-[color:var(--app-text-muted)]",
  label: "block",
  field:
    "flex w-full min-w-0 cursor-pointer items-center justify-between gap-[0.45rem] rounded-[0.45rem] p-[0.45rem_0.6rem] [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.9rem] font-semibold normal-case tracking-[0] text-[color:var(--app-text)] [background:var(--app-surface)] [border:1px_solid_var(--app-border)] hover:border-[color:var(--app-accent)] focus-visible:[outline:2px_solid_var(--app-accent)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-[0.65] aria-expanded:border-[color:var(--app-accent)]",
  fieldLabel: "min-w-0 truncate text-left",
  chevron: "shrink-0 text-[color:var(--app-text-muted)]",
  trigger:
    "grid size-[2.35rem] cursor-pointer place-items-center rounded-[999px] p-0 text-[color:var(--app-text)] [background:var(--app-surface)] [border:1px_solid_var(--app-border)] hover:border-[color:var(--app-accent)] hover:text-[color:var(--app-accent)] aria-expanded:border-[color:var(--app-accent)] aria-expanded:text-[color:var(--app-accent)]",
  /** Opens below the field, right-aligned. */
  menu: `${MENU_BASE} right-0 top-[calc(100%+0.4rem)] min-w-[11.5rem]`,
  /** Opens above, full width (sidebar footer). */
  menuAbove: `${MENU_BASE} bottom-[calc(100%+0.4rem)] left-0 right-0 top-auto w-full min-w-0`,
  /** Opens below, full width of the field (form controls). */
  menuFullWidth: `${MENU_BASE} left-0 right-auto top-[calc(100%+0.4rem)] w-full min-w-0`,
  menuLabel:
    "m-0 p-[0.25rem_0.45rem_0.4rem] text-[0.7rem] font-bold uppercase tracking-[0.06em] text-[color:var(--app-text-muted)]",
  option: `${OPTION_BASE} text-[color:var(--app-text)] [background:transparent] hover:text-[color:var(--app-accent)] hover:[background:var(--app-accent-soft)]`,
  optionSelected: `${OPTION_BASE} text-[color:var(--app-accent)] [background:var(--app-accent-soft)]`,
} as const;
