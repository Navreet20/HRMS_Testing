import { StatusBadge } from "../../../shared/ui";
import { catalogUi } from "@/shared/ui/catalogUi";
import {
  displayEmployeeName,
  employeeInitials,
  formatRoleLabel,
  isActiveStatus,
} from "../selectors";
import type { EmployeeSearchHit } from "../types";

interface EmployeeSubjectHeaderProps {
  readonly employee: EmployeeSearchHit;
  readonly summary?: string;
}

export function EmployeeSubjectHeader({
  employee,
  summary,
}: EmployeeSubjectHeaderProps) {
  const active = isActiveStatus(employee.status);
  const code = employee.employeeCode.trim() || "—";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[0.5rem] border border-emp-line bg-emp-raised px-[0.9rem] py-[0.75rem]">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="inline-grid size-10 shrink-0 place-items-center rounded-full bg-emp-accent-soft text-[0.85rem] font-bold text-emp-accent"
          aria-hidden="true"
        >
          {employeeInitials(employee)}
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[0.95rem] font-semibold text-emp-text">
            {displayEmployeeName(employee)}
          </p>
          <p className="m-0 text-[0.85rem] text-emp-muted">
            {code} · {employee.email}
          </p>
          {summary ? (
            <p className={`${catalogUi.fieldHint} mt-1`}>{summary}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={formatRoleLabel(employee.role)} tone="neutral" />
        <StatusBadge
          label={active ? "Active" : "Inactive"}
          tone={active ? "success" : "neutral"}
        />
      </div>
    </div>
  );
}
