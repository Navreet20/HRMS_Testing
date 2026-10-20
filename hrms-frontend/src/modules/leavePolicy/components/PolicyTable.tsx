"use client";

import { CatalogRowActionsMenu } from "@/modules/org/CatalogRowActionsMenu";
import {
  AppDataTable,
  StatusBadge,
  type AppDataTableColumn,
} from "@/shared/ui";
import { yearRangeLabel } from "../selectors";
import type { LeavePolicyRecord } from "../types";

export interface PolicyTableActions {
  readonly onEditDays: (policy: LeavePolicyRecord) => void;
  readonly onActivate: (policy: LeavePolicyRecord) => void;
  readonly onDeactivate: (policy: LeavePolicyRecord) => void;
}

export interface PolicyTableProps {
  readonly policies: readonly LeavePolicyRecord[];
  /** Null = read-only: no Actions column and rows don't open the editor. */
  readonly actions: PolicyTableActions | null;
}

const POLICY_PAGE_SIZE = 10;

/** Company Setup → Leave Policy → Policies list (shared data table). */
export function PolicyTable({ policies, actions }: PolicyTableProps) {
  const columns: AppDataTableColumn<LeavePolicyRecord>[] = [
    {
      id: "policyName",
      header: "Policy name",
      value: (policy) => policy.policyName,
      cellClassName: "font-semibold",
      width: 220,
    },
    {
      id: "yearRange",
      header: "Year range",
      value: (policy) => yearRangeLabel(policy),
      width: 140,
    },
    {
      id: "leaveEntitlements",
      header: "Leave entitlements",
      width: 320,
      cellClassName: "!whitespace-normal",
      cell: (policy) => (
        <ul className="m-0 flex min-w-0 list-none flex-wrap gap-1 p-0">
          {policy.lines.map((line) => (
            <li key={line.policyLineId} className="min-w-0 max-w-full">
              <span
                className="inline-flex max-w-full items-center truncate rounded-full border border-emp-line bg-emp-raised px-2 py-[0.15rem] text-[0.85rem] font-semibold text-emp-text"
                title={`${line.leaveTypeName || "Leave"}: ${line.daysAllowed} days`}
              >
                {line.leaveTypeName || "Leave"}: {line.daysAllowed} days
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "assignedEmployeeCount",
      header: "Assigned employees",
      value: (policy) => policy.assignedEmployeeCount,
      width: 160,
    },
    {
      id: "status",
      header: "Status",
      value: (policy) => policy.status,
      width: 120,
      cell: (policy) => {
        const active = policy.status === "Active";
        return (
          <StatusBadge
            label={active ? "Active" : "Inactive"}
            tone={active ? "success" : "neutral"}
          />
        );
      },
    },
  ];
  if (actions) {
    columns.push({
      id: "actions",
      header: "Actions",
      align: "end",
      width: 88,
      cell: (policy) => {
        const active = policy.status === "Active";
        return (
          <CatalogRowActionsMenu
            itemLabel={policy.policyName}
            status={active ? "Active" : "Inactive"}
            onEdit={() => actions.onEditDays(policy)}
            onActivate={() => actions.onActivate(policy)}
            onDeactivate={() => actions.onDeactivate(policy)}
          />
        );
      },
    });
  }

  return (
    <AppDataTable
      data={policies}
      columns={columns}
      getRowId={(policy) => policy.policyId}
      ariaLabel="Leave policies"
      resizable
      onRowClick={actions?.onEditDays}
      pagination={{ pageSize: POLICY_PAGE_SIZE }}
    />
  );
}
