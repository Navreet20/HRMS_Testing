import { useEffect, useReducer, useRef, useState } from "react";

import { KeepMounted, mutationErrorMessage } from "@/shared";
import {
  EMPTY_VENDORS_DATA,
  normalizeVendorsModuleData,
} from "@/shared/live";
import { createDefaultActor, DEFAULT_VENDORS_THEME } from "./constants";
import {
  VendorDetailsView,
  VendorDirectory,
  VendorPanel,
  DeactivateVendorDialog,
  type VendorActionKind,
} from "./components";
import { createVendorsState, vendorsReducer } from "./reducer";
import {
  canCreateVendor,
  canListVendors,
  canViewVendor,
  isVendorActor,
  isVendorsTheme,
  selectVendorById,
  selectEmployeesForVendor,
  validateVendorDraft,
} from "./selectors";
import type {
  VendorDraft,
  VendorRecord,
  VendorsModuleProps,
  VendorsView,
} from "./types";
import { ui } from "./uiClasses";

function resolveLanding(
  actor: ReturnType<typeof createDefaultActor>,
  initialView: VendorsView,
  initialVendorId: string | null | undefined,
): { view: VendorsView; vendorId: string | null } {
  if (
    initialView === "details" &&
    initialVendorId &&
    canViewVendor(actor)
  ) {
    return { view: "details", vendorId: initialVendorId };
  }
  return { view: "directory", vendorId: null };
}

export function VendorsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_VENDORS_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_VENDORS_THEME,
  initialView = "directory",
  initialVendorId = null,
  onDataChange,
  onNavigate: _onNavigate,
  onViewChange,
  role,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
}: VendorsModuleProps) {
  const resolvedDefaultActor = defaultActor ?? createDefaultActor(role);
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActor = actor ?? resolvedDefaultActor;
  const activeActor = isVendorActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;

  const landing = resolveLanding(activeActor, initialView, initialVendorId);

  const [state, dispatch] = useReducer(
    vendorsReducer,
    createVendorsState(defaultData, landing.view, landing.vendorId),
  );

  const [panelState, setPanelState] = useState<{
    mode: "create" | "edit" | "view";
    vendor: VendorRecord | null;
  } | null>(null);
  const [pendingDeactivate, setPendingDeactivate] =
    useState<VendorRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isDataControlled = data !== undefined;
  const activeData = data ?? state.data;
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isVendorsTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_VENDORS_THEME;

  const canCreate = canCreateVendor(activeActor);
  const canList = canListVendors(activeActor);

  useEffect(() => {
    if (isDataControlled) return;
    onDataChange?.(state.data);
  }, [isDataControlled, onDataChange, state.data]);

  const lastPublishedView = useRef<string>("");
  useEffect(() => {
    const key = `${state.ui.view}:${state.ui.detailsVendorId ?? ""}`;
    if (lastPublishedView.current === key) {
      return;
    }
    lastPublishedView.current = key;
    onViewChange?.(state.ui.view, state.ui.detailsVendorId);
  }, [state.ui.view, state.ui.detailsVendorId, onViewChange]);

  function handleAddVendor() {
    setPanelState({ mode: "create", vendor: null });
  }

  function handleAction(kind: VendorActionKind, vendor: VendorRecord) {
    if (kind === "view") {
      setPanelState({ mode: "view", vendor });
    } else if (kind === "edit") {
      setPanelState({ mode: "edit", vendor });
    } else if (kind === "details") {
      dispatch({
        type: "SET_VIEW",
        view: "details",
        vendorId: vendor.id,
      });
    } else if (kind === "deactivate") {
      setPendingDeactivate(vendor);
    }
  }

  async function handlePanelSave(draft: VendorDraft) {
    if (isDataControlled) {
      setNotice("Host-controlled data mode — cannot mutate.");
      setPanelState(null);
      return;
    }

    const excludeId =
      panelState?.mode === "edit" ? panelState.vendor?.id : undefined;
    const errors = validateVendorDraft(
      draft,
      activeData.vendors,
      excludeId,
    );
    if (errors.length > 0) {
      setNotice(errors[0]!.message);
      return;
    }

    if (gateway) {
      try {
        const body = {
          vendorName: draft.name,
          vendorStatus: "ACTIVE",
        };
        if (panelState?.mode === "create") {
          await gateway.createVendor(body);
          setNotice(`Created vendor "${draft.name}".`);
        } else if (panelState?.mode === "edit" && panelState.vendor) {
          await gateway.updateVendor(panelState.vendor.id, body);
          setNotice(`Updated vendor "${draft.name}".`);
        }
        const raw = await gateway.getVendors();
        dispatch({
          type: "REPLACE_DATA",
          data: {
            ...normalizeVendorsModuleData(raw),
            employeeLinks: activeData.employeeLinks,
          },
        });
      } catch (error) {
        setNotice(mutationErrorMessage(error));
      }
      setPanelState(null);
      return;
    }

    if (panelState?.mode === "create") {
      dispatch({ type: "CREATE_VENDOR", draft });
      setNotice(`Created vendor "${draft.name}".`);
    } else if (panelState?.mode === "edit" && panelState.vendor) {
      dispatch({
        type: "UPDATE_VENDOR",
        vendorId: panelState.vendor.id,
        patch: draft,
      });
      setNotice(`Updated vendor "${draft.name}".`);
    }
    setPanelState(null);
  }

  async function handleConfirmDeactivate() {
    if (!pendingDeactivate || isDataControlled) {
      setPendingDeactivate(null);
      return;
    }
    if (gateway) {
      try {
        await gateway.deleteVendor(pendingDeactivate.id);
        const raw = await gateway.getVendors();
        dispatch({
          type: "REPLACE_DATA",
          data: {
            ...normalizeVendorsModuleData(raw),
            employeeLinks: activeData.employeeLinks,
          },
        });
        setNotice(`Deactivated "${pendingDeactivate.name}".`);
      } catch (error) {
        setNotice(mutationErrorMessage(error));
      }
      setPendingDeactivate(null);
      return;
    }
    dispatch({
      type: "DEACTIVATE_VENDOR",
      vendorId: pendingDeactivate.id,
    });
    setNotice(`Deactivated "${pendingDeactivate.name}".`);
    setPendingDeactivate(null);
  }

  function handleSaveMsa(msaStartDate: string, msaEndDate: string) {
    if (!state.ui.detailsVendorId || isDataControlled) {
      return;
    }
    if (gateway) {
      setNotice(
        "Live API: MSA dates are not persisted (backend stores name/status only).",
      );
      return;
    }
    dispatch({
      type: "UPDATE_MSA",
      vendorId: state.ui.detailsVendorId,
      msaStartDate,
      msaEndDate,
    });
    setNotice("MSA dates updated.");
  }

  const detailsVendor = state.ui.detailsVendorId
    ? selectVendorById(activeData, state.ui.detailsVendorId)
    : null;
  const showDetails =
    state.ui.view === "details" && detailsVendor != null && canViewVendor(activeActor);

  return (
    <section
      className={ui.root}
      data-theme={activeTheme}
      aria-label="Vendors module"
    >
      {state.ui.lastError ? (
        <p className={ui.error} role="alert">
          {state.ui.lastError}
        </p>
      ) : null}

      {notice ? (
        <div className={ui.notice} role="status">
          <p className={ui.noticeText}>{notice}</p>
          <button
            type="button"
            className={ui.btnGhostCompact}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {panelState ? (
        <VendorPanel
          mode={panelState.mode}
          vendor={panelState.vendor}
          data={activeData}
          onClose={() => setPanelState(null)}
          onSave={handlePanelSave}
        />
      ) : showDetails && detailsVendor ? (
        <VendorDetailsView
          vendor={detailsVendor}
          actor={activeActor}
          employees={selectEmployeesForVendor(
            activeData,
            detailsVendor.id,
          )}
          onBack={() => dispatch({ type: "SET_VIEW", view: "directory" })}
          onSaveMsa={handleSaveMsa}
        />
      ) : null}
      {canList ? (
        <KeepMounted show={!showDetails && !panelState}>
        <VendorDirectory
          actor={activeActor}
          data={activeData}
          canCreate={canCreate}
          onAddVendor={handleAddVendor}
          onAction={handleAction}
        />
        </KeepMounted>
      ) : !showDetails ? (
        <p className={ui.empty}>
          Your role does not have access to the vendor directory.
        </p>
      ) : null}

      {pendingDeactivate ? (
        <DeactivateVendorDialog
          vendor={pendingDeactivate}
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={handleConfirmDeactivate}
        />
      ) : null}
    </section>
  );
}
