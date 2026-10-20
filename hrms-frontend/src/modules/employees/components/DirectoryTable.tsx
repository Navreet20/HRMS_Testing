import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { AppButton } from "@/shared/ui";
import { createPortal } from "react-dom";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Eye,
  FilePenLine,
  FolderOpen,
  Hash,
  Mail,
  MapPin,
  Monitor,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
} from "lucide-react";

import { StatusBadge, HRMS_ROLE_LABELS } from "@/shared";
import { ClickToViewHint } from "@/shared/ui";
import { WORK_MODE_LABELS, WORK_MODES } from "../constants";
import { useEmployeeAvatarUrl } from "../hooks/useEmployeeAvatarUrl";
import {
  employeeStatusDisplayLabel,
  employeeStatusDisplayTone,
  formatEmployeeName,
  resolveSupervisorName,
  selectEmployeeActions,
} from "../selectors";
import type {
  EmployeeActionKind,
  EmployeeActor,
  EmployeeRecord,
  EmployeesModuleData,
} from "../types";
import {
  DirectoryEmptySearchIcon,
  DirectoryEmptyUsersIcon,
  MoreIcon,
} from "./icons";
import { cx, ui } from "../uiClasses";

const ROW_MENU_GAP = 6;
const ROW_MENU_WIDTH = 176;
const ROW_MENU_VIEWPORT_PADDING = 8;
const ROW_MENU_ITEM_HEIGHT = 40;
const ROW_MENU_PADDING = 12;
const ROW_MENU_ICON_PROPS = { size: 14, "aria-hidden": true as const };

function EmployeeActionIcon({
  kind,
  label,
}: {
  readonly kind: EmployeeActionKind;
  readonly label: string;
}) {
  if (kind === "view") {
    return /edit/i.test(label) ? (
      <Pencil {...ROW_MENU_ICON_PROPS} />
    ) : (
      <Eye {...ROW_MENU_ICON_PROPS} />
    );
  }
  if (kind === "edit") {
    return <Pencil {...ROW_MENU_ICON_PROPS} />;
  }
  if (kind === "softDelete") {
    return <UserMinus {...ROW_MENU_ICON_PROPS} />;
  }
  if (kind === "reactivate") {
    return <UserPlus {...ROW_MENU_ICON_PROPS} />;
  }
  if (kind === "hardDelete") {
    return <Trash2 {...ROW_MENU_ICON_PROPS} />;
  }
  if (kind === "resumeDraft") {
    return <FilePenLine {...ROW_MENU_ICON_PROPS} />;
  }
  if (kind === "resendInvite" || kind === "inviteDraft") {
    return <Mail {...ROW_MENU_ICON_PROPS} />;
  }
  if (kind === "startOnboarding") {
    return <ClipboardList {...ROW_MENU_ICON_PROPS} />;
  }
  if (kind === "viewOnboarding") {
    return <FolderOpen {...ROW_MENU_ICON_PROPS} />;
  }
  return <Pencil {...ROW_MENU_ICON_PROPS} />;
}

function estimateRowMenuHeight(itemCount: number): number {
  return itemCount * ROW_MENU_ITEM_HEIGHT + ROW_MENU_PADDING;
}

function placeRowMenuPanel(
  trigger: HTMLElement,
  panel: HTMLElement | null,
  itemCount: number,
): { top: number; left: number } {
  const rect = trigger.getBoundingClientRect();
  const panelHeight =
    panel?.getBoundingClientRect().height ?? estimateRowMenuHeight(itemCount);
  const left = Math.min(
    Math.max(ROW_MENU_VIEWPORT_PADDING, rect.right - ROW_MENU_WIDTH),
    window.innerWidth - ROW_MENU_WIDTH - ROW_MENU_VIEWPORT_PADDING,
  );

  const spaceBelow = window.innerHeight - rect.bottom - ROW_MENU_GAP;
  const spaceAbove = rect.top - ROW_MENU_GAP;

  let top: number;
  if (panelHeight <= spaceBelow) {
    top = rect.bottom + ROW_MENU_GAP;
  } else if (panelHeight <= spaceAbove) {
    top = rect.top - panelHeight - ROW_MENU_GAP;
  } else if (spaceBelow >= spaceAbove) {
    top = Math.min(
      rect.bottom + ROW_MENU_GAP,
      window.innerHeight - panelHeight - ROW_MENU_VIEWPORT_PADDING,
    );
  } else {
    top = Math.max(
      ROW_MENU_VIEWPORT_PADDING,
      rect.top - panelHeight - ROW_MENU_GAP,
    );
  }

  top = Math.min(
    Math.max(ROW_MENU_VIEWPORT_PADDING, top),
    window.innerHeight - panelHeight - ROW_MENU_VIEWPORT_PADDING,
  );

  return { top, left };
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function workModeLabel(value: string | null): string | null {
  const mode = value?.trim();
  if (!mode) {
    return null;
  }
  if ((WORK_MODES as readonly string[]).includes(mode)) {
    return WORK_MODE_LABELS[mode as (typeof WORK_MODES)[number]];
  }
  return mode;
}

function formatStartDate(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : raw;
}

function DirectoryEmptyState({
  kind,
  canCreate,
  onAddEmployee,
}: {
  readonly kind: "idle" | "none" | "filtered";
  readonly canCreate: boolean;
  readonly onAddEmployee: () => void;
}) {
  if (kind === "idle") {
    return (
      <div className={ui.dirEmpty} role="status">
        <span className={ui.dirEmptyIcon}>
          <DirectoryEmptySearchIcon />
        </span>
        <p className={ui.dirEmptyTitle}>No active search query</p>
        <p className={ui.dirEmptyCopy}>
          Search by name, employee code, employee ID, or work email, or select a
          filter above to view employees.
        </p>
      </div>
    );
  }

  const isFiltered = kind === "filtered";

  return (
    <div className={ui.dirEmpty} role="status">
      <span className={ui.dirEmptyIcon}>
        {isFiltered ? (
          <DirectoryEmptySearchIcon />
        ) : (
          <DirectoryEmptyUsersIcon />
        )}
      </span>
      <p className={ui.dirEmptyTitle}>
        {isFiltered ? "No employees match your filters" : "No employees yet"}
      </p>
      <p className={ui.dirEmptyCopy}>
        {isFiltered
          ? "Try a different search term, or change the department and status filters."
          : "Add people to your organization to see them in the directory."}
      </p>
      {!isFiltered && canCreate ? (
        <AppButton onClick={onAddEmployee}>
          Add your first employee
        </AppButton>
      ) : null}
    </div>
  );
}

function ActionMenu({
  employee,
  actor,
  hierarchy,
  onAction,
}: {
  readonly employee: EmployeeRecord;
  readonly actor: EmployeeActor;
  readonly hierarchy: EmployeesModuleData["hierarchy"];
  readonly onAction: (
    kind: EmployeeActionKind,
    employee: EmployeeRecord,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const actions = selectEmployeeActions(actor, employee, hierarchy);
  const employeeName = formatEmployeeName(employee);

  function placePanel() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    setPanelPos(placeRowMenuPanel(trigger, panelRef.current, actions.length));
  }

  function closeMenu() {
    setOpen(false);
    setPanelPos(null);
  }

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;
      if (next && triggerRef.current) {
        setPanelPos(
          placeRowMenuPanel(triggerRef.current, null, actions.length),
        );
      } else if (!next) {
        setPanelPos(null);
      }
      return next;
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    placePanel();
    const frame = window.requestAnimationFrame(() => placePanel());
    return () => window.cancelAnimationFrame(frame);
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    function handleReposition() {
      placePanel();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, actions.length]);

  if (actions.length === 0) {
    return <span className={ui.muted}>No actions</span>;
  }

  const menu =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            ref={panelRef}
            className={ui.rowMenuPanel}
            role="menu"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            {actions.map((action) => {
              const isDanger =
                action.kind === "softDelete" || action.kind === "hardDelete";
              return (
                <button
                  key={action.kind}
                  type="button"
                  role="menuitem"
                  className={cx(
                    ui.rowMenuItem,
                    isDanger && ui.rowMenuItemDanger,
                  )}
                  disabled={!action.enabled}
                  title={action.reason ?? action.label}
                  aria-label={`${action.label} ${employeeName}`}
                  onKeyDown={(event: ReactKeyboardEvent) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      closeMenu();
                      triggerRef.current?.focus();
                    }
                  }}
                  onClick={() => {
                    if (!action.enabled) {
                      return;
                    }
                    onAction(action.kind, employee);
                    closeMenu();
                  }}
                >
                  <EmployeeActionIcon kind={action.kind} label={action.label} />
                  {action.label}
                  {action.reason ? (
                    <span className={ui.srOnly}>. {action.reason}</span>
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={ui.rowMenu}
      ref={rootRef}
      onClick={(event: ReactMouseEvent) => event.stopPropagation()}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
          triggerRef.current?.focus();
          return;
        }
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        className={ui.rowMenuTrigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Actions for ${employeeName}`}
        onClick={toggleOpen}
      >
        <MoreIcon />
      </button>
      {menu}
    </div>
  );
}

function DirectoryEmployeeCard({
  employee,
  data,
  actor,
  onAction,
  fetchAvatarBlob,
}: {
  readonly employee: EmployeeRecord;
  readonly data: EmployeesModuleData;
  readonly actor: EmployeeActor;
  readonly onAction: (
    kind: EmployeeActionKind,
    employee: EmployeeRecord,
  ) => void;
  readonly fetchAvatarBlob?: (employeeId: string) => Promise<Blob>;
}) {
  const displayName = formatEmployeeName(employee);
  const photoSrc = useEmployeeAvatarUrl(
    employee.id,
    employee.avatarObjectKey,
    fetchAvatarBlob,
  );
  const roleLabel = HRMS_ROLE_LABELS[employee.role] ?? employee.role;
  const roleLine = [employee.title, roleLabel].filter(Boolean).join(" • ");
  const orgDepartment = employee.departmentName?.trim() ?? "";
  const orgLocation = employee.locationName?.trim() ?? "";
  const managerName = resolveSupervisorName(
    data,
    employee.supervisorId,
    employee.supervisorName,
  );
  const showManager =
    Boolean(employee.supervisorId) &&
    managerName.trim() !== "" &&
    managerName !== "—";
  const showDepartment = Boolean(orgDepartment);
  const workMode = workModeLabel(employee.workMode);
  const startDate = formatStartDate(employee.startDate);
  const actions = selectEmployeeActions(actor, employee, data.hierarchy);
  const openKind =
    actions.find((action) => action.kind === "view" && action.enabled)?.kind ??
    actions.find((action) => action.kind === "resumeDraft" && action.enabled)
      ?.kind ??
    null;

  function openCard() {
    if (!openKind) {
      return;
    }
    onAction(openKind, employee);
  }

  return (
    <article
      className={openKind ? ui.dirCardInteractive : ui.dirCard}
      aria-label={`${displayName} employee card`}
      {...(openKind
        ? {
            tabIndex: 0,
            onClick: openCard,
            onKeyDown: (event: ReactKeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCard();
              }
            },
          }
        : {})}
    >
      {openKind ? <ClickToViewHint /> : null}
      <div className={ui.profileHeroRow}>
        <div className={ui.profileHeroAvatarCol}>
          <div className={ui.profileHeroAvatarWrap}>
            <span className={ui.profileHeroAvatar} aria-hidden="true">
              {photoSrc ? (
                <img className={ui.profileHeroPhoto} src={photoSrc} alt="" />
              ) : (
                initialsFor(displayName)
              )}
            </span>
          </div>
        </div>
        <div className={ui.profileHeroBody}>
          <h2 className={ui.profileHeroName}>{displayName}</h2>
          {roleLine ? <p className={ui.profileHeroRole}>{roleLine}</p> : null}
          {showDepartment || orgLocation || showManager ? (
            <p className={ui.profileHeroMeta}>
              {showDepartment ? (
                <span className={ui.profileHeroMetaItem}>
                  <Building2 size={13} className={ui.profileHeroMetaIcon} />
                  {orgDepartment}
                </span>
              ) : null}
              {orgLocation ? (
                <span className={ui.profileHeroMetaItem}>
                  <MapPin size={13} className={ui.profileHeroMetaIcon} />
                  {orgLocation}
                </span>
              ) : null}
              {showManager ? (
                <span className={ui.profileHeroMetaItem}>
                  <UserRound size={13} className={ui.profileHeroMetaIcon} />
                  Reports to {managerName}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className={ui.profileHeroPills}>
            {employee.isSystemAccount ? (
              <span className={ui.profileHeroPill}>System account</span>
            ) : null}
            <StatusBadge
              label={employeeStatusDisplayLabel(employee)}
              tone={employeeStatusDisplayTone(employee)}
            />
            {employee.pendingProfileChange ? (
              <span
                className={ui.dirBadge}
                title="Profile change pending HR review"
              >
                Profile change pending
              </span>
            ) : null}
            {employee.businessEmployeeId ? (
              <span className={ui.profileHeroPill}>
                <Hash size={13} className={ui.profileHeroPillIcon} />
                ID: {employee.businessEmployeeId}
              </span>
            ) : null}
            {employee.employeeCode ? (
              <span className={ui.profileHeroPill}>
                <Hash size={13} className={ui.profileHeroPillIcon} />
                Code: {employee.employeeCode}
              </span>
            ) : null}
            {employee.workEmail ? (
              <span className={ui.profileHeroPill}>
                <Mail size={13} className={ui.profileHeroPillIcon} />
                {employee.workEmail}
              </span>
            ) : null}
            {workMode ? (
              <span className={ui.profileHeroPill}>
                <Monitor size={13} className={ui.profileHeroPillIcon} />
                {workMode}
              </span>
            ) : null}
            {startDate ? (
              <span className={ui.profileHeroPill}>
                <CalendarDays size={13} className={ui.profileHeroPillIcon} />
                {startDate}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className={ui.dirCardActions}
        onClick={(event: ReactMouseEvent) => event.stopPropagation()}
        onKeyDown={(event: ReactKeyboardEvent) => event.stopPropagation()}
      >
        <ActionMenu
          employee={employee}
          actor={actor}
          hierarchy={data.hierarchy}
          onAction={onAction}
        />
      </div>
    </article>
  );
}

interface DirectoryCardsProps {
  readonly rows: readonly EmployeeRecord[];
  readonly data: EmployeesModuleData;
  readonly actor: EmployeeActor;
  readonly emptyKind: "idle" | "none" | "filtered";
  readonly canCreate: boolean;
  readonly onAction: (
    kind: EmployeeActionKind,
    employee: EmployeeRecord,
  ) => void;
  readonly onAddEmployee: () => void;
  readonly fetchAvatarBlob?: (employeeId: string) => Promise<Blob>;
}

/** Employee directory results as profile-style identity cards. */
export function DirectoryTable({
  rows,
  data,
  actor,
  emptyKind,
  canCreate,
  onAction,
  onAddEmployee,
  fetchAvatarBlob,
}: DirectoryCardsProps) {
  if (emptyKind === "idle" || rows.length === 0) {
    return (
      <div className={ui.dirEmptyPanel}>
        <DirectoryEmptyState
          kind={emptyKind}
          canCreate={canCreate}
          onAddEmployee={onAddEmployee}
        />
      </div>
    );
  }

  return (
    <div className={ui.dirCardList} role="list" aria-label="Employee directory">
      {rows.map((employee) => (
        <div key={employee.id} role="listitem">
          <DirectoryEmployeeCard
            employee={employee}
            data={data}
            actor={actor}
            onAction={onAction}
            fetchAvatarBlob={fetchAvatarBlob}
          />
        </div>
      ))}
    </div>
  );
}
