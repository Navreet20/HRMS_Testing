import type { ReactNode } from "react";

interface DirectoryEmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}

/** Shared empty/filtered directory body used across list pages. */
export function DirectoryEmptyState({
  icon,
  title,
  message,
  action,
}: DirectoryEmptyStateProps) {
  return (
    <div
      className="m-[0_auto] grid max-w-[24rem] justify-items-center gap-[0.45rem] p-[0.25rem_1rem] text-center"
      role="status"
    >
      <span className="mb-[0.15rem] grid size-[3rem] place-items-center rounded-[999px] text-[color:var(--app-accent)] [background:var(--app-accent-soft)]">
        {icon}
      </span>
      <p className="m-0 text-[0.98rem] font-semibold text-[color:var(--app-text)]">
        {title}
      </p>
      <p className="m-0 text-[0.84rem] leading-[1.45] text-[color:var(--app-text-muted)]">
        {message}
      </p>
      {action ? <div className="mt-[0.25rem]">{action}</div> : null}
    </div>
  );
}
