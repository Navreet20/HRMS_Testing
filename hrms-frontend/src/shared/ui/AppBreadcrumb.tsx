"use client";

import { ChevronLeft } from "lucide-react";
import { createPortal } from "react-dom";

import { AppBackLink } from "./AppBackLink";
import {
  useShellNavTrailHost,
  type AppNavPlacement,
} from "./shellNavTrail";

export interface AppBreadcrumbItem {
  readonly label: string;
  /** Omit onClick on the current page. */
  readonly onClick?: () => void;
}

export interface AppBreadcrumbProps {
  readonly items: readonly AppBreadcrumbItem[];
  readonly className?: string;
  readonly placement?: AppNavPlacement;
}

const TYPE =
  "[font:inherit] text-[0.86rem] font-medium leading-[1.35]";

const CRUMB_LINK_CLASS =
  `inline-flex max-w-[14rem] cursor-pointer items-center truncate border-0 bg-transparent p-0 ${TYPE} text-emp-muted hover:text-emp-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus`;

const CRUMB_CURRENT_CLASS =
  `max-w-[14rem] truncate ${TYPE} text-emp-text`;

/**
 * Hierarchy trail for 3-level nests (list → record → nested record).
 * Two-level trails render as {@link AppBackLink}. Separators are `/` so the
 * trail uses the same type as the page subtitle, not mixed icon glyphs.
 * Renders in the shell header trail by default.
 */
export function AppBreadcrumb({
  items,
  className,
  placement = "shell",
}: AppBreadcrumbProps) {
  const { host, ready } = useShellNavTrailHost(placement);
  const clickable = items.filter((item) => item.onClick);
  if (items.length <= 2 && clickable.length === 1 && clickable[0]?.onClick) {
    return (
      <AppBackLink
        onClick={clickable[0].onClick}
        className={className}
        placement={placement}
      >
        {clickable[0].label}
      </AppBackLink>
    );
  }

  if (!ready) {
    return null;
  }

  const rootClassName = [
    "m-0 flex min-w-0 flex-wrap items-center gap-x-[0.35rem] gap-y-0 p-0",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const trail = (
    <nav aria-label="Breadcrumb">
      <ol className={rootClassName}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 items-center gap-x-[0.35rem]"
            >
              {index > 0 ? (
                <span className={`${TYPE} text-emp-muted`} aria-hidden="true">
                  /
                </span>
              ) : (
                <ChevronLeft
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 text-emp-muted"
                  aria-hidden="true"
                />
              )}
              {item.onClick && !isLast ? (
                <button
                  type="button"
                  className={CRUMB_LINK_CLASS}
                  onClick={item.onClick}
                  aria-label={`Back to ${item.label}`}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className={CRUMB_CURRENT_CLASS}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );

  return host ? createPortal(trail, host) : trail;
}
