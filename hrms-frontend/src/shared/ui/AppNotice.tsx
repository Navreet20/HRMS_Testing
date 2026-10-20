import type { ReactNode } from "react";

import { CloseIcon } from "./icons";

export type AppNoticeTone = "info" | "success" | "warning" | "error";

export interface AppNoticeProps {
  readonly children: ReactNode;
  readonly tone?: AppNoticeTone;
  readonly className?: string;
  readonly onDismiss?: () => void;
}

const TONE_CLASS: Record<AppNoticeTone, string> = {
  info: "border-emp-line bg-emp-raised text-emp-text",
  success: "border-emp-line bg-emp-accent-soft text-emp-text",
  warning: "border-emp-warning/40 bg-emp-warning-soft text-emp-warning",
  error: "border-emp-critical bg-emp-surface text-emp-critical",
};

/** Inline status banner for save/submit/review feedback. */
export function AppNotice({
  children,
  tone = "info",
  className,
  onDismiss,
}: AppNoticeProps) {
  return (
    <div
      className={[
        "m-0 flex items-start gap-[0.65rem] rounded-[0.4rem] border px-[0.85rem] py-[0.55rem] text-[0.85rem]",
        TONE_CLASS[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="min-w-0 flex-1 leading-[1.45]">{children}</span>
      {onDismiss ? (
        <button
          type="button"
          className="inline-grid size-[1.6rem] shrink-0 cursor-pointer place-items-center rounded-[0.3rem] border-0 bg-transparent p-0 text-current opacity-70 hover:bg-emp-raised hover:opacity-100"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}
