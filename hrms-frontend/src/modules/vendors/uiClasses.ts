import { workspaceUi } from "@/shared/ui/workspaceUi";

export { cx } from "@/shared/ui/workspaceUi";

export const ui = {
  ...workspaceUi,
  empty:
    "m-0 rounded-[0.65rem] border border-app-border bg-app-surface p-[1rem] text-app-muted",
  formPageCard: `${workspaceUi.form} ${workspaceUi.formCard}`,
  detailsCardList: "mx-0 mb-0 mt-[0.35rem] pl-[1.1rem]",
  contactRow:
    "grid gap-[0.55rem] border-b border-b-app-border px-0 py-[0.65rem] last-of-type:[border-bottom:0]",
  /**
   * `AppCheckbox` given field chrome. Its own, more specific state utilities
   * still win for checked, hover, and disabled.
   */
  checkboxField:
    "grid! min-w-0 grid-rows-[auto_auto_auto] [align-content:start] gap-[0.3rem]! [&_input]:w-full! [&_input]:min-h-[2.35rem] [&_input]:px-[0.65rem] [&_input]:py-[0.45rem] [&_input]:text-app-text [&_input]:rounded-[0.45rem]! [&_input]:[border-width:1px]! [&_input]:[border-style:solid]! [&_input:not(:checked,:disabled,:hover)]:border-app-border! [&_input:not(:checked,:disabled)]:bg-app-canvas! [&_input]:[background-repeat:repeat]! [&_input]:[background-position:0%_0%]! [&_input]:[background-size:auto]!",
  rowMenuTrigger:
    "inline-grid size-[1.75rem] cursor-pointer place-items-center rounded-[0.5rem] border border-transparent bg-transparent p-0 text-app-muted hover:border-app-border hover:bg-app-raised hover:text-app-text aria-expanded:border-app-border aria-expanded:bg-app-raised aria-expanded:text-app-text",
} as const;

export function vendorStatusClass(status: string): string {
  const tone =
    status === "ACTIVE"
      ? workspaceUi.statusActive
      : status === "INACTIVE"
        ? workspaceUi.statusInactive
        : "";
  return `${workspaceUi.status} ${tone}`.trim();
}
