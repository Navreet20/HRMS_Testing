import { useMemo } from "react";

import {
  AppButton,
  AppDataTable,
  StatusBadge,
  type AppDataTableColumn,
} from "../../../shared/ui";
import { catalogUi } from "@/shared/ui/catalogUi";
import {
  displayEmployeeName,
  employeeInitials,
  formatRoleLabel,
  isActiveStatus,
  resolveEmployeeAccessActions,
} from "../selectors";
import type {
  EmployeeSearchHit,
  RbacEmployeeAction,
  RbacPersona,
} from "../types";

interface RbacEmployeesTableProps {
  readonly rows: readonly EmployeeSearchHit[];
  readonly persona: RbacPersona;
  readonly busy?: boolean;
  readonly emptyLabel: string;
  readonly onAction: (
    employee: EmployeeSearchHit,
    action: RbacEmployeeAction,
  ) => void;
}

const viewEditOutlineClass =
  "!border-emp-accent !bg-emp-surface !text-emp-accent hover:!bg-emp-accent-soft";

/**
 * Manage Access column:
 * - Unassigned → left-aligned solid green "Grant"
 * - Assigned + active → single "View / Edit"
 * - Assigned + inactive → "View"
 */
export function RbacEmployeesTable({
  rows,
  persona,
  busy = false,
  emptyLabel,
  onAction,
}: RbacEmployeesTableProps) {
  const columns = useMemo<AppDataTableColumn<EmployeeSearchHit>[]>(
    () => [
      {
        id: "name",
        header: "Employee name",
        headerClassName: "w-[22%]",
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-grid size-8 shrink-0 place-items-center rounded-full bg-emp-accent-soft text-[0.85rem] font-bold text-emp-accent"
              aria-hidden="true"
            >
              {employeeInitials(row)}
            </span>
            <span className="min-w-0 truncate font-semibold text-emp-text">
              {displayEmployeeName(row)}
            </span>
          </div>
        ),
      },
      {
        id: "employeeCode",
        header: "Employee ID",
        headerClassName: "w-[9rem]",
        cell: (row) => row.employeeCode || "—",
        cellClassName: catalogUi.cellMuted,
      },
      {
        id: "email",
        header: "Email",
        cell: (row) => row.email,
        cellClassName: `min-w-0 truncate ${catalogUi.cellMuted}`,
      },
      {
        id: "status",
        header: "Status",
        headerClassName: "w-[7rem]",
        cell: (row) => {
          const active = isActiveStatus(row.status);
          return (
            <StatusBadge
              label={active ? "Active" : "Inactive"}
              tone={active ? "success" : "neutral"}
            />
          );
        },
        cellClassName: catalogUi.cellStatus,
      },
      {
        id: "role",
        header: "Role",
        headerClassName: "w-[7.5rem]",
        cell: (row) => formatRoleLabel(row.role),
      },
      {
        id: "access",
        header: "Manage access",
        headerClassName: "w-[10.5rem]",
        cell: (row) => {
          const actions = resolveEmployeeAccessActions(row, persona);
          const showAssign = actions.includes("assign");
          const showEdit = actions.includes("edit");
          const showView = actions.includes("view");
          return (
            <div className="flex flex-row flex-nowrap items-center justify-start gap-2 whitespace-nowrap">
              {showAssign ? (
                <AppButton
                  size="compact"
                  className="!shrink-0"
                  onClick={() => onAction(row, "assign")}
                >
                  Grant
                </AppButton>
              ) : null}
              {showEdit ? (
                <AppButton
                  size="compact"
                  variant="secondary"
                  className={`${viewEditOutlineClass} !shrink-0`}
                  onClick={() => onAction(row, "edit")}
                >
                  View / Edit
                </AppButton>
              ) : null}
              {!showEdit && showView ? (
                <AppButton
                  size="compact"
                  variant="secondary"
                  className="!shrink-0"
                  onClick={() => onAction(row, "view")}
                >
                  View
                </AppButton>
              ) : null}
            </div>
          );
        },
      },
    ],
    [persona, onAction],
  );

  return (
    <AppDataTable
      ariaLabel="Employees and their access"
      data={rows}
      columns={columns}
      getRowId={(row) => row.employeeId}
      emptyText={
        <p className={catalogUi.emptyLead}>{busy ? "Loading…" : emptyLabel}</p>
      }
    />
  );
}
