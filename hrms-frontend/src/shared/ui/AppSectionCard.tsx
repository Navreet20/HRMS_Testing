"use client";

import { useId, type FormEvent, type ReactNode } from "react";

import { PencilIcon } from "./icons";
import {
  sectionEditButton,
  sharedActionsRow,
  sharedButton,
  sharedButtonPrimary,
} from "./sharedUiClasses";

const STACK = "grid min-w-0 gap-[1rem]";

export interface AppSectionEditProps {
  readonly editing?: boolean;
  readonly onEdit?: () => void;
  readonly editLabel?: string;
  readonly stopEditLabel?: string;
}

export interface AppSectionEditButtonProps extends AppSectionEditProps {
  readonly onClick: () => void;
  /** Noun used to build "Edit {label}" / "Stop editing {label}". */
  readonly label: string;
  readonly disabled?: boolean;
}

export interface AppSectionCardProps extends AppSectionEditProps {
  /** Leave out when the page heading above already names the section. */
  readonly title?: string;
  /** Short line directly under the title. */
  readonly description?: ReactNode;
  readonly titleId?: string;
  readonly headingLevel?: "h2" | "h3";
  readonly as?: "section" | "article";
  readonly id?: string;
  readonly role?: string;
  readonly "aria-labelledby"?: string;
  readonly "aria-label"?: string;
  readonly className?: string;
  readonly bodyClassName?: string;
  /** Extra header controls after the pencil (e.g. Add Skill). */
  readonly headerEnd?: ReactNode;
  readonly children: ReactNode;
  readonly onSave?: (event: FormEvent<HTMLFormElement>) => void;
  readonly onCancel?: () => void;
  readonly saving?: boolean;
  readonly saveLabel?: string;
  readonly cancelLabel?: string;
  readonly saveDisabled?: boolean;
}

function joinClassNames(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Shared in-page section chrome: title, edit pencil, view/edit slot, optional Save.
 * Pencil color is `currentColor` from `--app-edit-icon` (blue across HRMS).
 */
export function AppSectionEditButton({
  editing = false,
  onClick,
  label,
  editLabel,
  stopEditLabel,
  disabled = false,
}: AppSectionEditButtonProps) {
  const ariaLabel = editing
    ? (stopEditLabel ?? `Stop editing ${label}`)
    : (editLabel ?? `Edit ${label}`);

  return (
    <button
      type="button"
      className={`app-section-card__edit ${sectionEditButton}`}
      aria-label={ariaLabel}
      aria-pressed={editing}
      onClick={onClick}
      disabled={disabled}
    >
      <PencilIcon />
    </button>
  );
}

export function AppSectionCard({
  title,
  description,
  titleId,
  headingLevel = "h2",
  as: Root = "section",
  id,
  role,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
  className,
  bodyClassName,
  headerEnd,
  children,
  editing = false,
  onEdit,
  editLabel,
  stopEditLabel,
  onSave,
  onCancel,
  saving = false,
  saveLabel = "Save changes",
  cancelLabel = "Cancel",
  saveDisabled = false,
}: AppSectionCardProps) {
  const generatedTitleId = useId();
  const headingId = titleId ?? generatedTitleId;
  const Heading = headingLevel;
  const showEdit = Boolean(onEdit);
  const showActions = Boolean(editing && onSave);
  const labelledBy =
    ariaLabelledBy ?? (ariaLabel || !title ? undefined : headingId);

  const titleNode = (
    <Heading
      id={headingId}
      className="m-0 text-[1.15rem] font-bold leading-[1.25] tracking-[-0.01em] text-[color:var(--app-text,var(--ds-ink))]"
    >
      {title}
    </Heading>
  );
  const heading = description ? (
    <div className="grid min-w-0 gap-1">
      {titleNode}
      <p className="m-0 max-w-[70ch] text-[0.85rem] leading-normal text-emp-muted">{description}</p>
    </div>
  ) : (
    titleNode
  );

  const header =
    !title && !showEdit && !headerEnd ? null : (
    <header className="flex items-start justify-between gap-[0.75rem]">
      {title ? heading : <span />}
      {showEdit || headerEnd ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-[0.5rem]">
          {onEdit ? (
            <AppSectionEditButton
              editing={editing}
              onClick={onEdit}
              label={title ?? "section"}
              editLabel={editLabel}
              stopEditLabel={stopEditLabel}
              disabled={saving}
            />
          ) : null}
          {headerEnd}
        </div>
      ) : null}
    </header>
    );

  const body = (
    <div className={bodyClassName ?? STACK}>{children}</div>
  );

  const actions = showActions ? (
    <div className={`mt-[0.35rem] ${sharedActionsRow}`}>
      {onCancel ? (
        <button
          type="button"
          className={sharedButton}
          onClick={onCancel}
          disabled={saving}
        >
          {cancelLabel}
        </button>
      ) : null}
      <button
        type="submit"
        className={sharedButtonPrimary}
        disabled={saving || saveDisabled}
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  ) : null;

  return (
    <Root
      id={id}
      className={joinClassNames(
        "grid min-w-0 gap-[1rem] rounded-[0.75rem] p-[1.25rem] text-[color:var(--app-text,var(--ds-ink))] [background:var(--app-surface,var(--ds-paper))] [border:1px_solid_var(--app-border,var(--ds-border))] [box-shadow:0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.08)]",
        className,
      )}
      role={role}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
    >
      {header}
      {showActions ? (
        <form
          className={`app-section-card__form ${STACK}`}
          onSubmit={(event) => {
            event.preventDefault();
            onSave?.(event);
          }}
        >
          {body}
          {actions}
        </form>
      ) : (
        body
      )}
    </Root>
  );
}
