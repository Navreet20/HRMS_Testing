import { useCallback, useEffect, useState } from "react";

import { isAppTheme, userFacingApiError } from "@/shared";
import { designationToCreateBody, validateDesignationDraft } from "@/modules/org";
import { createDefaultActor, DEFAULT_DESIGNATIONS_THEME } from "./constants";
import {
  ConfirmDesignationStatusDialog,
  type DesignationConfirmKind,
} from "./components/ConfirmDesignationStatusDialog";
import { DesignationDialog } from "./components/DesignationDialog";
import { DesignationsDirectory } from "./components/DesignationsDirectory";
import {
  canListDesignations,
  canWriteDesignations,
  designationsDataFromOrg,
  EMPTY_DESIGNATIONS_DATA,
} from "./selectors";
import type {
  DesignationDraft,
  DesignationRecord,
  DesignationsModuleData,
  DesignationsModuleProps,
} from "./types";
import { CatalogFeedbackBanner } from "@/modules/departments/components/CatalogFeedbackBanner";

import { catalogUi as ui } from "@/shared/ui/catalogUi";

export function DesignationsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_DESIGNATIONS_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_DESIGNATIONS_THEME,
  role,
  accessGrants,
}: DesignationsModuleProps) {
  const resolvedActor = actor ?? defaultActor ?? createDefaultActor(role);
  const canList = canListDesignations(resolvedActor.role, accessGrants);
  const canWrite = canWriteDesignations(resolvedActor.role, accessGrants);
  const isDataControlled = data !== undefined;
  const [localData, setLocalData] =
    useState<DesignationsModuleData>(defaultData);
  const activeData = data ?? localData;
  const [catalogNeeded, setCatalogNeeded] = useState(isDataControlled);
  const [loading, setLoading] = useState(false);
  const requestCatalog = useCallback(() => {
    setCatalogNeeded(true);
  }, []);
  const requestedTheme = theme ?? defaultTheme;
  const activeTheme = isAppTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_DESIGNATIONS_THEME;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    mode: "create" | "edit";
    designation?: DesignationRecord | null;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    kind: DesignationConfirmKind;
    designation: DesignationRecord;
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
        const rows = await gateway.listDesignations();
        if (!cancelled) {
          setLocalData(designationsDataFromOrg(rows));
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

  async function refresh() {
    if (!gateway || isDataControlled) {
      return;
    }
    const rows = await gateway.listDesignations();
    setLocalData(designationsDataFromOrg(rows));
  }

  async function handleSave(draft: DesignationDraft) {
    if (!canWrite) {
      return;
    }
    setError(null);
    const invalid = validateDesignationDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    const body = designationToCreateBody(draft);
    try {
      if (gateway && !isDataControlled) {
        if (dialog?.mode === "edit" && dialog.designation) {
          await gateway.updateDesignation(
            dialog.designation.designationId,
            body,
          );
          setNotice(`Updated designation "${draft.title.trim()}".`);
        } else {
          await gateway.createDesignation(body);
          setNotice(`Created designation "${draft.title.trim()}".`);
        }
        await refresh();
      } else if (!isDataControlled) {
        if (dialog?.mode === "edit" && dialog.designation) {
          setLocalData((current) => ({
            designations: current.designations.map((row) =>
              row.designationId === dialog.designation?.designationId
                ? {
                    ...row,
                    title: draft.title.trim(),
                    jobFamily: draft.jobFamily.trim(),
                  }
                : row,
            ),
          }));
          setNotice(`Updated designation "${draft.title.trim()}".`);
        } else {
          setLocalData((current) => ({
            designations: [
              ...current.designations,
              {
                designationId: `des-${Date.now().toString(36)}`,
                title: draft.title.trim(),
                jobFamily: draft.jobFamily.trim(),
                status: "Active",
              },
            ],
          }));
          setNotice(`Created designation "${draft.title.trim()}".`);
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
    const { kind, designation } = pendingAction;
    setError(null);
    try {
      const nextStatus = kind === "activate" ? "Active" : "Inactive";
      if (gateway && !isDataControlled) {
        await gateway.updateDesignation(designation.designationId, {
          status: nextStatus,
        });
        await refresh();
      } else if (!isDataControlled) {
        setLocalData((current) => ({
          designations: current.designations.map((row) =>
            row.designationId === designation.designationId
              ? { ...row, status: nextStatus }
              : row,
          ),
        }));
      }
      setNotice(
        nextStatus === "Active"
          ? `Activated designation "${designation.title}".`
          : `Deactivated designation "${designation.title}".`,
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
      aria-label="Designations module"
    >
      <p className={ui.breadcrumb}>Company › Designations</p>
      <p className={ui.lede}>
        Create and manage job titles used across your organization.
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
        <DesignationsDirectory
          data={activeData}
          loading={loading}
          canWrite={canWrite}
          onRequestCatalog={requestCatalog}
          onCreate={() => {
            requestCatalog();
            setDialog({ mode: "create" });
          }}
          onEdit={(designation) => {
            requestCatalog();
            setDialog({ mode: "edit", designation });
          }}
          onToggleStatus={(designation) =>
            setPendingAction({
              kind: designation.status === "Active" ? "deactivate" : "activate",
              designation,
            })
          }
        />
      ) : (
        <p className={ui.empty}>
          You do not have access to designations setup.
        </p>
      )}

      {dialog ? (
        <DesignationDialog
          mode={dialog.mode}
          designation={dialog.designation}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      ) : null}

      {pendingAction ? (
        <ConfirmDesignationStatusDialog
          designation={pendingAction.designation}
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
