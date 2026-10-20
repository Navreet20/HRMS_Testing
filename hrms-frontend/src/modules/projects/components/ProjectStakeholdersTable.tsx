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

import { AppButton, AppDataTable, type AppDataTableColumn } from "@/shared/ui";
import { CheckIcon } from "@/shared/ui/icons";
import { EmployeesPhoneInput } from "@/modules/employees/components/EmployeesPhoneInput";
import {
  CatalogButton,
  CatalogDialogFooter,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import {
  emptyStakeholderDraft,
  STAKEHOLDER_DEPARTMENT_MAX,
  STAKEHOLDER_EMAIL_MAX,
  STAKEHOLDER_NAME_MAX,
  STAKEHOLDER_TITLE_MAX,
  type ClientStakeholderDraft,
} from "@/modules/clients/createClientDraft";
import { MoreIcon } from "./icons";
import { projectsUi } from "../uiClasses";


interface StakeholderTableRow extends ClientStakeholderDraft {
  readonly rowId: string;
}

interface FormState {
  name: string;
  title: string;
  department: string;
  email: string;
  phoneNumber: string;
}

interface FormErrors {
  name?: string;
  email?: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  title: "",
  department: "",
  email: "",
  phoneNumber: "",
};

const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|edu)$/i;

/** Body cells wrap long values instead of cutting them off. */
const TEXT_CELL = "!whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]";
const ACTIONS_CELL = "!px-3 whitespace-nowrap !overflow-visible";

function createRowId(): string {
  return `stakeholder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function toTableRows(
  rows: readonly ClientStakeholderDraft[],
): StakeholderTableRow[] {
  return rows
    .filter(
      (row) =>
        row.name.trim() ||
        row.title.trim() ||
        row.department.trim() ||
        row.email.trim() ||
        row.phoneNumber.trim(),
    )
    .map((row, index) => ({
      ...row,
      rowId: String(row.id ?? row.stakeholderId ?? `existing-${index}`),
    }));
}

function formFromRow(row: StakeholderTableRow): FormState {
  return {
    name: row.name,
    title: row.title,
    department: row.department,
    email: row.email,
    phoneNumber: row.phoneNumber,
  };
}

function toDraftRows(
  rows: readonly StakeholderTableRow[],
): ClientStakeholderDraft[] {
  if (rows.length === 0) {
    return [emptyStakeholderDraft()];
  }
  return rows.map(({ rowId: _rowId, ...rest }) => rest);
}

function RowActionsMenu({
  label,
  onEdit,
  onRemove,
}: {
  readonly label: string;
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
            aria-label={`Actions for ${label}`}
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
        aria-label={`Actions for ${label}`}
        onClick={toggleOpen}
      >
        <MoreIcon />
      </button>
      {menu}
    </div>
  );
}

function RemoveStakeholderConfirm({
  stakeholderName,
  onCancel,
  onConfirm,
}: {
  readonly stakeholderName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const titleId = useId();
  const displayName = stakeholderName.trim() || "this stakeholder";
  return (
    <div className={ui.overlayNested} role="presentation">
      <div
        className={projectsUi.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Remove stakeholder?</h2>
        <p>
          Are you sure you want to remove <strong>{displayName}</strong> from
          this project?
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

interface ProjectStakeholdersTableProps {
  readonly rows: readonly ClientStakeholderDraft[];
  readonly readOnly?: boolean;
  readonly busy?: boolean;
  readonly error?: string | null;
  /** Hide Cancel/Save footer; row add/update/remove auto-persists via onSave. */
  readonly hideFooter?: boolean;
  /**
   * When false, parent renders "+ Add Stakeholder" (via openAddEditor).
   * Default true.
   */
  readonly showAddAction?: boolean;
  readonly onClose: () => void;
  readonly onSave: (
    rows: readonly ClientStakeholderDraft[],
  ) => void | Promise<void>;
}

export type ProjectStakeholdersTableHandle = {
  getRows: () => ClientStakeholderDraft[];
  hasOpenEditor: () => boolean;
  openAddEditor: () => void;
};

export const ProjectStakeholdersTable = forwardRef<
  ProjectStakeholdersTableHandle,
  ProjectStakeholdersTableProps
>(function ProjectStakeholdersTable(
  {
    rows: initialRows,
    readOnly = false,
    busy = false,
    error = null,
    hideFooter = false,
    showAddAction = true,
    onClose,
    onSave,
  },
  ref,
) {
  const titleId = useId();
  const formSectionRef = useRef<HTMLTableRowElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<StakeholderTableRow[]>(() =>
    toTableRows(initialRows),
  );
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formOpen, setFormOpen] = useState(
    () => !readOnly && toTableRows(initialRows).length === 0,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openAddEditor() {
    if (readOnly || busy || submitting) {
      return;
    }
    clearForm();
    setFormOpen(true);
    setSubmitError(null);
  }

  useImperativeHandle(ref, () => ({
    getRows: () => toDraftRows(rows),
    hasOpenEditor: () =>
      !readOnly &&
      (formOpen || editingId != null || pendingRemoveId != null),
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
        wrap.scrollLeft = 0;
      }
      row.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
      if (wrap instanceof HTMLElement) {
        wrap.scrollLeft = 0;
      }
      const nameInput = row.querySelector<HTMLInputElement>(
        'input[aria-label="Stakeholder full name"]',
      );
      nameInput?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [formOpen, editingId, readOnly]);

  useEffect(() => {
    const next = toTableRows(initialRows);
    setRows(next);
    if (readOnly) {
      setFormOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFieldErrors({});
      return;
    }
    if (next.length > 0) {
      setFormOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFieldErrors({});
    } else {
      setFormOpen(true);
    }
  }, [initialRows, readOnly]);

  function clearForm() {
    setForm(INITIAL_FORM);
    setFieldErrors({});
    setEditingId(null);
  }

  async function persistRows(nextRows: readonly StakeholderTableRow[]) {
    if (!hideFooter || readOnly) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSave(toDraftRows(nextRows));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save stakeholders.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function patchForm(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }));
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(partial) as (keyof FormState)[]) {
        if (key === "name" || key === "email") {
          delete next[key];
        }
      }
      return next;
    });
  }

  function validateForm(): FormErrors {
    const next: FormErrors = {};
    const name = form.name.trim();
    if (!name) {
      next.name = "Full name is required.";
    } else if (name.length > STAKEHOLDER_NAME_MAX) {
      next.name = `Name must be ${STAKEHOLDER_NAME_MAX} characters or fewer.`;
    }
    const email = form.email.trim();
    if (email && (email.length > STAKEHOLDER_EMAIL_MAX || !EMAIL_REGEX.test(email))) {
      next.email = "Enter an email ending in .com or .edu.";
    }
    return next;
  }

  function buildRowFromForm(rowId: string): StakeholderTableRow {
    return {
      rowId,
      id: editingId
        ? rows.find((row) => row.rowId === editingId)?.id
        : undefined,
      stakeholderId: editingId
        ? rows.find((row) => row.rowId === editingId)?.stakeholderId
        : undefined,
      name: form.name.trim(),
      title: form.title.trim(),
      department: form.department.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
    };
  }

  function handleEdit(row: StakeholderTableRow) {
    if (readOnly) {
      return;
    }
    setEditingId(row.rowId);
    setForm(formFromRow(row));
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
    const next = rows.filter((row) => row.rowId !== pendingRemoveId);
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
    void persistRows(next);
  }

  function handleAddToList() {
    if (readOnly || busy || submitting) {
      return;
    }
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    const row = buildRowFromForm(editingId ?? createRowId());
    const next = editingId
      ? rows.map((item) => (item.rowId === editingId ? row : item))
      : [...rows, row];
    setRows(next);
    clearForm();
    setFormOpen(false);
    setSubmitError(null);
    void persistRows(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || busy || submitting) {
      return;
    }

    const formIsOpen = formOpen || editingId != null;
    if (formIsOpen) {
      const formErrors = validateForm();
      const hasPartialEntry =
        Boolean(form.name.trim()) ||
        Boolean(form.title.trim()) ||
        Boolean(form.department.trim()) ||
        Boolean(form.email.trim()) ||
        Boolean(form.phoneNumber.trim());
      if (hasPartialEntry || editingId) {
        setFieldErrors(formErrors);
        setSubmitError(
          Object.keys(formErrors).length > 0
            ? null
            : "Click Add before saving stakeholders.",
        );
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSave(toDraftRows(rows));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save stakeholders.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = busy || submitting || readOnly;
  const showForm = !readOnly && (formOpen || editingId != null);
  const displayCount = rows.length;
  const pendingRemove =
    rows.find((row) => row.rowId === pendingRemoveId) ?? null;
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

  const columns = useMemo<AppDataTableColumn<StakeholderTableRow>[]>(
    () => [
      {
        id: "name",
        header: "Full Name",
        value: (row) => row.name.trim() || "—",
        width: 180,
        minWidth: 120,
        maxWidth: 420,
        hideable: false,
        rowHeader: true,
        cellClassName: TEXT_CELL,
      },
      {
        id: "title",
        header: "Title",
        value: (row) => row.title.trim() || "—",
        width: 200,
        minWidth: 120,
        maxWidth: 480,
        cellClassName: TEXT_CELL,
      },
      {
        id: "department",
        header: "Department",
        value: (row) => row.department.trim() || "—",
        width: 180,
        minWidth: 110,
        maxWidth: 420,
        cellClassName: TEXT_CELL,
      },
      {
        id: "email",
        header: "Email",
        value: (row) => row.email.trim() || "—",
        width: 220,
        minWidth: 140,
        maxWidth: 480,
        cellClassName: TEXT_CELL,
      },
      {
        id: "phoneNumber",
        header: "Phone",
        value: (row) => row.phoneNumber.trim() || "—",
        width: 168,
        minWidth: 140,
        maxWidth: 200,
        cellClassName: TEXT_CELL,
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
              cell: (row: StakeholderTableRow) => (
                <RowActionsMenu
                  label={row.name || "stakeholder"}
                  onEdit={() => handleEdit(row)}
                  onRemove={() => setPendingRemoveId(row.rowId)}
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

  function renderEditorCell(columnId: string): ReactNode {
    switch (columnId) {
      case "name":
        return (
          <td key={columnId} className={projectsUi.inlineCell}>
            <input
              className={cx(
                CATALOG_CONTROL,
                "w-full !rounded-[0.45rem] !bg-emp-surface",
              )}
              value={form.name}
              placeholder="Full Name"
              maxLength={STAKEHOLDER_NAME_MAX}
              disabled={disabled}
              aria-label="Stakeholder full name"
              onChange={(event) => patchForm({ name: event.target.value })}
            />
            {fieldErrors.name ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.name}
              </span>
            ) : null}
          </td>
        );
      case "title":
        return (
          <td key={columnId} className={projectsUi.inlineCell}>
            <input
              className={cx(
                CATALOG_CONTROL,
                "w-full !rounded-[0.45rem] !bg-emp-surface",
              )}
              value={form.title}
              placeholder="(e.g., Director of Eng)"
              maxLength={STAKEHOLDER_TITLE_MAX}
              disabled={disabled}
              aria-label="Stakeholder title"
              onChange={(event) => patchForm({ title: event.target.value })}
            />
          </td>
        );
      case "department":
        return (
          <td key={columnId} className={projectsUi.inlineCell}>
            <input
              className={cx(
                CATALOG_CONTROL,
                "w-full !rounded-[0.45rem] !bg-emp-surface",
              )}
              value={form.department}
              placeholder="Optional"
              maxLength={STAKEHOLDER_DEPARTMENT_MAX}
              disabled={disabled}
              aria-label="Stakeholder department"
              onChange={(event) =>
                patchForm({ department: event.target.value })
              }
            />
          </td>
        );
      case "email":
        return (
          <td key={columnId} className={projectsUi.inlineCell}>
            <input
              className={cx(
                CATALOG_CONTROL,
                "w-full !rounded-[0.45rem] !bg-emp-surface",
              )}
              type="email"
              value={form.email}
              placeholder="name@company.com"
              maxLength={STAKEHOLDER_EMAIL_MAX}
              disabled={disabled}
              aria-label="Stakeholder email"
              onChange={(event) => patchForm({ email: event.target.value })}
            />
            {fieldErrors.email ? (
              <span className={projectsUi.inlineError} role="alert">
                {fieldErrors.email}
              </span>
            ) : null}
          </td>
        );
      case "phoneNumber":
        return (
          <td key={columnId} className={projectsUi.inlineCell}>
            <EmployeesPhoneInput
              label=""
              appearance="inline"
              value={form.phoneNumber}
              disabled={disabled}
              ariaLabel="Stakeholder phone"
              onChange={(phone) => patchForm({ phoneNumber: phone })}
            />
          </td>
        );
      case "actions":
        return (
          <td
            key={columnId}
            className={cx(projectsUi.inlineActionsCell, ACTIONS_CELL, "!max-w-none")}
          >
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
            </div>
          </td>
        );
      default:
        return <td key={columnId} className={projectsUi.inlineCell} />;
    }
  }

  const renderEditorCells = (columnIds: readonly string[]) =>
    columnIds.map((columnId) => renderEditorCell(columnId));

  const showAdd =
    showAddAction && !showForm && !readOnly;

  return (
    <>
      <div className={projectsUi.embedded}>
        <form
          className={cx(projectsUi.allocateForm, "grid gap-5")}
          onSubmit={handleSubmit}
          noValidate
        >
          {error || submitError ? (
            <p className="m-0 text-[0.85rem] text-red-700" role="alert">
              {submitError || error}
            </p>
          ) : null}

          <section
            className={projectsUi.embedded}
            aria-labelledby={`${titleId}-table`}
          >
            {showAdd ? (
              <div className="mb-[0.55rem] flex justify-end">
            <AppButton
              variant="ghost"
              size="compact"
              className="!text-emp-accent font-bold hover:underline"
              disabled={disabled}
              onClick={openAddEditor}
            >
              + Add Stakeholder
            </AppButton>
          </div>
            ) : null}
            <AppDataTable
              ariaLabel="Stakeholders and representatives"
              data={rows}
              columns={columns}
              getRowId={(row) => row.rowId}
              resizable
              fillWidth
              columnReorder="drag"
              stickyHeader={{ maxHeight: "calc(3rem + 5 * 3.9rem)" }}
              scrollRef={wrapRef}
              emptyText={
                readOnly
                  ? "No stakeholders added yet."
                  : "No stakeholders added yet. Use + Add Stakeholder to begin."
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
          </section>

          {readOnly || hideFooter ? null : (
            <CatalogDialogFooter className={projectsUi.footer}>
              <p className="m-0 text-[0.85rem] text-emp-muted">
                {displayCount === 1
                  ? "1 stakeholder."
                  : `${displayCount} stakeholders.`}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <CatalogButton
                  type="button"
                  variant="ghost"
                  disabled={busy || submitting}
                  onClick={onClose}
                >
                  Cancel
                </CatalogButton>
                <CatalogButton
                  type="submit"
                  variant="primary"
                  disabled={disabled}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CheckIcon size={15} />
                    Save Stakeholders
                  </span>
                </CatalogButton>
              </div>
            </CatalogDialogFooter>
          )}
        </form>
      </div>

      {pendingRemove && !readOnly ? (
        <RemoveStakeholderConfirm
          stakeholderName={pendingRemove.name}
          onCancel={() => setPendingRemoveId(null)}
          onConfirm={handleConfirmRemove}
        />
      ) : null}
    </>
  );
});
