/** Class groups shared by several shared/ui components and module dialogs. */

const FOCUS_RING =
  "focus-visible:[outline:2px_solid_var(--app-focus)] focus-visible:outline-offset-2";

const BUTTON_BASE = `inline-flex min-h-[2.25rem] cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.45rem] p-[0.42rem_0.78rem] [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.86rem] font-bold [border-style:solid] [border-width:1px] enabled:hover:border-[color:var(--app-accent-border)] ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-[0.58]`;

/** Neutral dialog/footer button (Cancel, Close). */
export const sharedButton = `${BUTTON_BASE} text-[color:var(--app-text)] [background:var(--app-surface)] border-[color:var(--app-border)]`;

/** Accent-filled confirm button. */
export const sharedButtonPrimary = `${BUTTON_BASE} text-[color:var(--app-on-accent)] [background:var(--app-accent)] border-[color:var(--app-accent)]`;

/** Destructive confirm button. */
export const sharedButtonDanger = `${BUTTON_BASE} text-[#ffffff] [background:#b42318] border-[color:#b42318]`;

export const sharedButtonTone = {
  primary: sharedButtonPrimary,
  danger: sharedButtonDanger,
} as const;

/** Right-aligned wrapping row of action buttons. */
export const sharedActionsRow =
  "flex flex-wrap items-center justify-end gap-[0.55rem]";

const EDIT_ICON_BASE =
  "inline-flex size-[2rem] shrink-0 cursor-pointer items-center justify-center rounded-[0.35rem] p-0 [border:0] focus-visible:[outline:2px_solid_var(--app-edit-icon)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:[color:currentColor]";

const EDIT_ICON_STATES =
  "enabled:hover:text-[color:var(--app-edit-icon-hover)] enabled:hover:[background:var(--app-edit-icon-soft)]";

/** AppSectionCard pencil; pressed looks like hover. */
export const sectionEditButton = `${EDIT_ICON_BASE} ${EDIT_ICON_STATES} text-[color:var(--app-edit-icon)] [background:transparent] aria-pressed:text-[color:var(--app-edit-icon-hover)] aria-pressed:[background:var(--app-edit-icon-soft)]`;

/** Profile-shell pencil (clients, projects, employees review). */
export const editIconButton = `${EDIT_ICON_BASE} ${EDIT_ICON_STATES} text-[color:var(--app-edit-icon)] [background:transparent] [&_svg]:pointer-events-none aria-pressed:[background:var(--app-edit-icon-soft)]`;

export const editIconButtonActive = `${EDIT_ICON_BASE} ${EDIT_ICON_STATES} text-[color:var(--app-edit-icon)] [background:var(--app-edit-icon-soft)] [&_svg]:pointer-events-none`;

export const sharedDialogClose = `inline-grid size-[2rem] min-h-[2rem] cursor-pointer place-items-center rounded-[0.4rem] p-0 text-[color:var(--app-text-muted)] [background:transparent] [border:1px_solid_var(--app-border)] enabled:hover:text-[color:var(--app-text)] enabled:hover:[background:var(--app-surface-raised,#f7f8f8)] ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-[0.58]`;
