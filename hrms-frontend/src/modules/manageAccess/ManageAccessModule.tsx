import { useCallback, useEffect, useRef, useState } from "react";

import { isAppTheme, mutationErrorMessage } from "../../shared";
import {
  AppSearchField,
  AppSelect,
  usePersistentState,
} from "../../shared/ui";
import { CatalogFeedbackBanner } from "../departments/components/CatalogFeedbackBanner";
import { catalogUi } from "@/shared/ui/catalogUi";
import { DirectoryEmptySearchIcon } from "../employees/components/icons";
import { empUi } from "@/shared/ui/empUi";
import { AssignAccessDialog } from "./components/AssignAccessDialog";
import {
  ConfirmRevokeAllDialog,
  ConfirmRevokeGrantDialog,
} from "./components/ConfirmRevokeGrantDialog";
import { RbacEmployeesTable } from "./components/RbacEmployeesTable";
import { ViewAccessDialog } from "./components/ViewAccessDialog";
import {
  createDefaultActor,
  DEFAULT_MANAGE_ACCESS_THEME,
} from "./constants";
import {
  canManageAccess,
  displayEmployeeName,
  isActiveStatus,
  normalizeGrants,
  normalizeModules,
  resolveRbacPersona,
  targetRoleLabel,
} from "./selectors";
import type {
  AccessDialogMode,
  AccessGrant,
  AccessRow,
  EmployeeDirectoryPage,
  EmployeeSearchHit,
  ManageAccessModuleProps,
  RbacEmployeeAction,
  RbacModule,
} from "./types";

const PAGE_SIZE = 10;
/** Directory stays empty until the user searches or picks Show → All; active employees only. */
const DIRECTORY_SEARCH_MIN = 2;
const toolbarControl = "grid min-w-0 content-start gap-[0.2rem]";
const employeeFiltersRow =
  "grid min-w-0 grid-cols-1 gap-[0.75rem] px-[0.9rem] py-[0.75rem] min-[42.0625rem]:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)]";

const SHOW_ALL_VALUE = "all";
const SHOW_OPTIONS = [{ value: SHOW_ALL_VALUE, label: "All" }] as const;

const EMPTY_DIRECTORY: EmployeeDirectoryPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
};

type DialogState =
  | {
      readonly kind: "access";
      readonly mode: AccessDialogMode;
      readonly employee: EmployeeSearchHit;
      readonly grants: readonly AccessGrant[];
    }
  | {
      readonly kind: "view";
      readonly employee: EmployeeSearchHit;
      readonly grants: readonly AccessGrant[];
    }
  | null;

export function ManageAccessModule({
  actor,
  defaultActor,
  gateway,
  theme,
  defaultTheme = DEFAULT_MANAGE_ACCESS_THEME,
  role,
  accessGrants,
}: ManageAccessModuleProps) {
  const resolvedActor = actor ?? defaultActor ?? createDefaultActor(role);
  const persona = resolveRbacPersona(resolvedActor.role, accessGrants);
  const canManage = canManageAccess(resolvedActor.role, accessGrants);
  const requestedTheme = theme ?? defaultTheme;
  const activeTheme = isAppTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_MANAGE_ACCESS_THEME;

  const [modules, setModules] = useState<readonly RbacModule[]>([]);
  const [directory, setDirectory] =
    useState<EmployeeDirectoryPage>(EMPTY_DIRECTORY);
  const [committedSearch, setCommittedSearch] = usePersistentState(
    "manageAccess.search",
    "",
  );
  const [searchDraft, setSearchDraft] = useState(committedSearch);
  const committedSearchRef = useRef(committedSearch);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AccessGrant | null>(null);
  const [pendingRevokeAll, setPendingRevokeAll] = useState(false);
  const [page, setPage] = usePersistentState("manageAccess.page", 1);
  const [showAll, setShowAll] = usePersistentState("manageAccess.showAll", false);

  const searchActive = committedSearch.trim().length >= DIRECTORY_SEARCH_MIN;
  const hasDirectoryQuery = searchActive || showAll;

  const pageCount = Math.max(1, Math.ceil(directory.total / directory.pageSize));

  useEffect(() => {
    if (!canManage || !gateway) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await gateway.listModules();
        if (!cancelled) setModules(normalizeModules(rows));
      } catch (loadError) {
        if (!cancelled) setError(mutationErrorMessage(loadError));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage, gateway]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchDraft.trim();
      if (next === committedSearchRef.current) {
        return;
      }
      committedSearchRef.current = next;
      setCommittedSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  const loadDirectory = useCallback(
    async (pageNumber: number) => {
      if (!canManage || !gateway) return;
      if (!hasDirectoryQuery) {
        setDirectory(EMPTY_DIRECTORY);
        setBusy(false);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await gateway.listDirectory({
          q: searchActive ? committedSearch : undefined,
          page: pageNumber,
          pageSize: PAGE_SIZE,
        });
        setDirectory(result);
      } catch (loadError) {
        setError(mutationErrorMessage(loadError));
      } finally {
        setBusy(false);
      }
    },
    [canManage, committedSearch, gateway, hasDirectoryQuery, searchActive],
  );

  useEffect(() => {
    if (!canManage || !gateway) return;
    void loadDirectory(page);
  }, [canManage, gateway, page, loadDirectory]);

  async function loadGrants(employeeId: string) {
    if (!gateway) return [];
    return normalizeGrants(await gateway.listGrants(employeeId));
  }

  async function openEmployeeDialog(
    employee: EmployeeSearchHit,
    action: RbacEmployeeAction,
  ) {
    if (!gateway) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const grants = await loadGrants(employee.employeeId);
      setDialog(
        action === "view"
          ? { kind: "view", employee, grants }
          : { kind: "access", mode: action, employee, grants },
      );
    } catch (loadError) {
      setError(mutationErrorMessage(loadError));
    } finally {
      setBusy(false);
    }
  }

  async function handleAccessSave(rows: readonly AccessRow[]) {
    if (!gateway || dialog?.kind !== "access") return;
    setSaving(true);
    setError(null);
    try {
      await gateway.replaceAccess(dialog.employee.employeeId, rows);
      setNotice("Access saved.");
      setDialog(null);
      await loadDirectory(page);
    } catch (saveError) {
      setError(mutationErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function requestRevoke(grant: AccessGrant) {
    setPendingRevoke(grant);
  }

  async function performRevoke(grant: AccessGrant) {
    if (!gateway || !dialog) {
      return;
    }
    const current = dialog;
    const employee = current.employee;
    setPendingRevoke(null);
    setSaving(true);
    setError(null);
    try {
      await gateway.revokeGrant(employee.employeeId, grant.grantId);
      const grants = await loadGrants(employee.employeeId);
      setNotice("Grant revoked.");
      if (grants.length === 0 && current.kind === "view") {
        setDialog(null);
      } else {
        setDialog({ ...current, grants });
      }
      await loadDirectory(page);
    } catch (revokeError) {
      setError(mutationErrorMessage(revokeError));
    } finally {
      setSaving(false);
    }
  }

  async function performRevokeAll() {
    if (!gateway || dialog?.kind !== "access") {
      return;
    }
    const current = dialog;
    setPendingRevokeAll(false);
    setSaving(true);
    setError(null);
    try {
      await gateway.replaceAccess(current.employee.employeeId, []);
      const grants = await loadGrants(current.employee.employeeId);
      setNotice("All access revoked.");
      setDialog({ ...current, grants });
      await loadDirectory(page);
    } catch (revokeError) {
      setError(mutationErrorMessage(revokeError));
    } finally {
      setSaving(false);
    }
  }

  if (!canManage || !persona) {
    return (
      <section className={catalogUi.module} data-theme={activeTheme}>
        <p className={catalogUi.empty}>
          You do not have access to RBAC. Ask an admin.
        </p>
      </section>
    );
  }

  const targetLabel = targetRoleLabel(persona);
  const start = directory.total === 0 ? 0 : (page - 1) * directory.pageSize + 1;
  const end = Math.min(page * directory.pageSize, directory.total);

  return (
    <section className={catalogUi.module} data-theme={activeTheme}>
      <CatalogFeedbackBanner
        message={error}
        variant="error"
        onClose={() => setError(null)}
      />
      <CatalogFeedbackBanner
        message={notice}
        variant="success"
        onClose={() => setNotice(null)}
      />

      <div className="grid gap-[0.9rem]">
        <div className={empUi.toolbar}>
          <div className={empUi.toolbarFilters}>
            <div className={employeeFiltersRow}>
              <div className={toolbarControl}>
                <AppSearchField
                  id="rbac-employee-search"
                  value={searchDraft}
                  onChange={setSearchDraft}
                  placeholder="Name, employee ID, or work email"
                  aria-label="Search employees"
                />
              </div>
              <div className={toolbarControl}>
                <AppSelect
                  value={showAll ? SHOW_ALL_VALUE : ""}
                  placeholder="Select employees"
                  aria-label="Show employees"
                  options={SHOW_OPTIONS}
                  onChange={(value) => {
                    setShowAll(value === SHOW_ALL_VALUE);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {!hasDirectoryQuery ? (
          <div className={empUi.dirEmptyPanel} role="status">
            <div className={empUi.dirEmpty}>
              <span className={empUi.dirEmptyIcon}>
                <DirectoryEmptySearchIcon />
              </span>
              <p className={empUi.dirEmptyTitle}>No active search query</p>
              <p className={empUi.dirEmptyCopy}>
                Search active employees by name, employee ID, or work email,
                or choose Show → All to list everyone.
              </p>
            </div>
          </div>
        ) : (
          <>
            <RbacEmployeesTable
              rows={directory.items}
              persona={persona}
              busy={busy}
              emptyLabel={`No active ${targetLabel.toLowerCase()}s match your ${
                searchActive ? "search" : "selection"
              }.`}
              onAction={(employee, action) =>
                void openEmployeeDialog(employee, action)
              }
            />

            <div className={catalogUi.pagination}>
              <p className={catalogUi.paginationSummary}>
                Showing {start}-{end} of {directory.total}{" "}
                {targetLabel.toLowerCase()}
                {directory.total === 1 ? "" : "s"}
              </p>
              <div className={catalogUi.paginationControls}>
                <button
                  type="button"
                  className={catalogUi.btnGhost}
                  disabled={page <= 1 || busy}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1)
                  .filter((pageNumber) => {
                    if (pageCount <= 5) return true;
                    return (
                      pageNumber === 1 ||
                      pageNumber === pageCount ||
                      Math.abs(pageNumber - page) <= 1
                    );
                  })
                  .map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      aria-current={pageNumber === page ? "page" : undefined}
                      className={
                        pageNumber === page
                          ? catalogUi.btnPrimary
                          : catalogUi.btnGhost
                      }
                      disabled={busy}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                <button
                  type="button"
                  className={catalogUi.btnGhost}
                  disabled={page >= pageCount || busy}
                  onClick={() =>
                    setPage((prev) => Math.min(pageCount, prev + 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {dialog?.kind === "access" ? (
        <AssignAccessDialog
          key={`access-${dialog.employee.employeeId}-${dialog.grants.map((g) => g.grantId).join("|")}`}
          employee={dialog.employee}
          modules={modules}
          grants={dialog.grants}
          mode={dialog.mode}
          busy={saving}
          onClose={() => setDialog(null)}
          onSave={(rows) => void handleAccessSave(rows)}
          onRevoke={requestRevoke}
          onRevokeAll={() => setPendingRevokeAll(true)}
        />
      ) : null}

      {dialog?.kind === "view" ? (
        <ViewAccessDialog
          key={`view-${dialog.employee.employeeId}-${dialog.grants.map((g) => g.grantId).join("|")}`}
          employee={dialog.employee}
          grants={dialog.grants}
          canEdit={isActiveStatus(dialog.employee.status)}
          allowRevoke
          busy={saving}
          onClose={() => setDialog(null)}
          onEdit={() =>
            setDialog({
              kind: "access",
              mode: "edit",
              employee: dialog.employee,
              grants: dialog.grants,
            })
          }
          onRevoke={requestRevoke}
        />
      ) : null}

      {pendingRevoke && dialog ? (
        <ConfirmRevokeGrantDialog
          grant={pendingRevoke}
          employeeName={displayEmployeeName(dialog.employee)}
          busy={saving}
          onCancel={() => setPendingRevoke(null)}
          onConfirm={() => void performRevoke(pendingRevoke)}
        />
      ) : null}

      {pendingRevokeAll && dialog?.kind === "access" ? (
        <ConfirmRevokeAllDialog
          grantCount={dialog.grants.length}
          employeeName={displayEmployeeName(dialog.employee)}
          busy={saving}
          onCancel={() => setPendingRevokeAll(false)}
          onConfirm={() => void performRevokeAll()}
        />
      ) : null}
    </section>
  );
}
