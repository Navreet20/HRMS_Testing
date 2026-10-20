import { useState } from "react";
import { UserCheck, UserMinus } from "lucide-react";

import {
  AppBackLink,
  AppDataTable,
  AppDateField,
  localIsoToday,
  type AppDataTableColumn,
} from "@/shared/ui";
import { formatMembershipDateRange, selectMembershipsForProject } from "../selectors";
import type {
  ProjectActor,
  ProjectMembership,
  ProjectRecord,
  ProjectsModuleData,
} from "../types";
import { projectsUi as ui } from "../uiClasses";

const STAFFING_PAGE_SIZE = 10;

interface StaffingWorkspaceProps {
  readonly project: ProjectRecord;
  readonly actor: ProjectActor;
  readonly data: ProjectsModuleData;
  readonly onBack: () => void;
  readonly onAddMembers: (
    employees: readonly { employeeId: string; displayName: string; startDate: string }[],
  ) => void;
  readonly onSetLead: (membershipId: string) => void;
  readonly onEndMembership: (membership: ProjectMembership) => void;
}

export function StaffingWorkspace({
  project,
  actor,
  data,
  onBack,
  onAddMembers,
  onSetLead,
  onEndMembership,
}: StaffingWorkspaceProps) {
  const memberships = selectMembershipsForProject(data, project.id);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(localIsoToday);

  const activeMemberEmployeeIds = new Set(
    memberships
      .filter((m) => m.status === "ACTIVE")
      .map((m) => m.employeeId),
  );

  const availableEmployees = data.employees.filter(
    (emp) => !activeMemberEmployeeIds.has(emp.id),
  );

  function handleAdd() {
    if (selectedEmployees.length === 0) return;
    const toAdd = selectedEmployees.map((id) => {
      const emp = data.employees.find((e) => e.id === id);
      return {
        employeeId: id,
        displayName: emp?.displayName ?? id,
        startDate,
      };
    });
    onAddMembers(toAdd);
    setSelectedEmployees([]);
  }

  const canManage =
    actor.accessFlags.editAccess || actor.accessFlags.fullAccess;
  const leadMembership = memberships.find(
    (m) => m.id === project.leadMembershipId,
  );

  const membershipColumns: AppDataTableColumn<ProjectMembership>[] = [
    {
      id: "name",
      header: "Name",
      value: (m) => m.displayName,
      cellClassName: "font-semibold",
    },
    {
      id: "role",
      header: "Role",
      value: (m) => m.role,
      cell: (m) => (
        <span
          className={m.role === "LEAD" ? ui.statusTone.lead : ""}
        >
          {m.role}
        </span>
      ),
    },
    {
      id: "dates",
      header: "Dates",
      // ISO start dates sort chronologically.
      value: (m) => m.startDate,
      cell: (m) => formatMembershipDateRange(m),
    },
    {
      id: "status",
      header: "Status",
      value: (m) => m.status,
      cell: (m) => (
        <span
          className={ui.statusTone[m.status.toLowerCase()] ?? ui.statusDefault}
        >
          {m.status}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Actions",
            align: "end" as const,
            cell: (m: ProjectMembership) => (
              <div className="flex flex-wrap justify-end gap-[0.35rem]">
                {m.status === "ACTIVE" && m.role !== "LEAD" ? (
                  <button
                    type="button"
                    className={ui.btnGhostCompact}
                    onClick={() => onSetLead(m.id)}
                  >
                    <UserCheck size={14} aria-hidden="true" />
                    Set lead
                  </button>
                ) : null}
                {m.status === "ACTIVE" ? (
                  <button
                    type="button"
                    className={ui.btnGhostCompact}
                    onClick={() => onEndMembership(m)}
                  >
                    <UserMinus size={14} aria-hidden="true" />
                    End
                  </button>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={ui.staffing}>
      <div className={ui.staffingHeader}>
        <div>
          <AppBackLink onClick={onBack}>Projects</AppBackLink>
          <h2 className={ui.staffingTitle}>
            Staffing — {project.name} ({project.code})
          </h2>
        </div>
      </div>

      <div className={ui.staffingSummary}>
        <p>
          <strong>Client:</strong> {project.clientName || "—"}
        </p>
        <p>
          <strong>PO:</strong> {project.startDate} — {project.endDate}
        </p>
        <p>
          <strong>Lead:</strong>{" "}
          {leadMembership ? leadMembership.displayName : "Not assigned"}
        </p>
        <p>
          <strong>Active members:</strong>{" "}
          {memberships.filter((m) => m.status === "ACTIVE").length}
        </p>
      </div>

      {canManage ? (
        <div className={ui.staffingAdd}>
          <div className={ui.staffingAddField}>
            <span className={ui.fieldLabel}>
              Add employees
            </span>
            <select
              multiple
              value={selectedEmployees}
              onChange={(e) => {
                const selected = Array.from(
                  e.target.selectedOptions,
                  (opt) => opt.value,
                );
                setSelectedEmployees(selected);
              }}
              className="min-h-[5rem]!"
            >
              {availableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.displayName} — {emp.department}
                </option>
              ))}
            </select>
            <span className={ui.fieldHint}>
              Hold Ctrl/Cmd to select multiple
            </span>
          </div>
          <div className={ui.staffingAddField}>
            <span className={ui.fieldLabel}>Start date</span>
            <AppDateField
              value={startDate}
              aria-label="Start date"
              onChange={setStartDate}
            />
          </div>
          <button
            type="button"
            className={ui.btnPrimary}
            disabled={selectedEmployees.length === 0}
            onClick={handleAdd}
          >
            Add to project
          </button>
        </div>
      ) : null}

      <AppDataTable
        data={memberships}
        columns={membershipColumns}
        getRowId={(membership) => membership.id}
        ariaLabel="Project staffing"
        resizable
        sortBy={{ id: "name" }}
        pagination={{ pageSize: STAFFING_PAGE_SIZE }}
        emptyState={
          <p className="m-0 text-[0.85rem] text-emp-muted">
            No memberships assigned yet.
          </p>
        }
      />
    </div>
  );
}
