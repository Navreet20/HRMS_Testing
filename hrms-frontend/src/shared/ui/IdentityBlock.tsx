import type { ReactNode } from "react";

export interface IdentityBlockProps {
  readonly name: string;
  /** Official Active-only id (e.g. EMP10001). Prefer over code when present. */
  readonly businessEmployeeId?: string | null;
  readonly employeeCode?: string;
  readonly designation?: string;
  readonly department?: string;
  readonly company?: string;
  readonly status?: ReactNode;
  readonly className?: string;
  /** Object URL for profile photo; when set, shown instead of initials. */
  readonly photoSrc?: string | null;
}

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}

/** Compact, read-only identity summary shared by employee-facing surfaces. */
export function IdentityBlock({
  name,
  businessEmployeeId,
  employeeCode,
  designation,
  department,
  company,
  status,
  className,
  photoSrc,
}: IdentityBlockProps) {
  const details = (
    [
      [
        "businessEmployeeId",
        businessEmployeeId?.trim()
          ? `ID: ${businessEmployeeId.trim()}`
          : undefined,
      ],
      ["employeeCode", employeeCode],
      ["designation", designation],
      ["department", department],
      ["company", company],
    ] as const
  ).filter(
    (
      entry,
    ): entry is readonly [
      | "businessEmployeeId"
      | "employeeCode"
      | "designation"
      | "department"
      | "company",
      string,
    ] => Boolean(entry[1]?.trim()),
  );

  return (
    <div
      className={[
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.75rem] rounded-[0.65rem] p-[0.75rem_0.85rem] text-[color:var(--app-text)] [background:var(--app-surface-raised)] [border:1px_solid_var(--app-border)] [@media(max-width:36rem)]:grid-cols-[auto_minmax(0,1fr)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${name} identity`}
    >
      <span
        className="inline-grid size-[2.6rem] place-items-center overflow-hidden rounded-[50%] text-[0.82rem] font-extrabold text-[color:var(--app-accent)] [background:var(--app-accent-soft)] [border:1px_solid_var(--app-accent-border)]"
        aria-hidden="true"
      >
        {photoSrc ? (
          <img className="h-full w-full object-cover" src={photoSrc} alt="" />
        ) : (
          initialsFor(name)
        )}
      </span>
      <div className="grid min-w-0 gap-[0.18rem]">
        <strong className="truncate">{name}</strong>
        {details.length > 0 ? (
          <span
            className="flex flex-wrap gap-[0.2rem_0.45rem] text-[0.82rem] leading-[1.35] text-[color:var(--app-text-muted)] [&>span+span]:before:mr-[0.45rem] [&>span+span]:before:content-['·']"
            data-identity-details=""
          >
            {details.map(([field, value]) => (
              <span key={field}>{value}</span>
            ))}
          </span>
        ) : null}
      </div>
      {status ? (
        <div className="justify-self-end [@media(max-width:36rem)]:col-[2] [@media(max-width:36rem)]:justify-self-start">
          {status}
        </div>
      ) : null}
    </div>
  );
}
