import { zClass } from "@/ui/zIndex";

/** Hover copy for clickable directory / entity cards. */
export const CLICK_TO_VIEW_HINT = "Click to view";

export type AppHoverHintAlign = "start" | "center" | "end";

export interface AppHoverHintProps {
  readonly label: string;
  readonly align?: AppHoverHintAlign;
}

const EDGE_CLASS: Record<AppHoverHintAlign, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

const CARET_CLASS: Record<AppHoverHintAlign, string> = {
  start: "left-[0.7rem]",
  center: "left-1/2 -translate-x-1/2",
  end: "right-[0.55rem]",
};

/**
 * Surface tooltip that appears on `group-hover`. Put `group relative
 * overflow-visible` on the clickable card (or heading).
 */
export function AppHoverHint({
  label,
  align = "center",
}: AppHoverHintProps) {
  return (
    <span
      role="tooltip"
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-full mb-[0.45rem] ${EDGE_CLASS[align]} ${zClass.tooltip} invisible whitespace-nowrap rounded-[0.5rem] border-0 bg-emp-surface px-[0.6rem] py-[0.35rem] text-[0.85rem] font-medium leading-snug text-emp-text opacity-0 shadow-[0_6px_18px_rgba(15,23,42,0.16)] transition-[opacity,visibility] delay-0 duration-75 group-hover:visible group-hover:opacity-100 group-hover:delay-300`}
    >
      {label}
      <span
        className={`absolute top-full ${CARET_CLASS[align]} mt-[-5px] size-[0.5rem] rotate-45 border-b border-r border-emp-line bg-emp-surface`}
        aria-hidden="true"
      />
    </span>
  );
}

/** Shared “Click to view” hint for directory cards across modules. */
export function ClickToViewHint({
  align = "center",
}: {
  readonly align?: AppHoverHintAlign;
}) {
  return <AppHoverHint label={CLICK_TO_VIEW_HINT} align={align} />;
}
