import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function displayDash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

export function profileSelectDisplayLabel(
  value: string,
  options: readonly { readonly value: string; readonly label: string }[],
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Plain label + value (no input chrome), matching employee profile view mode. */
export function ProfileViewField({
  label,
  value,
  className,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
  readonly hint?: ReactNode;
}) {
  const trimmed = value?.trim() ?? "";
  const hasValue = Boolean(trimmed);
  return (
    <div className={cx("grid min-w-0 content-start gap-[0.3rem]", className)}>
      <span className="text-[0.85rem] font-medium leading-[1.25] text-emp-muted">
        {label}
      </span>
      <p
        className={
          hasValue
            ? "m-0 min-w-0 bg-transparent text-[0.95rem] font-semibold leading-[1.35] text-emp-text"
            : "m-0 min-w-0 bg-transparent text-[0.95rem] font-medium leading-[1.35] text-emp-muted"
        }
      >
        {displayDash(value)}
      </p>
      {hint}
    </div>
  );
}
