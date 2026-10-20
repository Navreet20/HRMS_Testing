import { useMemo } from "react";

import {
  EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED,
  EMPLOYEE_EXPORT_CSV_UI_ENABLED,
} from "../constants";
import {
  canCreateEmployee,
  canListEmployees,
  directoryFiltersActive,
  formatEmployeeName,
  selectCatalogDepartmentOptions,
  selectDirectoryPage,
  selectEmployeeById,
} from "../selectors";
import type {
  DirectoryPageResult,
  DirectoryQuery,
  EmployeeActionKind,
  EmployeeActor,
  EmployeeImportResult,
  EmployeeRecord,
  EmployeesModuleData,
  OrgDepartmentOption,
} from "../types";
import { CreateEntryChooser } from "./CreateEntryChooser";
import { DirectoryTable } from "./DirectoryTable";
import { DirectoryToolbar } from "./DirectoryToolbar";
import { EmployeesToast } from "./EmployeesToast";
import { ImportEmployeesDialog } from "./ImportEmployeesDialog";
import { PaginationControls } from "./PaginationControls";
import { ui } from "../uiClasses";

interface EmployeeDirectoryProps {
  readonly actor: EmployeeActor;
  readonly data: EmployeesModuleData;
  readonly query: DirectoryQuery;
  readonly catalogDepartments?: readonly OrgDepartmentOption[];
  readonly livePage?: DirectoryPageResult | null;
  readonly liveLoading?: boolean;
  readonly chooserOpen: boolean;
  readonly importOpen: boolean;
  readonly importBusy: boolean;
  readonly importResult: EmployeeImportResult | null;
  readonly importError: string | null;
  readonly exportBusy: boolean;
  readonly profileNotice: string | null;
  readonly onQueryChange: (patch: Partial<DirectoryQuery>) => void;
  readonly onOpenChooser: () => void;
  readonly onCloseChooser: () => void;
  readonly onChooseManual: () => void;
  readonly onChooseImport: () => void;
  readonly onCloseImport: () => void;
  readonly onDownloadTemplate: () => void;
  readonly onImportFile: (file: File) => void;
  readonly onExport: () => void;
  readonly onAction: (
    kind: EmployeeActionKind,
    employee: EmployeeRecord,
  ) => void;
  readonly onDismissProfileNotice: () => void;
  readonly onOpenSelfProfile?: () => void;
  readonly fetchAvatarBlob?: (employeeId: string) => Promise<Blob>;
}

export function EmployeeDirectory({
  actor,
  data,
  query,
  catalogDepartments = [],
  livePage = null,
  liveLoading = false,
  chooserOpen,
  importOpen,
  importBusy,
  importResult,
  importError,
  exportBusy,
  profileNotice,
  onQueryChange,
  onOpenChooser,
  onCloseChooser,
  onChooseManual,
  onChooseImport,
  onCloseImport,
  onDownloadTemplate,
  onImportFile,
  onExport,
  onAction,
  onDismissProfileNotice,
  onOpenSelfProfile,
  fetchAvatarBlob,
}: EmployeeDirectoryProps) {
  const canCreate = canCreateEmployee(actor);
  const departmentOptions = useMemo(
    () => selectCatalogDepartmentOptions(catalogDepartments),
    [catalogDepartments],
  );
  const page = useMemo(() => {
    if (livePage) {
      return livePage;
    }
    return selectDirectoryPage(data, query);
  }, [data, livePage, query]);
  const showResults = directoryFiltersActive(query);
  const emptyKind: "idle" | "none" | "filtered" = !showResults
    ? "idle"
    : page.total === 0
      ? "filtered"
      : "none";

  if (actor.role === "EMPLOYEE") {
    const self = actor.employeeId
      ? selectEmployeeById(data, actor.employeeId)
      : null;

    // DATA-8: Employees module grant elevates past self-only directory.
    if (!canListEmployees(actor)) {
      return (
        <div className={ui.directory}>
          <p className={ui.lede}>
            Organization directory is not available for the Employee persona.
          </p>
          {self ? (
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={onOpenSelfProfile}
            >
              Open my profile ({formatEmployeeName(self)})
            </button>
          ) : (
            <p className={ui.muted}>
              No session employee is linked to this actor.
            </p>
          )}
        </div>
      );
    }
  }

  return (
    <div className={ui.directory}>
      <DirectoryToolbar
        query={query}
        departmentOptions={departmentOptions}
        canCreate={canCreate}
        exportBusy={exportBusy}
        onQueryChange={onQueryChange}
        onOpenCreateChooser={onOpenChooser}
        onExport={EMPLOYEE_EXPORT_CSV_UI_ENABLED ? onExport : undefined}
      />

      {profileNotice ? (
        <EmployeesToast
          message={profileNotice}
          onClose={onDismissProfileNotice}
        />
      ) : null}

      {showResults && liveLoading ? (
        <p className={ui.muted}>Loading employees…</p>
      ) : null}
      <DirectoryTable
        rows={showResults ? page.rows : []}
        data={data}
        actor={actor}
        emptyKind={emptyKind}
        canCreate={canCreate}
        onAction={onAction}
        onAddEmployee={onOpenChooser}
        fetchAvatarBlob={fetchAvatarBlob}
      />

      {showResults && page.total > 0 ? (
        <PaginationControls
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={query.pageSize}
          onPageChange={(nextPage) => onQueryChange({ page: nextPage })}
        />
      ) : null}

      {EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED ? (
        <CreateEntryChooser
          open={chooserOpen}
          titleId="eaova-employees-chooser-title"
          onClose={onCloseChooser}
          onChooseManual={onChooseManual}
          onChooseImport={onChooseImport}
        />
      ) : null}

      <ImportEmployeesDialog
        open={importOpen}
        titleId="eaova-employees-import-title"
        busy={importBusy}
        result={importResult}
        error={importError}
        onClose={onCloseImport}
        onDownloadTemplate={onDownloadTemplate}
        onImportFile={onImportFile}
      />
    </div>
  );
}
