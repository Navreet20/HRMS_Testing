import { useCallback, useEffect, useMemo, useState } from "react";

import { isAppTheme, userFacingApiError } from "@/shared";
import {
  departmentToCreateBody,
  validateDepartmentDraft,
  type DepartmentDraft as OrgDepartmentDraft,
} from "@/modules/org";
import {
  createDefaultActor,
  DEFAULT_DEPARTMENTS_THEME,
} from "./constants";
import { CatalogFeedbackBanner } from "./components/CatalogFeedbackBanner";
import {
  ConfirmDepartmentStatusDialog,
  type DepartmentConfirmKind,
} from "./components/ConfirmDepartmentStatusDialog";
import {
  DepartmentDialog,
  type DepartmentHeadOption,
} from "./components/DepartmentDialog";
import { DepartmentsDirectory } from "./components/DepartmentsDirectory";
import {
  canListDepartments,
  canWriteDepartments,
  departmentsDataFromOrg,
  EMPTY_DEPARTMENTS_DATA,
} from "./selectors";
import type {
  DepartmentDraft,
  DepartmentRecord,
  DepartmentsModuleData,
  DepartmentsModuleProps,
} from "./types";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

function toOrgDraft(draft: DepartmentDraft): OrgDepartmentDraft {
  return {
    departmentName: draft.name,
    parentDepartmentId: draft.parentId,
    departmentHeadId: draft.headId,
  };
}

function departmentWriteBody(draft: DepartmentDraft): Record<string, unknown> {
  return departmentToCreateBody(toOrgDraft(draft));
}

function headOptionsFromEmployeesApi(raw: unknown): DepartmentHeadOption[] {
  const rows = Array.isArray(raw) ? raw : [];
  const options: DepartmentHeadOption[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (Boolean(row.isSystemAccount)) {
      continue;
    }
    const status = String(row.status ?? "ACTIVE").toUpperCase();
    if (status !== "ACTIVE") {
      continue;
    }
    const id = String(row.employeeId ?? row.id ?? "").trim();
    if (!id) {
      continue;
    }
    const first = String(row.firstName ?? "").trim();
    const last = String(row.lastName ?? "").trim();
    const displayName =
      `${first} ${last}`.trim() ||
      String(row.emailId ?? row.workEmail ?? "Employee").trim();
    options.push({ id, displayName });
  }
  return options.sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

export function DepartmentsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_DEPARTMENTS_DATA,
  gateway,
  employeesGateway,
  theme,
  defaultTheme = DEFAULT_DEPARTMENTS_THEME,
  role,
  accessGrants,
}: DepartmentsModuleProps) {
  const resolvedActor = actor ?? defaultActor ?? createDefaultActor(role);
  const canList = canListDepartments(resolvedActor.role, accessGrants);
  const canWrite = canWriteDepartments(resolvedActor.role, accessGrants);
  const isDataControlled = data !== undefined;
  const [localData, setLocalData] =
    useState<DepartmentsModuleData>(defaultData);
  const activeData = data ?? localData;
  const [catalogNeeded, setCatalogNeeded] = useState(isDataControlled);
  const [loading, setLoading] = useState(false);
  const requestCatalog = useCallback(() => {
    setCatalogNeeded(true);
  }, []);
  const requestedTheme = theme ?? defaultTheme;
  const activeTheme = isAppTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_DEPARTMENTS_THEME;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headOptions, setHeadOptions] = useState<
    readonly DepartmentHeadOption[]
  >([]);
  const [dialog, setDialog] = useState<{
    mode: "create" | "edit";
    department?: DepartmentRecord | null;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    kind: DepartmentConfirmKind;
    department: DepartmentRecord;
  } | null>(null);

  useEffect(() => {
    if (!gateway || isDataControlled || !catalogNeeded) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await gateway.listDepartments();
        if (!cancelled) {
          setLocalData(departmentsDataFromOrg(rows));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(userFacingApiError(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway, isDataControlled, catalogNeeded]);

  useEffect(() => {
    if (!employeesGateway?.getAllEmployees || !canWrite) {
      setHeadOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await employeesGateway.getAllEmployees();
        if (!cancelled) {
          setHeadOptions(headOptionsFromEmployeesApi(raw));
        }
      } catch {
        if (!cancelled) {
          setHeadOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeesGateway, canWrite]);

  const headNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of headOptions) {
      map.set(row.id, row.displayName);
    }
    return map;
  }, [headOptions]);

  async function refresh() {
    if (!gateway || isDataControlled) {
      return;
    }
    const rows = await gateway.listDepartments();
    setLocalData(departmentsDataFromOrg(rows));
  }

  async function handleSave(draft: DepartmentDraft) {
    if (!canWrite) {
      return;
    }
    setError(null);
    const orgDraft = toOrgDraft(draft);
    const invalid = validateDepartmentDraft(orgDraft);
    if (invalid) {
      setError(invalid);
      return;
    }
    const body = departmentWriteBody(draft);
    try {
      if (gateway && !isDataControlled) {
        if (dialog?.mode === "edit" && dialog.department) {
          await gateway.updateDepartment(dialog.department.id, {
            ...body,
            status: draft.status,
          });
          setNotice(`Updated department "${draft.name}".`);
        } else {
          await gateway.createDepartment(body);
          setNotice(`Created department "${draft.name}".`);
        }
        await refresh();
      } else if (!isDataControlled) {
        const headName = draft.headId
          ? headNameById.get(draft.headId) ?? null
          : null;
        if (dialog?.mode === "edit" && dialog.department) {
          setLocalData((current) => ({
            departments: current.departments.map((row) =>
              row.id === dialog.department?.id
                ? {
                    ...row,
                    name: draft.name,
                    parentId: draft.parentId || null,
                    headId: draft.headId || null,
                    headName,
                    status: draft.status,
                  }
                : row,
            ),
          }));
          setNotice(`Updated department "${draft.name}".`);
        } else {
          const id = `dept-${Date.now().toString(36)}`;
          setLocalData((current) => ({
            departments: [
              ...current.departments,
              {
                id,
                name: draft.name,
                parentId: draft.parentId || null,
                headId: draft.headId || null,
                headName,
                status: "Active",
                employeeCount: 0,
              },
            ],
          }));
          setNotice(`Created department "${draft.name}".`);
        }
      }
      setDialog(null);
    } catch (saveError) {
      setError(userFacingApiError(saveError));
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction || !canWrite) {
      setPendingAction(null);
      return;
    }
    const { kind, department } = pendingAction;
    setError(null);
    try {
      const nextStatus = kind === "activate" ? "Active" : "Inactive";
      if (gateway && !isDataControlled) {
        await gateway.updateDepartment(department.id, { status: nextStatus });
        await refresh();
      } else if (!isDataControlled) {
        setLocalData((current) => ({
          departments: current.departments.map((row) =>
            row.id === department.id ? { ...row, status: nextStatus } : row,
          ),
        }));
      }
      setNotice(
        nextStatus === "Active"
          ? `Activated department "${department.name}".`
          : `Deactivated department "${department.name}".`,
      );
      setPendingAction(null);
    } catch (actionError) {
      setError(userFacingApiError(actionError));
      setPendingAction(null);
    }
  }

  return (
    <section
      className={ui.module}
      data-theme={activeTheme}
      aria-label="Departments module"
    >
      <p className={ui.breadcrumb}>Company › Departments</p>
      <p className={ui.lede}>
        Create and manage departments in your organization. Optionally nest a
        department under a parent.
      </p>
      <CatalogFeedbackBanner
        message={notice}
        variant="success"
        onClose={() => setNotice(null)}
      />
      <CatalogFeedbackBanner
        message={error}
        variant="error"
        onClose={() => setError(null)}
      />

      {canList ? (
        <DepartmentsDirectory
          data={activeData}
          loading={loading}
          canWrite={canWrite}
          onRequestCatalog={requestCatalog}
          onCreate={() => {
            requestCatalog();
            setDialog({ mode: "create" });
          }}
          onEdit={(department) => {
            requestCatalog();
            setDialog({ mode: "edit", department });
          }}
          onToggleStatus={(department) =>
            setPendingAction({
              kind: department.status === "Active" ? "deactivate" : "activate",
              department,
            })
          }
        />
      ) : (
        <p className={ui.empty}>
          You do not have access to departments setup.
        </p>
      )}

      {dialog ? (
        <DepartmentDialog
          mode={dialog.mode}
          department={dialog.department}
          departments={activeData.departments}
          headOptions={headOptions}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      ) : null}

      {pendingAction ? (
        <ConfirmDepartmentStatusDialog
          department={pendingAction.department}
          kind={pendingAction.kind}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            void handleConfirmAction();
          }}
        />
      ) : null}
    </section>
  );
}
