import {
  canListEmployees,
  canSeeApprovalsWorkspace,
  canSeeDraftsWorkspace,
} from "../selectors";
import type { EmployeeActor, EmployeesView } from "../types";
import { chipTabClass, ui } from "../uiClasses";

interface WorkspaceSwitcherProps {
  readonly actor: EmployeeActor;
  readonly activeView: "directory" | "drafts" | "approvals";
  readonly onChange: (view: "directory" | "drafts" | "approvals") => void;
}

export function WorkspaceSwitcher({
  actor,
  activeView,
  onChange,
}: WorkspaceSwitcherProps) {
  const showDirectory = canListEmployees(actor);
  const showDrafts = canSeeDraftsWorkspace(actor);
  const showApprovals = canSeeApprovalsWorkspace(actor);
  const tabCount = [showDirectory, showDrafts, showApprovals].filter(Boolean)
    .length;

  if (tabCount < 2) {
    return null;
  }

  return (
    <div
      className={ui.workspace}
      role="tablist"
      aria-label="Employees workspace"
    >
      {showDirectory ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "directory"}
          className={chipTabClass(activeView === "directory")}
          onClick={() => onChange("directory")}
        >
          Directory
        </button>
      ) : null}
      {showDrafts ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "drafts"}
          className={chipTabClass(activeView === "drafts")}
          onClick={() => onChange("drafts")}
        >
          Drafts
        </button>
      ) : null}
      {showApprovals ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "approvals"}
          className={chipTabClass(activeView === "approvals")}
          onClick={() => onChange("approvals")}
        >
          Pending Approvals
        </button>
      ) : null}
    </div>
  );
}

export type { EmployeesView };
