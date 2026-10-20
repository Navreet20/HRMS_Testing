import { useEffect, useId, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import {
  canSeePendingEmployeesTab,
  canSeePendingTimesheetsTab,
  formatEmployeeName,
  getDefaultApprovalsTab,
  selectApprovalQueueStatus,
  selectPendingApprovalQueue,
  type ApprovalsTabId,
} from "../selectors";
import type {
  EmployeeActor,
  EmployeeRecord,
  EmployeesModuleData,
  TimesheetApprovalHandoff,
} from "../types";
import { AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { btnPrimaryCompact, chipTabClass, employeeStatusClass, ui } from "../uiClasses";

const PENDING_PAGE_SIZE = 10;

interface PendingApprovalsProps {
  readonly actor: EmployeeActor;
  readonly data: EmployeesModuleData;
  readonly onReviewEmployee: (employee: EmployeeRecord) => void;
  readonly onOpenTimesheetApprovals: (handoff: TimesheetApprovalHandoff) => void;
}

export function PendingApprovals({
  actor,
  data,
  onReviewEmployee,
  onOpenTimesheetApprovals,
}: PendingApprovalsProps) {
  const titleId = useId();
  const showEmployees = canSeePendingEmployeesTab(actor);
  const showTimesheets = canSeePendingTimesheetsTab(actor);
  const [tab, setTab] = useState<ApprovalsTabId>(() =>
    getDefaultApprovalsTab(actor),
  );

  useEffect(() => {
    const preferred = getDefaultApprovalsTab(actor);
    if (preferred === "employees" && !showEmployees && showTimesheets) {
      setTab("timesheets");
      return;
    }
    if (preferred === "timesheets" && !showTimesheets && showEmployees) {
      setTab("employees");
      return;
    }
    setTab(preferred);
  }, [actor, showEmployees, showTimesheets]);

  const pendingEmployees = selectPendingApprovalQueue(data);
  const pendingColumns: AppDataTableColumn<EmployeeRecord>[] = [
    {
      id: "name",
      header: "Name",
      value: (employee) => formatEmployeeName(employee),
      cellClassName: "font-semibold",
    },
    {
      id: "employeeCode",
      header: "Employee Code",
      value: (employee) => employee.employeeCode,
    },
    {
      id: "department",
      header: "Department",
      value: (employee) => employee.department,
    },
    {
      id: "status",
      header: "Status",
      value: (employee) => selectApprovalQueueStatus(employee),
      cell: (employee) => (
        <span className={employeeStatusClass(employee.status)}>
          {selectApprovalQueueStatus(employee)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (employee) => (
        <button
          type="button"
          className={btnPrimaryCompact()}
          onClick={() => onReviewEmployee(employee)}
        >
          <ClipboardCheck size={14} aria-hidden="true" />
          Review
        </button>
      ),
    },
  ];
  const activeTab =
    tab === "employees" && showEmployees
      ? "employees"
      : tab === "timesheets" && showTimesheets
        ? "timesheets"
        : showEmployees
          ? "employees"
          : "timesheets";

  if (!showEmployees && !showTimesheets) {
    return (
      <div className={ui.approvals}>
        <p className={ui.lede}>
          Pending Approvals is not available for this persona in v1.
        </p>
      </div>
    );
  }

  return (
    <div className={ui.approvals} aria-labelledby={titleId}>
      <h2 id={titleId} className={ui.srOnly}>
        Pending Approvals
      </h2>

      <div
        className={ui.approvalsTabs}
        role="tablist"
        aria-label="Pending approval types"
      >
        {showEmployees ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "employees"}
            className={chipTabClass(activeTab === "employees")}
            onClick={() => setTab("employees")}
          >
            Employees ({pendingEmployees.length})
          </button>
        ) : null}
        {showTimesheets ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "timesheets"}
            className={chipTabClass(activeTab === "timesheets")}
            onClick={() => setTab("timesheets")}
          >
            Timesheets ({data.pendingTimesheetCount})
          </button>
        ) : null}
      </div>

      {activeTab === "employees" && showEmployees ? (
        <div role="tabpanel" className={ui.approvalsPanel}>
          {pendingEmployees.length === 0 ? (
            <p className={ui.empty}>
              No pending employee approvals.
            </p>
          ) : (
            <AppDataTable
              data={pendingEmployees}
              columns={pendingColumns}
              getRowId={(employee) => employee.id}
              ariaLabel="Pending employee approvals"
              resizable
              sortBy={{ id: "name" }}
              pagination={{ pageSize: PENDING_PAGE_SIZE }}
            />
          )}
        </div>
      ) : null}

      {activeTab === "timesheets" && showTimesheets ? (
        <div role="tabpanel" className={ui.approvalsPanel}>
          <div className={ui.approvalsTimesheets}>
            <p>
              <strong>{data.pendingTimesheetCount}</strong> timesheet approval
              {data.pendingTimesheetCount === 1 ? "" : "s"} waiting.
            </p>
            <button
              type="button"
              className={btnPrimaryCompact()}
              onClick={() =>
                onOpenTimesheetApprovals({
                  source: "employees-pending",
                  role: actor.role,
                  isLead: actor.isLead,
                  pendingCount: data.pendingTimesheetCount,
                  requestedAt: new Date().toISOString(),
                })
              }
            >
              Open timesheet approvals
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
