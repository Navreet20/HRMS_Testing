"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";

import {
  AppButton,
  AppCheckbox,
  AppDataTable,
  AppDateField,
  type AppDataTableColumn,
} from "@/shared/ui";
import { CheckIcon } from "@/shared/ui/icons";
import { EmployeesSearchCombobox } from "@/modules/employees/components/EmployeesSearchCombobox";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import { PROJECT_ALLOCATION_ROLES } from "../constants";
import {
  buildClientLocationOptions,
  buildWorkLocationOptions,
  parseWorkLocationOptionValue,
  resolveClientLocationFormValue,
  workLocationOptionValue,
} from "../allocationLocations";
import {
  isAllocationActive,
  isProjectEnded,
  projectEffectiveEndDate,
  projectEndedAllocationMessage,
} from "../selectors";
import type {
  EmployeeOption,
  ProjectAllocation,
  ProjectRecord,
  ResourceAllocationRow,
} from "../types";
import type { ClientLocationRecord } from "@/modules/clients/types";
import { MoreIcon } from "./icons";
import { projectsUi } from "../uiClasses";

interface AllocateResourcesDialogProps {
  readonly project: ProjectRecord;
  readonly employees: readonly EmployeeOption[];
  /**
   * When the host searches the server for candidates: called while the picker
   * is open (text typed, or null when it closes). `employees` then holds only
   * the current search results.
   */
  readonly onEmployeeSearch?: (query: string | null) => void;
  readonly employeesLoading?: boolean;
  /** Client locations for the project's client (Client Location dropdown). */
  readonly clientLocations?: readonly ClientLocationRecord[];
  /** Employee IDs already actively assigned to this project (cannot re-add). */
  readonly assignedEmployeeIds?: readonly string[];
  /** Existing persisted allocations to show / edit in the table. */
  readonly initialAllocations?: readonly ResourceAllocationRow[];
  /** All known allocations (any project) — used for over-100% warnings. */
  readonly allAllocations?: readonly ProjectAllocation[];
  /**
   * When true, render the allocation table + footer inline (no CatalogModal /
   * portal / backdrop). Cancel still uses onClose; save still uses onAllocate.
   */
  readonly embedded?: boolean;
  /** View-only: hide add/edit/delete and keep the inline editor closed. */
  readonly readOnly?: boolean;
  /** Hide Cancel/Allocate footer; row add/update/remove auto-persists via onAllocate. */
  readonly hideFooter?: boolean;
  /**
   * When false, parent renders "+ Allocate Resource" (via openAddEditor).
   * Default true.
   */
  readonly showAddAction?: boolean;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onAllocate: (
    rows: readonly ResourceAllocationRow[],
  ) => void | Promise<void>;
}

export type AllocateResourcesDialogHandle = {
  getRows: () => ResourceAllocationRow[];
  hasOpenEditor: () => boolean;
  openAddEditor: () => void;
};

interface FormState {
  employeeId: string;
  projectRole: string;
  workLocationKey: string;
  clientLocationId: string;
  startDate: string;
  endDate: string;
  allocationPercentage: string;
  billable: boolean;
  billabilityPercentage: string;
}

interface FormErrors {
  employeeId?: string;
  projectRole?: string;
  workLocationKey?: string;
  clientLocationId?: string;
  startDate?: string;
  endDate?: string;
  allocationPercentage?: string;
  billabilityPercentage?: string;
}

const EMPTY_ASSIGNED_IDS: readonly string[] = [];
const EMPTY_ALLOCATION_ROWS: readonly ResourceAllocationRow[] = [];
const EMPTY_PROJECT_ALLOCATIONS: readonly ProjectAllocation[] = [];
const EMPTY_CLIENT_LOCATIONS: readonly ClientLocationRecord[] = [];

const INITIAL_FORM: FormState = {
  employeeId: "",
  projectRole: "",
  workLocationKey: "",
  clientLocationId: "",
  startDate: "",
  endDate: "",
  allocationPercentage: "",
  billable: false,
  billabilityPercentage: "",
};

/** Body cells wrap long values instead of cutting them off. */
const TEXT_CELL = "!whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]";
const LOCATION_CELL = "min-w-0 !whitespace-normal [overflow-wrap:normal] [word-break:normal]";
const ACTIONS_CELL = "!px-3 whitespace-nowrap !overflow-visible";

function createRowId(): string {
  return `alloc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDisplayDate(iso: string): string {
  if (!iso) {
    return "";
  }
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${month}/${day}/${year}`;
}

function formatAllocationPeriod(start: string, end: string): string {
  const startLabel = formatDisplayDate(start);
  if (!end) {
    return `${startLabel} —`;
  }
  return `${startLabel} – ${formatDisplayDate(end)}`;
}

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function usableLocationLabel(label: string): string {
  const text = label.trim();
  if (!text || text === "—" || UUID_LIKE.test(text)) {
    return "";
  }
  return text;
}

function AllocationLocationCell({
  label,
}: {
  readonly label: string;
}) {
  const text = usableLocationLabel(label);
  if (!text) {
    return (
      <span className={projectsUi.locationEmpty}>—</span>
    );
  }
  const comma = text.indexOf(",");
  const primary = comma === -1 ? text : text.slice(0, comma).trim();
  const secondary = comma === -1 ? "" : text.slice(comma + 1).trim();
  return (
    <span className={projectsUi.location} title={text}>
      <span className={projectsUi.locationLine}>{primary}</span>
      {secondary ? (
        <span className={projectsUi.locationLineMuted}>
          {secondary}
        </span>
      ) : null}
    </span>
  );
}

function parsePercentage(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function allocationDatesOverlap(
  startA: string,
  endA: string | null | undefined,
  startB: string,
  endB: string | null | undefined,
): boolean {
  const endOpen = "9999-12-31";
  const aEnd = (endA ?? "").trim() || endOpen;
  const bEnd = (endB ?? "").trim() || endOpen;
  return startA <= bEnd && startB <= aEnd;
}

/** What an employee is allocated to across projects today. */
function currentLoadPercent(
  employeeId: string,
  allocations: readonly ProjectAllocation[],
): number {
  const today = new Date().toISOString().slice(0, 10);
  return allocations
    .filter(
      (row) =>
        row.employeeId === employeeId &&
        isAllocationActive(row, today) &&
        (!row.startDate || row.startDate <= today),
    )
    .reduce((sum, row) => sum + Number(row.allocationPercentage || 0), 0);
}

function employeePickerLabel(employee: EmployeeOption, load: number): string {
  const name = employee.employeeCode
    ? `${employee.displayName} (${employee.employeeCode})`
    : employee.displayName;
  return load > 0 ? `${name} · ${formatPercent(load)}% allocated` : name;
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Sum overlapping allocation % from other projects for this employee/window. */
function overlappingOtherProjectsPercent(input: {
  readonly employeeId: string;
  readonly projectId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly allAllocations: readonly ProjectAllocation[];
  /** Persisted allocation currently being edited — exclude so we don't double-count. */
  readonly excludeAllocationId?: string | null;
}): number {
  return input.allAllocations
    .filter(
      (row) =>
        row.employeeId === input.employeeId &&
        row.projectId !== input.projectId &&
        row.id !== input.excludeAllocationId &&
        isAllocationActive(row),
    )
    .filter((row) =>
      allocationDatesOverlap(
        input.startDate,
        input.endDate,
        row.startDate,
        row.endDate,
      ),
    )
    .reduce((sum, row) => sum + Number(row.allocationPercentage || 0), 0);
}

function capacityOver100(input: {
  readonly employeeId: string;
  readonly projectId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly allocationPercentage: number;
  readonly allAllocations: readonly ProjectAllocation[];
  readonly excludeAllocationId?: string | null;
}): { readonly existingPercent: number; readonly total: number } | null {
  const existingPercent = overlappingOtherProjectsPercent(input);
  const total = existingPercent + input.allocationPercentage;
  if (total > 100.0001) {
    return { existingPercent, total };
  }
  return null;
}

function validateAllocationDates(
  form: Pick<FormState, "startDate" | "endDate">,
  projectStartDate: string,
  projectEndDate: string,
  options?: { readonly requireComplete?: boolean },
): Pick<FormErrors, "startDate" | "endDate"> {
  const errors: FormErrors = {};
  const projectStart = projectStartDate.trim();
  const projectEnd = projectEndDate.trim();
  const requireComplete = options?.requireComplete !== false;

  if (!form.startDate) {
    if (requireComplete) {
      errors.startDate = "Allocation start is required.";
    }
  } else {
    if (projectStart && form.startDate < projectStart) {
      errors.startDate =
        "Allocation start cannot be before the project start date.";
    } else if (projectEnd && form.startDate > projectEnd) {
      errors.startDate =
        "Allocation start cannot be after the project end date.";
    }
  }

  if (form.endDate && form.startDate && form.endDate < form.startDate) {
    errors.endDate = "End date must be on or after start date.";
  } else if (form.endDate) {
    if (projectStart && form.endDate < projectStart) {
      errors.endDate =
        "Allocation end cannot be before the project start date.";
    } else if (projectEnd && form.endDate > projectEnd) {
      errors.endDate = "Allocation end cannot be after the project end date.";
    }
  }

  return errors;
}

function validateForm(
  form: FormState,
  options: {
    readonly rows: readonly ResourceAllocationRow[];
    readonly editingId: string | null;
    readonly assignedEmployeeIds: ReadonlySet<string>;
    readonly projectStartDate: string;
    readonly projectEndDate: string;
    readonly workLocationOptions: readonly { readonly value: string }[];
    readonly clientLocationOptions: readonly { readonly value: string }[];
  },
): FormErrors {
  const errors: FormErrors = {};
  if (!form.employeeId) {
    errors.employeeId = "Select an employee.";
  } else {
    const alreadyInList = options.rows.some(
      (row) =>
        row.employeeId === form.employeeId && row.id !== options.editingId,
    );
    if (alreadyInList) {
      errors.employeeId =
        "This employee is already in the allocated resources list.";
    } else if (
      !options.editingId &&
      options.assignedEmployeeIds.has(form.employeeId)
    ) {
      errors.employeeId = "This employee is already assigned to this project.";
    } else if (
      options.editingId &&
      options.assignedEmployeeIds.has(form.employeeId)
    ) {
      const editingRow = options.rows.find(
        (row) => row.id === options.editingId,
      );
      if (editingRow && editingRow.employeeId !== form.employeeId) {
        errors.employeeId =
          "This employee is already assigned to this project.";
      }
    }
  }
  if (!form.projectRole.trim()) {
    errors.projectRole = "Select a project role.";
  }

  if (
    form.workLocationKey.trim() &&
    !options.workLocationOptions.some(
      (option) => option.value === form.workLocationKey,
    )
  ) {
    errors.workLocationKey = "Select a valid work location.";
  }

  if (
    form.clientLocationId.trim() &&
    !options.clientLocationOptions.some(
      (option) => option.value === form.clientLocationId,
    )
  ) {
    errors.clientLocationId = "Select a valid client location.";
  }

  Object.assign(
    errors,
    validateAllocationDates(
      form,
      options.projectStartDate,
      options.projectEndDate,
    ),
  );

  const allocation = parsePercentage(form.allocationPercentage);
  if (allocation == null) {
    errors.allocationPercentage = "Allocation % is required.";
  } else if (allocation < 0.01 || allocation > 100) {
    errors.allocationPercentage = "Allocation % must be between 0.01 and 100.";
  }

  if (form.billable) {
    const billability = parsePercentage(form.billabilityPercentage);
    if (billability == null) {
      errors.billabilityPercentage = "Billability % is required when billable.";
    } else if (billability < 0.01 || billability > 100) {
      errors.billabilityPercentage =
        "Billability % must be between 0.01 and 100.";
    } else if (allocation != null && billability > allocation) {
      errors.billabilityPercentage =
        "Billability % must be less than or equal to Allocation %.";
    }
  }

  return errors;
}

function formFromRow(
  row: ResourceAllocationRow,
  clientLocations: readonly ClientLocationRecord[] = EMPTY_CLIENT_LOCATIONS,
): FormState {
  const workLocationKey =
    row.workLocationId &&
    (row.workLocationKind === "OFFICE" || row.workLocationKind === "RESIDENTIAL")
      ? workLocationOptionValue(row.workLocationKind, row.workLocationId)
      : "";
  return {
    employeeId: row.employeeId,
    projectRole: row.projectRole,
    workLocationKey,
    clientLocationId: resolveClientLocationFormValue(
      row.clientLocationId,
      clientLocations,
    ),
    startDate: row.startDate,
    endDate: row.endDate,
    allocationPercentage: String(row.allocationPercentage),
    billable: row.billable,
    billabilityPercentage:
      row.billabilityPercentage != null ? String(row.billabilityPercentage) : "",
  };
}

function RowActionsMenu({
  employeeLabel,
  onEdit,
  onRemove,
}: {
  readonly employeeLabel: string;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  function placePanel() {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = 10.5 * 16;
    const panelHeight = 96;
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + panelHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - panelHeight - gap);
    }
    const left = Math.min(
      Math.max(8, rect.right - panelWidth),
      window.innerWidth - panelWidth - 8,
    );
    setPanelPos({ top, left });
  }

  function closeMenu() {
    setOpen(false);
    setPanelPos(null);
  }

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (!next) {
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
  }, [open]);

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
  }, [open]);

  function runAndClose(action: () => void) {
    action();
    closeMenu();
  }

  const menu =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            ref={panelRef}
            className={ui.rowMenuPanel}
            role="menu"
            aria-label={`Actions for ${employeeLabel}`}
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              className={ui.rowMenuItem}
              onClick={() => runAndClose(onEdit)}
            >
              <Pencil size={14} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className={cx(ui.rowMenuItem, ui.rowMenuItemDanger)}
              onClick={() => runAndClose(onRemove)}
            >
              <Trash2 size={14} aria-hidden="true" />
              Remove
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative inline-flex justify-end" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={ui.rowMenuTrigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Actions for ${employeeLabel}`}
        onClick={toggleOpen}
      >
        <MoreIcon />
      </button>
      {menu}
    </div>
  );
}

function RemoveAllocationConfirm({
  employeeName,
  onCancel,
  onConfirm,
}: {
  readonly employeeName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const titleId = useId();
  return (
    <div className={ui.overlayNested} role="presentation">
      <div
        className={projectsUi.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Remove allocation?</h2>
        <p>
          Are you sure {employeeName} will be removed? This ends the allocation
          (sets an end date). It is not removed from the database.
        </p>
        <div className={projectsUi.formActions}>
          <button
            type="button"
            className={projectsUi.btnGhost}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={projectsUi.btnDanger}
            onClick={onConfirm}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function CapacityWarningConfirm({
  employeeName,
  existingPercent,
  addingPercent,
  isUpdate,
  onCancel,
  onContinue,
}: {
  readonly employeeName: string;
  readonly existingPercent: number;
  readonly addingPercent: number;
  readonly isUpdate?: boolean;
  readonly onCancel: () => void;
  readonly onContinue: () => void;
}) {
  const titleId = useId();
  const total = existingPercent + addingPercent;
  return (
    <div className={ui.overlayNested} role="presentation">
      <div
        className={projectsUi.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Allocation over 100%</h2>
        <p>
          <strong>{employeeName}</strong> is already assigned with{" "}
          <strong>{formatPercent(existingPercent)}%</strong> on overlapping
          dates
          {isUpdate ? " on other project(s)" : ""}.{" "}
          {isUpdate ? "Updating" : "Adding"}{" "}
          <strong>{formatPercent(addingPercent)}%</strong> would bring the total
          to <strong>{formatPercent(total)}%</strong>.
        </p>
        <p>You can still continue and assign this employee.</p>
        <div className={projectsUi.formActions}>
          <button
            type="button"
            className={projectsUi.btnGhost}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={projectsUi.btnPrimary}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export const AllocateResourcesDialog = forwardRef<
  AllocateResourcesDialogHandle,
  AllocateResourcesDialogProps
>(function AllocateResourcesDialog(
  {
    project,
    employees,
    onEmployeeSearch,
    employeesLoading = false,
    clientLocations = EMPTY_CLIENT_LOCATIONS,
    assignedEmployeeIds = EMPTY_ASSIGNED_IDS,
    initialAllocations = EMPTY_ALLOCATION_ROWS,
    allAllocations = EMPTY_PROJECT_ALLOCATIONS,
    embedded = false,
    readOnly: readOnlyProp = false,
    hideFooter = false,
    showAddAction = true,
    busy = false,
    onClose,
    onAllocate,
  },
  ref,
) {
  const projectEnded = isProjectEnded(project);
  const readOnly = readOnlyProp || projectEnded;
  const projectEndDate = projectEffectiveEndDate(project);
  const titleId = useId();
  const formSectionRef = useRef<HTMLTableRowElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [rows, setRows] = useState<ResourceAllocationRow[]>(() => [
    ...initialAllocations,
  ]);
  const [formOpen, setFormOpen] = useState(
    () => !readOnly && initialAllocations.length === 0,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [capacityWarning, setCapacityWarning] = useState<{
    readonly row: ResourceAllocationRow;
    readonly existingPercent: number;
    readonly isUpdate: boolean;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearForm() {
    setForm(INITIAL_FORM);
    setFieldErrors({});
    setEditingId(null);
  }

  function openAddEditor() {
    if (readOnly || busy || submitting) {
      return;
    }
    clearForm();
    setFormOpen(true);
    setSubmitError(null);
  }

  useImperativeHandle(ref, () => ({
    getRows: () => [...rows],
    hasOpenEditor: () =>
      !readOnly && (formOpen || editingId != null || pendingRemoveId != null),
    openAddEditor,
  }));

  useLayoutEffect(() => {
    if (readOnly || (!formOpen && editingId == null)) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const row = formSectionRef.current;
      if (!row) {
        return;
      }
      const wrap = wrapRef.current;
      if (wrap instanceof HTMLElement) {
        if (editingId == null) {
          wrap.scrollTop = wrap.scrollHeight;
        }
        /* Keep the first columns visible — never shift horizontally. */
        wrap.scrollLeft = 0;
      }
      row.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
      /* scrollIntoView can nudge scrollLeft; pin back to the leading columns. */
      if (wrap instanceof HTMLElement) {
        wrap.scrollLeft = 0;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [formOpen, editingId, readOnly]);

  useEffect(() => {
    setRows([...initialAllocations]);
    if (readOnly) {
      setFormOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFieldErrors({});
      return;
    }
    if (initialAllocations.length > 0) {
      setFormOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFieldErrors({});
    } else {
      setFormOpen(true);
    }
  }, [initialAllocations, readOnly]);

  const assignedIds = useMemo(
    () => new Set(assignedEmployeeIds),
    [assignedEmployeeIds],
  );

  const blockedEmployeeIds = useMemo(() => {
    const blocked = new Set(assignedIds);
    for (const row of rows) {
      if (row.id !== editingId) {
        blocked.add(row.employeeId);
      }
    }
    return blocked;
  }, [assignedIds, rows, editingId]);

  // A search shows only some people at a time; the ones already shown stay
  // known so a chosen person keeps their locations and designation.
  const knownEmployeesRef = useRef(new Map<string, EmployeeOption>());
  for (const employee of employees) {
    knownEmployeesRef.current.set(employee.id, employee);
  }
  const isActiveEmployee = (employee: EmployeeOption) =>
    !employee.status || employee.status.trim().toUpperCase() === "ACTIVE";

  const activeEmployees = useMemo(
    () => employees.filter(isActiveEmployee),
    [employees],
  );

  const employeeOptions = useMemo(
    () =>
      activeEmployees
        .filter((employee) => {
          if (form.employeeId === employee.id) {
            return true;
          }
          return !blockedEmployeeIds.has(employee.id);
        })
        .map((employee) => ({
          value: employee.id,
          label: employeePickerLabel(
            employee,
            currentLoadPercent(employee.id, allAllocations),
          ),
        })),
    [activeEmployees, allAllocations, blockedEmployeeIds, form.employeeId],
  );

  const pickedEmployee = form.employeeId
    ? knownEmployeesRef.current.get(form.employeeId)
    : undefined;
  const selectedEmployee =
    pickedEmployee && isActiveEmployee(pickedEmployee)
      ? pickedEmployee
      : undefined;
  const pickedEmployeeLabel = pickedEmployee
    ? employeePickerLabel(pickedEmployee, 0)
    : undefined;
  const defaultDesignation =
    selectedEmployee?.designation?.trim() ||
    selectedEmployee?.department?.trim() ||
    "";

  const workLocationOptions = useMemo(
    () => buildWorkLocationOptions(selectedEmployee),
    [selectedEmployee],
  );
  const clientLocationOptions = useMemo(
    () => buildClientLocationOptions(clientLocations),
    [clientLocations],
  );

  const roleOptions = useMemo(
    () =>
      PROJECT_ALLOCATION_ROLES.map((role) => ({
        value: role,
        label: role,
      })),
    [],
  );

  const pendingRemove = rows.find((row) => row.id === pendingRemoveId) ?? null;

  function patchForm(partial: Partial<FormState>) {
    setForm((current) => {
      const next = { ...current, ...partial };
      if (partial.billable === false) {
        next.billabilityPercentage = "";
      }
      return next;
    });
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(partial) as (keyof FormState)[]) {
        delete next[key as keyof FormErrors];
      }
      if (partial.billable === false) {
        delete next.billabilityPercentage;
      }
      return next;
    });
  }

  function patchDateField(
    partial: Partial<Pick<FormState, "startDate" | "endDate">>,
  ) {
    const next = { ...form, ...partial };
    setForm(next);
    const dateErrors = validateAllocationDates(
      next,
      project.startDate,
      projectEndDate,
      { requireComplete: false },
    );
    setFieldErrors((errors) => {
      const updated = { ...errors };
      delete updated.startDate;
      delete updated.endDate;
      return { ...updated, ...dateErrors };
    });
    setSubmitError(null);
  }

  function validationOptionsFor(
    formState: FormState,
    editingRowId: string | null,
  ) {
    const employee = knownEmployeesRef.current.get(formState.employeeId);
    return {
      rows,
      editingId: editingRowId,
      assignedEmployeeIds: assignedIds,
      projectStartDate: project.startDate,
      projectEndDate,
      workLocationOptions: buildWorkLocationOptions(employee),
      clientLocationOptions,
    };
  }

  function buildRowFromForm(id: string): ResourceAllocationRow | null {
    const errors = validateForm(form, validationOptionsFor(form, editingId));
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError(null);
      return null;
    }
    const picked = knownEmployeesRef.current.get(form.employeeId);
    const employee = picked && isActiveEmployee(picked) ? picked : undefined;
    if (!employee) {
      setFieldErrors({ employeeId: "Select an active employee." });
      return null;
    }
    const allocation = parsePercentage(form.allocationPercentage);
    if (allocation == null) {
      return null;
    }
    const billability = form.billable
      ? parsePercentage(form.billabilityPercentage)
      : null;

    const workParsed = parseWorkLocationOptionValue(form.workLocationKey);
    const workOption = workLocationOptions.find(
      (option) => option.value === form.workLocationKey,
    );
    const clientOption = clientLocationOptions.find(
      (option) => option.value === form.clientLocationId,
    );

    return {
      id,
      employeeId: employee.id,
      employeeName: employee.displayName,
      employeeCode: employee.employeeCode ?? "",
      designation:
        employee.designation?.trim() || employee.department?.trim() || "—",
      projectRole: form.projectRole,
      workLocationId: workParsed?.locationId ?? "",
      workLocationKind: workParsed?.kind ?? "",
      workLocationLabel: workOption?.label.replace(
        /^(Work \/ Office|Residential) — /,
        "",
      ) ?? "",
      clientLocationId: form.clientLocationId,
      clientLocationLabel: clientOption?.label ?? "",
      startDate: form.startDate,
      endDate: form.endDate,
      allocationPercentage: allocation,
      billable: form.billable,
      billabilityPercentage: form.billable ? billability : null,
    };
  }

  function commitRow(row: ResourceAllocationRow) {
    const next = editingId
      ? rows.map((item) => (item.id === editingId ? row : item))
      : [...rows, row];
    setRows(next);
    clearForm();
    setFormOpen(false);
    setSubmitError(null);
    setCapacityWarning(null);
    if (hideFooter && !readOnly) {
      void persistAllocations(next);
    }
  }

  function findCapacityIssue(
    row: ResourceAllocationRow,
    excludeAllocationId?: string | null,
  ) {
    return capacityOver100({
      employeeId: row.employeeId,
      projectId: project.id,
      startDate: row.startDate,
      endDate: row.endDate,
      allocationPercentage: row.allocationPercentage,
      allAllocations,
      excludeAllocationId: excludeAllocationId ?? null,
    });
  }

  function handleAddToList() {
    const editingRow = editingId
      ? rows.find((row) => row.id === editingId)
      : undefined;
    const employeeChanged =
      editingRow != null && editingRow.employeeId !== form.employeeId;
    // Changing the person on a persisted row must mint a new id so save
    // creates a replacement instead of 400 "Cannot change employee".
    const nextId = employeeChanged ? createRowId() : (editingId ?? createRowId());
    const row = buildRowFromForm(nextId);
    if (!row) {
      return;
    }
    const isUpdate = Boolean(editingId);
    const issue = findCapacityIssue(row, editingId);
    if (issue) {
      setCapacityWarning({
        row,
        existingPercent: issue.existingPercent,
        isUpdate,
      });
      return;
    }
    commitRow(row);
  }

  async function persistAllocations(nextRows: readonly ResourceAllocationRow[]) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onAllocate(nextRows);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to allocate resources.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinueCapacityWarning() {
    if (!capacityWarning) {
      return;
    }
    const { row } = capacityWarning;
    setCapacityWarning(null);
    commitRow(row);
  }

  function handleEdit(row: ResourceAllocationRow) {
    if (readOnly) {
      return;
    }
    setEditingId(row.id);
    setForm(formFromRow(row, clientLocations));
    setFieldErrors({});
    setFormOpen(true);
    setSubmitError(null);
  }

  function handleCancelEditor() {
    clearForm();
    setFormOpen(false);
  }

  function handleConfirmRemove() {
    if (!pendingRemoveId || readOnly) {
      return;
    }
    const next = rows.filter((row) => row.id !== pendingRemoveId);
    setRows(next);
    if (next.length === 0) {
      setFormOpen(true);
    }
    if (editingId === pendingRemoveId) {
      clearForm();
      setFormOpen(false);
    }
    setPendingRemoveId(null);
    setSubmitError(null);
    if (hideFooter) {
      void persistAllocations(next);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || busy || submitting) {
      return;
    }
    if (rows.length === 0) {
      setSubmitError("Add at least one resource before allocating.");
      return;
    }

    // Catch invalid list rows early (dates, billability, duplicates) and open
    // them for edit instead of failing on the API call.
    const invalidRow = rows.find((row) => {
      const rowForm = formFromRow(row, clientLocations);
      const rowErrors = validateForm(
        rowForm,
        validationOptionsFor(rowForm, row.id),
      );
      return Object.keys(rowErrors).length > 0;
    });
    if (invalidRow) {
      const rowForm = formFromRow(invalidRow, clientLocations);
      const rowErrors = validateForm(
        rowForm,
        validationOptionsFor(rowForm, invalidRow.id),
      );
      setEditingId(invalidRow.id);
      setForm(rowForm);
      setFieldErrors(rowErrors);
      setFormOpen(true);
      setSubmitError(null);
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
      return;
    }

    // If the entry form is open with unsaved values, require Add to list first
    // (and surface field errors there) rather than allocating a stale list.
    const formIsOpen = formOpen || editingId != null;
    if (formIsOpen) {
      const formErrors = validateForm(
        form,
        validationOptionsFor(form, editingId),
      );
      const hasPartialEntry =
        Boolean(form.employeeId) ||
        Boolean(form.projectRole.trim()) ||
        Boolean(form.workLocationKey.trim()) ||
        Boolean(form.clientLocationId.trim()) ||
        Boolean(form.startDate) ||
        Boolean(form.endDate) ||
        Boolean(form.allocationPercentage.trim());
      if (hasPartialEntry || editingId) {
        setFieldErrors(formErrors);
        setSubmitError(
          Object.keys(formErrors).length > 0
            ? null
            : "Click Add to list before allocating resources.",
        );
        if (Object.keys(formErrors).length > 0) {
          errorsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }
        return;
      }
    }

    setSubmitError(null);
    void persistAllocations(rows);
  }

  const disabled = busy || submitting || readOnly;
  const showForm = !readOnly && (formOpen || editingId != null);
  const displayCount = rows.length;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const fieldErrorSummary = Object.values(fieldErrors)
    .filter(Boolean)
    .join(" ");

  useLayoutEffect(() => {
    if (!hasFieldErrors) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const target = errorsRef.current ?? formSectionRef.current;
      target?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasFieldErrors, fieldErrorSummary]);

  const columns = useMemo<AppDataTableColumn<ResourceAllocationRow>[]>(
    () => [
      {
        id: "employeeName",
        header: "Employee",
        value: (row) => row.employeeName,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-[0.15rem] leading-[1.3]">
            <span className="font-semibold text-emp-text">
              {row.employeeName}
            </span>
            {row.designation?.trim() && row.designation.trim() !== "—" ? (
              <span className={projectsUi.employeeDesignation}>
                {row.designation.trim()}
              </span>
            ) : null}
          </div>
        ),
        width: 200,
        minWidth: 140,
        maxWidth: 420,
        hideable: false,
        rowHeader: true,
        cellClassName: TEXT_CELL,
      },
      {
        id: "projectRole",
        header: "Role",
        value: (row) => row.projectRole,
        width: 160,
        minWidth: 110,
        maxWidth: 360,
        cellClassName: TEXT_CELL,
      },
      {
        id: "workLocation",
        header: "Work Location",
        value: (row) => row.workLocationLabel || "—",
        cell: (row) => (
          <AllocationLocationCell label={row.workLocationLabel || "—"} />
        ),
        width: 180,
        minWidth: 120,
        maxWidth: 420,
        cellClassName: LOCATION_CELL,
      },
      {
        id: "clientLocation",
        header: "Client Location",
        value: (row) => row.clientLocationLabel || "—",
        cell: (row) => (
          <AllocationLocationCell label={row.clientLocationLabel || "—"} />
        ),
        width: 160,
        minWidth: 110,
        maxWidth: 420,
        cellClassName: LOCATION_CELL,
      },
      {
        id: "period",
        header: "Period",
        value: (row) => formatAllocationPeriod(row.startDate, row.endDate),
        width: 260,
        minWidth: 200,
        maxWidth: 420,
        cellClassName: TEXT_CELL,
      },
      {
        id: "allocationPercentage",
        header: "Alloc %",
        value: (row) => `${row.allocationPercentage}%`,
        width: 88,
        minWidth: 72,
        maxWidth: 160,
      },
      {
        id: "billable",
        header: "Billable",
        value: (row) => (row.billable ? "Yes" : "No"),
        width: 96,
        minWidth: 80,
        maxWidth: 160,
      },
      {
        id: "billPercent",
        header: "Bill %",
        value: (row) =>
          row.billable && row.billabilityPercentage != null
            ? `${row.billabilityPercentage}%`
            : "—",
        width: 88,
        minWidth: 72,
        maxWidth: 100,
      },
      ...(readOnly
        ? []
        : [
            {
              id: "actions",
              header: "Actions",
              /* Compact for kebab; widen only while Cancel + Update are visible. */
              width: showForm ? 176 : 72,
              minWidth: 64,
              maxWidth: 176,
              fixedWidth: true,
              movable: false,
              resizable: false,
              hideable: false,
              cell: (row: ResourceAllocationRow) => (
                <RowActionsMenu
                  employeeLabel={row.employeeName}
                  onEdit={() => handleEdit(row)}
                  onRemove={() => setPendingRemoveId(row.id)}
                />
              ),
              headerClassName: cx(ui.cellActions, ACTIONS_CELL),
              cellClassName: cx(ui.cellActions, ACTIONS_CELL),
            },
          ]),
    ],
    // handleEdit only reads `readOnly` and sets state.
    [readOnly, showForm],
  );

  function editorCell(
    columnId: string,
    className: string | undefined,
    children: ReactNode,
    options?: { clip?: boolean },
  ): ReactNode {
    const clip = options?.clip !== false;
    return (
      <td key={columnId} className={className ?? projectsUi.inlineCell}>
        {clip ? (
          <div className={projectsUi.inlineClip}>{children}</div>
        ) : (
          children
        )}
      </td>
    );
  }

  function renderEditorCell(columnId: string): ReactNode {
    switch (columnId) {
      case "employeeName":
        return editorCell(
          columnId,
          TEXT_CELL,
          <>
            <EmployeesSearchCombobox
              value={form.employeeId}
              options={employeeOptions}
              allowEmpty={false}
              placeholder="Search employee"
              aria-label="Search employee"
              disabled={disabled}
              selectedLabel={pickedEmployeeLabel}
              serverFiltered={Boolean(onEmployeeSearch)}
              loading={employeesLoading}
              onOpenChange={(open) => {
                if (!open) {
                  onEmployeeSearch?.(null);
                }
              }}
              onQueryChange={onEmployeeSearch}
              onChange={(value) =>
                patchForm({ employeeId: value, workLocationKey: "" })
              }
            />
            {defaultDesignation ? (
              <span
                className={projectsUi.employeeDesignation}
                aria-live="polite"
              >
                {defaultDesignation}
              </span>
            ) : null}
            {fieldErrors.employeeId ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.employeeId}
              </span>
            ) : null}
          </>,
        );
      case "projectRole":
        return editorCell(
          columnId,
          undefined,
          <>
            <EmployeesSearchCombobox
              value={form.projectRole}
              options={roleOptions}
              allowEmpty={false}
              placeholder="Select role"
              noMatchesMessage="No matching roles"
              aria-label="Select role"
              disabled={disabled}
              onChange={(value) => patchForm({ projectRole: value })}
            />
            {fieldErrors.projectRole ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.projectRole}
              </span>
            ) : null}
          </>,
        );
      case "workLocation":
        return editorCell(
          columnId,
          LOCATION_CELL,
          <>
            <EmployeesSearchCombobox
              value={form.workLocationKey}
              options={workLocationOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              allowEmpty
              emptyLabel={
                form.employeeId && workLocationOptions.length > 0 ? "None" : ""
              }
              placeholder={
                form.employeeId
                  ? workLocationOptions.length > 0
                    ? "Select work location (optional)"
                    : "No work locations"
                  : "Select employee first"
              }
              noMatchesMessage="No matching work locations"
              aria-label="Select work location"
              disabled={
                disabled || !form.employeeId || workLocationOptions.length === 0
              }
              onChange={(value) => patchForm({ workLocationKey: value })}
            />
            {fieldErrors.workLocationKey ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.workLocationKey}
              </span>
            ) : null}
          </>,
        );
      case "clientLocation":
        return editorCell(
          columnId,
          LOCATION_CELL,
          <>
            <EmployeesSearchCombobox
              value={form.clientLocationId}
              options={clientLocationOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              allowEmpty
              emptyLabel={clientLocationOptions.length > 0 ? "None" : ""}
              placeholder={
                clientLocationOptions.length > 0
                  ? "Select client location (optional)"
                  : "No client locations"
              }
              noMatchesMessage="No matching client locations"
              aria-label="Select client location"
              disabled={disabled || clientLocationOptions.length === 0}
              onChange={(value) => patchForm({ clientLocationId: value })}
            />
            {fieldErrors.clientLocationId ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.clientLocationId}
              </span>
            ) : null}
          </>,
        );
      case "period":
        return editorCell(
          columnId,
          undefined,
          <>
            <div className={projectsUi.inlinePeriod}>
              <AppDateField
                value={form.startDate}
                minDate={project.startDate || undefined}
                maxDate={projectEndDate || undefined}
                disabled={disabled}
                aria-label="Allocation start"
                onChange={(startDate) => patchDateField({ startDate })}
              />
              <span className={projectsUi.inlinePeriodSep} aria-hidden>
                –
              </span>
              <AppDateField
                value={form.endDate}
                minDate={form.startDate || project.startDate || undefined}
                maxDate={projectEndDate || undefined}
                disabled={disabled}
                aria-label="Allocation end"
                onChange={(endDate) => patchDateField({ endDate })}
              />
            </div>
            {fieldErrors.startDate || fieldErrors.endDate ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.startDate || fieldErrors.endDate}
              </span>
            ) : null}
          </>,
        );
      case "allocationPercentage":
        return editorCell(
          columnId,
          undefined,
          <>
            <div className={projectsUi.pctField}>
              <input
                className={cx(CATALOG_CONTROL, "w-full")}
                type="number"
                inputMode="decimal"
                min={0.01}
                max={100}
                step="0.01"
                value={form.allocationPercentage}
                disabled={disabled}
                aria-label="Allocation percent"
                onChange={(event) =>
                  patchForm({ allocationPercentage: event.target.value })
                }
              />
              <span className={projectsUi.pctSuffix} aria-hidden>
                %
              </span>
            </div>
            {fieldErrors.allocationPercentage ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.allocationPercentage}
              </span>
            ) : null}
          </>,
        );
      case "billable":
        return editorCell(
          columnId,
          undefined,
          <AppCheckbox
            checked={form.billable}
            disabled={disabled}
            label="Yes"
            className={projectsUi.inlineBillable}
            onChange={(billable) => patchForm({ billable })}
          />,
        );
      case "billPercent":
        return editorCell(
          columnId,
          undefined,
          form.billable ? (
            <>
              <div className={projectsUi.pctField}>
                <input
                  className={cx(CATALOG_CONTROL, "w-full")}
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={100}
                  step="0.01"
                  value={form.billabilityPercentage}
                  disabled={disabled}
                  aria-label="Billability percent"
                  onChange={(event) =>
                    patchForm({
                      billabilityPercentage: event.target.value,
                    })
                  }
                />
                <span className={projectsUi.pctSuffix} aria-hidden>
                  %
                </span>
              </div>
              {fieldErrors.billabilityPercentage ? (
                <span className={projectsUi.inlineError} role="alert">
                  {fieldErrors.billabilityPercentage}
                </span>
              ) : null}
            </>
          ) : (
            <span className={projectsUi.inlineReadonly}>—</span>
          ),
        );
      case "actions":
        return editorCell(
          columnId,
          `${ACTIONS_CELL} !max-w-none`,
          <div className={projectsUi.inlineActions}>
            <AppButton
              variant="secondary"
              size="compact"
              className="whitespace-nowrap"
              disabled={disabled}
              onClick={handleCancelEditor}
            >
              Cancel
            </AppButton>
            <AppButton
              size="compact"
              className="whitespace-nowrap"
              disabled={disabled}
              onClick={handleAddToList}
            >
              {editingId ? "Update" : "Add"}
            </AppButton>
          </div>,
          { clip: false },
        );
      default:
        return editorCell(columnId, undefined, null);
    }
  }

  const renderEditorCells = (columnIds: readonly string[]) =>
    columnIds.map((columnId) => renderEditorCell(columnId));

  const showAdd = showAddAction && !showForm && !readOnly;

  const formBody = (
    <>
      {submitError ? (
        <p className="m-0 text-[0.85rem] text-red-700" role="alert">
          {submitError}
        </p>
      ) : null}

      <section
        className={projectsUi.embedded}
        aria-labelledby={`${titleId}-table`}
      >
        {embedded ? null : (
          <h3 id={`${titleId}-table`} className={projectsUi.tableTitle}>
            Allocated Resources ({displayCount})
          </h3>
        )}
        {showAdd ? (
          <div className="mb-[0.55rem] flex justify-end">
            <AppButton
              variant="ghost"
              size="compact"
              className="!text-emp-accent font-bold hover:underline"
              disabled={disabled}
              onClick={openAddEditor}
            >
              + Allocate Resource
            </AppButton>
          </div>
        ) : null}
        <AppDataTable
          ariaLabel="Allocated resources"
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          resizable
          columnReorder="drag"
          stickyHeader={{ maxHeight: "calc(3rem + 5 * 3.9rem)" }}
          scrollRef={wrapRef}
          emptyText={
            readOnly
              ? "No resources allocated yet."
              : "No resources allocated yet. Use + Allocate Resource to begin."
          }
          editorRow={
            showForm
              ? {
                  rowId: editingId,
                  cells: renderEditorCells,
                  rowRef: formSectionRef,
                }
              : undefined
          }
        />
        {showForm && hasFieldErrors ? (
          <div
            ref={errorsRef}
            className={projectsUi.inlineErrors}
            role="alert"
          >
            {fieldErrorSummary ||
              `Fix the fields, then click ${editingId ? "Update" : "Add"}.`}
          </div>
        ) : null}
        {projectEnded ? (
          <p className="m-0 text-[0.85rem] text-amber-800" role="status">
            {projectEndedAllocationMessage(project)}
          </p>
        ) : !embedded || !readOnly ? (
          <p className={projectsUi.hint}>
            Allocating to <strong>{project.name}</strong>
            {project.code ? ` (${project.code})` : ""}.
            {project.startDate || projectEndDate
              ? ` Allocation dates must fall within the project window${
                  project.startDate ? ` from ${project.startDate}` : ""
                }${projectEndDate ? ` to ${projectEndDate}` : ""}.`
              : ""}
          </p>
        ) : null}
      </section>
    </>
  );

  const formFooter =
    hideFooter || (embedded && readOnly) ? null : (
      <CatalogDialogFooter className={projectsUi.footer}>
        <p className="m-0 text-[0.85rem] text-emp-muted">
          {displayCount === 1
            ? "1 resource allocated."
            : `${displayCount} resources allocated.`}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <CatalogButton
            type="button"
            variant="ghost"
            disabled={busy || submitting}
            onClick={onClose}
          >
            {readOnly ? "Close" : "Cancel"}
          </CatalogButton>
          {readOnly ? null : (
            <CatalogButton
              type="submit"
              variant="primary"
              disabled={disabled || rows.length === 0}
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon size={15} />
                Allocate Resources
              </span>
            </CatalogButton>
          )}
        </div>
      </CatalogDialogFooter>
    );

  const confirms = (
    <>
      {pendingRemove && !readOnly ? (
        <RemoveAllocationConfirm
          employeeName={pendingRemove.employeeName}
          onCancel={() => setPendingRemoveId(null)}
          onConfirm={handleConfirmRemove}
        />
      ) : null}

      {capacityWarning && !readOnly ? (
        <CapacityWarningConfirm
          employeeName={capacityWarning.row.employeeName}
          existingPercent={capacityWarning.existingPercent}
          addingPercent={capacityWarning.row.allocationPercentage}
          isUpdate={capacityWarning.isUpdate}
          onCancel={() => setCapacityWarning(null)}
          onContinue={handleContinueCapacityWarning}
        />
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <>
        <div className={projectsUi.embedded}>
          <form
            className={cx(projectsUi.allocateForm, "grid gap-5")}
            onSubmit={handleSubmit}
            noValidate
          >
            {formBody}
            {formFooter}
          </form>
        </div>
        {confirms}
      </>
    );
  }

  return (
    <>
      <CatalogModal
        title="Allocate Resources"
        titleId={titleId}
        size="xlarge"
        accentTop
        backdrop="create"
        onClose={onClose}
        onSubmit={handleSubmit}
        bodyClassName={cx(
          projectsUi.allocateForm,
          projectsUi.allocateModalBody,
          "grid gap-5",
        )}
        footer={formFooter}
      >
        {formBody}
      </CatalogModal>
      {confirms}
    </>
  );
});
