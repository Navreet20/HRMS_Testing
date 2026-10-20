import { useId, useMemo, useState, type FormEvent, type ReactElement } from "react";

import { AppCheckbox } from "../../../shared/ui";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "../../org/catalogFields";
import { catalogUi } from "@/shared/ui/catalogUi";
import {
  accessDraftRows,
  accessRowKey,
  countSelectedModules,
  displayEmployeeName,
  employeeInitials,
  formatModuleCode,
  grantableModules,
  initialAccessDraft,
  isAccessDraftChanged,
  type AccessDraft,
} from "../selectors";
import type {
  AccessDialogMode,
  AccessGrant,
  AccessLevel,
  AccessRow,
  EmployeeSearchHit,
  RbacModule,
} from "../types";

interface AssignAccessDialogProps {
  readonly employee: EmployeeSearchHit;
  readonly modules: readonly RbacModule[];
  readonly grants?: readonly AccessGrant[];
  readonly mode?: AccessDialogMode;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onSave: (rows: readonly AccessRow[]) => void;
  readonly onRevoke?: (grant: AccessGrant) => void;
  readonly onRevokeAll?: () => void;
}

const DEFAULT_LEVEL: AccessLevel = "full_access";

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_6rem] items-center gap-x-3 border-b border-emp-line py-2.5";

const HEADER_LINK_BASE =
  "cursor-pointer border-0 bg-transparent p-0 text-[0.62rem] font-semibold uppercase tracking-[0.14em] hover:underline disabled:cursor-not-allowed disabled:text-emp-muted disabled:no-underline disabled:opacity-60";
const HEADER_LINK = `${HEADER_LINK_BASE} text-emp-accent`;
const HEADER_DANGER_LINK = `${HEADER_LINK_BASE} text-emp-critical`;

function EyeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M10.8 2.7a1.6 1.6 0 0 1 2.3 2.3L6 12.1l-3 .8.8-3 7-7.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LEVEL_OPTIONS: readonly {
  readonly level: AccessLevel;
  readonly label: string;
  readonly icon: () => ReactElement;
}[] = [
  { level: "read_only", label: "View only", icon: EyeIcon },
  { level: "full_access", label: "Full access", icon: PencilIcon },
];

const LEVEL_TOGGLE_WIDTH = "w-[16.5rem]";

function AccessLevelToggle({
  value,
  disabled,
  label,
  onChange,
}: {
  readonly value: AccessLevel | null;
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (level: AccessLevel) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${label} access level`}
      className={`grid ${LEVEL_TOGGLE_WIDTH} shrink-0 grid-cols-2 gap-0.5 rounded-full bg-[color-mix(in_srgb,var(--color-emp-muted)_12%,var(--color-emp-surface))] p-0.5 ${
        disabled ? "opacity-45" : ""
      }`}
    >
      {LEVEL_OPTIONS.map((option) => {
        const selected = !disabled && value === option.level;
        const Icon = option.icon;
        return (
          <button
            key={option.level}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border-0 px-2 py-1 text-[0.8rem] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emp-accent/40 disabled:cursor-not-allowed ${
              selected
                ? "bg-emp-surface font-semibold text-emp-accent shadow-[0_1px_2px_rgba(15,23,42,0.12),0_1px_1px_rgba(15,23,42,0.06)]"
                : "bg-transparent font-medium text-emp-muted enabled:hover:text-emp-text"
            }`}
            onClick={() => onChange(option.level)}
          >
            <Icon />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Wireframe: Assign access — every grantable module and submodule in one
 * table with a View only / Full access level each. Save sends the whole table, so newly
 * checked rows are granted and unchecked ones revoked.
 */
export function AssignAccessDialog({
  employee,
  modules,
  grants = [],
  mode = "assign",
  busy = false,
  onClose,
  onSave,
  onRevoke,
  onRevokeAll,
}: AssignAccessDialogProps) {
  const titleId = useId();
  const catalog = useMemo(() => grantableModules(modules), [modules]);
  const initial = useMemo(
    () => initialAccessDraft(catalog, grants),
    [catalog, grants],
  );
  const rowKeys = useMemo(
    () =>
      catalog.flatMap((mod) =>
        mod.hasSubmodules
          ? mod.submodules.map((sub) => accessRowKey(mod.moduleId, sub.submoduleId))
          : [accessRowKey(mod.moduleId, null)],
      ),
    [catalog],
  );
  const [draft, setDraft] = useState<AccessDraft>(initial);
  const selectedModules = countSelectedModules(catalog, draft);
  const changed = isAccessDraftChanged(initial, draft);
  const selectedRows = rowKeys.filter((key) => draft[key] != null).length;
  const allRowsSelected = rowKeys.length > 0 && selectedRows === rowKeys.length;
  const someRowsSelected = selectedRows > 0 && !allRowsSelected;

  /** Checks every row; rows already checked keep their level. */
  function selectAll() {
    setDraft((prev) => {
      const next = { ...prev };
      for (const key of rowKeys) next[key] ??= DEFAULT_LEVEL;
      return next;
    });
  }

  function clearAll() {
    setDraft({});
  }

  function setRow(key: string, level: AccessLevel | null) {
    setDraft((prev) => {
      const next = { ...prev };
      if (level == null) delete next[key];
      else next[key] = level;
      return next;
    });
  }

  function setModuleSubmodules(mod: RbacModule, level: AccessLevel | null) {
    setDraft((prev) => {
      const next = { ...prev };
      for (const sub of mod.submodules) {
        const key = accessRowKey(mod.moduleId, sub.submoduleId);
        if (level == null) delete next[key];
        else next[key] = level;
      }
      return next;
    });
  }

  /** Parent level change applies to the submodules already selected. */
  function setSelectedSubmoduleLevel(mod: RbacModule, level: AccessLevel) {
    setDraft((prev) => {
      const next = { ...prev };
      for (const sub of mod.submodules) {
        const key = accessRowKey(mod.moduleId, sub.submoduleId);
        if (next[key] != null) next[key] = level;
      }
      return next;
    });
  }

  function findGrant(
    moduleId: number,
    submoduleId: number | null,
  ): AccessGrant | undefined {
    return grants.find(
      (g) =>
        g.moduleId === moduleId && (g.submoduleId ?? null) === submoduleId,
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!changed) return;
    onSave(accessDraftRows(catalog, draft));
  }

  function revokeButton(grant: AccessGrant | undefined, label: string) {
    if (!grant || !onRevoke) return null;
    return (
      <CatalogButton
        variant="ghost"
        className="justify-self-end"
        disabled={busy}
        aria-label={`Revoke ${label}`}
        onClick={(event) => {
          event.preventDefault();
          onRevoke(grant);
        }}
      >
        Revoke
      </CatalogButton>
    );
  }

  const title = mode === "edit" ? "Edit access" : "Assign access";
  const code = employee.employeeCode.trim();

  return (
    <CatalogModal
      title={title}
      titleId={titleId}
      eyebrow={`RBAC · ${title.toLowerCase()}`}
      size="wide"
      accentTop
      onClose={onClose}
      onSubmit={handleSubmit}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <p className={`${catalogUi.fieldHint} mr-auto`}>
            {selectedModules} module{selectedModules === 1 ? "" : "s"} selected
          </p>
          <CatalogButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </CatalogButton>
          <CatalogButton type="submit" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save access"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <div className="flex items-center gap-3 rounded-[0.5rem] bg-emp-raised px-[0.9rem] py-[0.7rem]">
        <span
          className="inline-grid size-9 shrink-0 place-items-center rounded-full bg-emp-accent-soft text-[0.78rem] font-bold text-emp-accent"
          aria-hidden="true"
        >
          {employeeInitials(employee)}
        </span>
        <p className="m-0 min-w-0 truncate text-[0.95rem] text-emp-text">
          <span className="font-semibold">{displayEmployeeName(employee)}</span>
          {code ? <span className="text-emp-muted"> · {code}</span> : null}
        </p>
      </div>

      <div role="table" aria-label="Module access">
        <div
          role="row"
          className={`${ROW_GRID} py-2 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-emp-muted`}
        >
          <div role="columnheader" className="flex min-w-0 items-center gap-2.5">
            <AppCheckbox
              id="assign-access-select-all"
              checked={allRowsSelected}
              indeterminate={someRowsSelected}
              disabled={busy || rowKeys.length === 0}
              label=""
              aria-label="Select all modules"
              onChange={() => (allRowsSelected ? clearAll() : selectAll())}
            />
            <span>Module / submodule</span>
            {selectedRows > 0 ? (
              <button
                type="button"
                className={`${HEADER_LINK} ml-auto mr-2`}
                disabled={busy}
                onClick={clearAll}
              >
                Clear all
              </button>
            ) : null}
          </div>
          <span role="columnheader" className={LEVEL_TOGGLE_WIDTH}>
            Access level
          </span>
          <div role="columnheader" className="grid">
            {onRevokeAll && grants.length > 0 ? (
              <button
                type="button"
                className={`${HEADER_DANGER_LINK} justify-self-end`}
                disabled={busy}
                onClick={onRevokeAll}
              >
                Revoke all
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        </div>

        {catalog.map((mod) => {
          const moduleCode = formatModuleCode(mod.moduleId);
          const checkboxId = `assign-access-module-${mod.moduleId}`;

          if (!mod.hasSubmodules) {
            const key = accessRowKey(mod.moduleId, null);
            const level = draft[key] ?? null;
            return (
              <div key={mod.moduleId} role="row" className={ROW_GRID}>
                <div role="cell" className="flex min-w-0 items-center gap-2.5">
                  <AppCheckbox
                    id={checkboxId}
                    checked={level != null}
                    disabled={busy}
                    label=""
                    aria-label={mod.moduleName}
                    onChange={(checked) =>
                      setRow(key, checked ? DEFAULT_LEVEL : null)
                    }
                  />
                  <label htmlFor={checkboxId} className="min-w-0 truncate text-emp-text">
                    {mod.moduleName}{" "}
                    <span className="text-[0.8rem] text-emp-muted">{moduleCode}</span>
                  </label>
                </div>
                <div role="cell">
                  <AccessLevelToggle
                    value={level}
                    disabled={busy || level == null}
                    label={mod.moduleName}
                    onChange={(next) => setRow(key, next)}
                  />
                </div>
                <div role="cell" className="grid">
                  {revokeButton(findGrant(mod.moduleId, null), mod.moduleName)}
                </div>
              </div>
            );
          }

          const subLevels = mod.submodules.map(
            (sub) => draft[accessRowKey(mod.moduleId, sub.submoduleId)] ?? null,
          );
          const selectedSubs = subLevels.filter((l) => l != null);
          const allSelected =
            mod.submodules.length > 0 &&
            selectedSubs.length === mod.submodules.length;
          const someSelected = selectedSubs.length > 0 && !allSelected;
          const sharedLevel =
            selectedSubs.length > 0 &&
            selectedSubs.every((l) => l === selectedSubs[0])
              ? selectedSubs[0]
              : null;

          return (
            <div key={mod.moduleId} role="rowgroup">
              <div role="row" className={ROW_GRID}>
                <div role="cell" className="flex min-w-0 items-center gap-2.5">
                  {/* Tri-state: a partial selection shows "mixed"; clicking it selects all. */}
                  <AppCheckbox
                    id={checkboxId}
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={busy}
                    label=""
                    aria-label={`${mod.moduleName} (all submodules)`}
                    onChange={() =>
                      setModuleSubmodules(
                        mod,
                        allSelected ? null : (sharedLevel ?? DEFAULT_LEVEL),
                      )
                    }
                  />
                  <label htmlFor={checkboxId} className="min-w-0 truncate text-emp-text">
                    {mod.moduleName}{" "}
                    <span className="text-[0.8rem] text-emp-muted">
                      {moduleCode} · {selectedSubs.length}/{mod.submodules.length}{" "}
                      submodule{mod.submodules.length === 1 ? "" : "s"}
                    </span>
                  </label>
                </div>
                <div role="cell">
                  <AccessLevelToggle
                    value={sharedLevel}
                    disabled={busy || selectedSubs.length === 0}
                    label={mod.moduleName}
                    onChange={(next) => setSelectedSubmoduleLevel(mod, next)}
                  />
                </div>
                <span role="cell" aria-hidden="true" />
              </div>

              {mod.submodules.map((sub, index) => {
                const key = accessRowKey(mod.moduleId, sub.submoduleId);
                const level = subLevels[index] ?? null;
                const subCheckboxId = `assign-access-sub-${sub.submoduleId}`;
                return (
                  <div key={sub.submoduleId} role="row" className={ROW_GRID}>
                    <div
                      role="cell"
                      className="flex min-w-0 items-center gap-2.5 pl-8"
                    >
                      <AppCheckbox
                        id={subCheckboxId}
                        checked={level != null}
                        disabled={busy}
                        label=""
                        aria-label={`${mod.moduleName} → ${sub.submoduleName}`}
                        onChange={(checked) =>
                          setRow(key, checked ? (sharedLevel ?? DEFAULT_LEVEL) : null)
                        }
                      />
                      <label
                        htmlFor={subCheckboxId}
                        className="min-w-0 truncate text-emp-text"
                      >
                        {sub.submoduleName}
                      </label>
                    </div>
                    <div role="cell">
                      <AccessLevelToggle
                        value={level}
                        disabled={busy || level == null}
                        label={sub.submoduleName}
                        onChange={(next) => setRow(key, next)}
                      />
                    </div>
                    <div role="cell" className="grid">
                      {revokeButton(
                        findGrant(mod.moduleId, sub.submoduleId),
                        `${mod.moduleName} → ${sub.submoduleName}`,
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

      </div>
    </CatalogModal>
  );
}
