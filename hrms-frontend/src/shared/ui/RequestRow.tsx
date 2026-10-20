"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Eye } from "lucide-react";

import { AppButton } from "./AppButton";
import { sharedActionsRow } from "./sharedUiClasses";
import { StatusBadge, type StatusTone } from "./StatusBadge";

export interface RequestRowStatus {
  readonly label: string;
  readonly tone?: StatusTone;
}

export type RequestRowLayout = "row" | "stack";

export interface RequestRowProps {
  readonly requester: string;
  readonly requestType: string;
  readonly dateLabel: string;
  readonly valueLabel?: string;
  readonly status: RequestRowStatus;
  readonly summary?: string;
  readonly onOpen?: () => void;
  readonly openLabel?: string;
  readonly onSelect?: () => void;
  readonly selected?: boolean;
  readonly layout?: RequestRowLayout;
  readonly actions?: ReactNode;
  readonly className?: string;
}

/** Dense, domain-neutral row for request and approval queues. */
export function RequestRow({
  requester,
  requestType,
  dateLabel,
  valueLabel,
  status,
  summary,
  onOpen,
  openLabel = "Open request",
  onSelect,
  selected = false,
  layout = "row",
  actions,
  className,
}: RequestRowProps) {
  const selectable = Boolean(onSelect);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onSelect) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <article
      className={[
        "grid min-w-0 gap-[0.85rem] rounded-[0.55rem] p-[0.72rem_0.85rem] text-[color:var(--app-text)] [border-style:solid] [border-width:1px] [@media(max-width:52rem)]:grid-cols-[minmax(0,1fr)_auto]",
        layout === "stack"
          ? "grid-cols-[minmax(0,1fr)] [align-items:start]"
          : "grid-cols-[minmax(10rem,1.1fr)_minmax(12rem,1.8fr)_auto_auto] items-center",
        selected
          ? "border-[color:var(--emp-accent,var(--app-accent))] [background:color-mix(in_srgb,var(--emp-accent,#1f7a4d)_8%,var(--emp-surface,var(--app-surface)))]"
          : "border-[color:var(--app-border)] [background:var(--app-surface)]",
        selectable
          ? "cursor-pointer focus-visible:[outline:2px_solid_var(--app-focus,var(--emp-accent))] focus-visible:outline-offset-2"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${requestType} request from ${requester}`}
      aria-current={selected ? "true" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="grid min-w-0 gap-[0.16rem]">
        <strong>{requester}</strong>
        <span className="text-[0.84rem] text-[color:var(--app-text-muted)]">
          {requestType}
        </span>
      </div>

      <div className="grid min-w-0 gap-[0.16rem] text-[0.84rem] text-[color:var(--app-text-muted)] [@media(max-width:52rem)]:col-span-full">
        <span>{dateLabel}</span>
        {valueLabel ? <span>{valueLabel}</span> : null}
        {summary ? <span className="truncate">{summary}</span> : null}
      </div>

      <StatusBadge label={status.label} tone={status.tone} />

      {onOpen || actions ? (
        <div className={`${sharedActionsRow} [@media(max-width:52rem)]:col-span-full [@media(max-width:52rem)]:justify-start`}>
          {onOpen ? (
            <AppButton
              variant="secondary"
              size="compact"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
            >
              <Eye size={14} aria-hidden="true" />
              {openLabel}
            </AppButton>
          ) : null}
          {actions}
        </div>
      ) : null}
    </article>
  );
}
