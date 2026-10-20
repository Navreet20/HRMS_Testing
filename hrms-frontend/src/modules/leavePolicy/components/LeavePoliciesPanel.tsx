"use client";

import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmployeesInviteSuccessDialog } from "@/modules/employees/components/EmployeesInviteSuccessDialog";
import { cx, empUi as ui } from "@/shared/ui/empUi";
import { userFacingApiError } from "@/shared/http";
import {
  AppButton,
  AppShellToast,
  DirectoryEmptyState,
  AppTableSkeleton,
  FeedbackState,
  PlusIcon,
} from "@/shared/ui";
import type { LeavePoliciesGateway } from "../gateway";
import {
  formatLeavePolicySavedNotice,
  normalizeLeaveTypes,
  normalizePolicies,
  normalizePolicy,
} from "../selectors";
import type {
  LeavePolicyCreateInput,
  LeavePolicyDaysUpdateInput,
  LeavePolicyRecord,
  LeaveTypeOption,
} from "../types";
import { AddPolicyDialog } from "./AddPolicyDialog";
import { ConfirmPolicyStatusDialog } from "./ConfirmPolicyStatusDialog";
import { PolicyTable } from "./PolicyTable";

export interface LeavePoliciesPanelProps {
  readonly gateway?: LeavePoliciesGateway | null;
  readonly canWrite?: boolean;
}

type StatusConfirm =
  | { readonly open: false }
  | {
      readonly open: true;
      readonly policy: LeavePolicyRecord;
      readonly kind: "activate" | "deactivate";
    };

/** Company Setup → Leave Policy → Policies tab (LEAVE-DATA-2 / DATA-3). */
export function LeavePoliciesPanel({
  gateway = null,
  canWrite = true,
}: LeavePoliciesPanelProps) {
  const [policies, setPolicies] = useState<readonly LeavePolicyRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<readonly LeaveTypeOption[]>([]);
  const [loading, setLoading] = useState(Boolean(gateway));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<LeavePolicyRecord | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirm>({
    open: false,
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createSuccessNotice, setCreateSuccessNotice] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!gateway) {
      setPolicies([]);
      setLeaveTypes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [policyRaw, typeRaw] = await Promise.all([
        gateway.listPolicies(),
        gateway.listLeaveTypes(),
      ]);
      setPolicies(normalizePolicies(policyRaw));
      setLeaveTypes(normalizeLeaveTypes(typeRaw));
    } catch (error) {
      setLoadError(userFacingApiError(error));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const existingPolicyNames = useMemo(
    () =>
      new Set(
        policies.map((policy) => policy.policyName.trim().toLowerCase()),
      ),
    [policies],
  );

  function closePolicyDialog() {
    if (busy) {
      return;
    }
    setAddOpen(false);
    setEditPolicy(null);
    setActionError(null);
  }

  async function handleCreate(input: LeavePolicyCreateInput) {
    if (!gateway) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const created = normalizePolicy(await gateway.createPolicy(input));
      setCreateSuccessNotice(
        created
          ? formatLeavePolicySavedNotice(created)
          : "Leave policy is saved.",
      );
      setAddOpen(false);
      await load();
    } catch (error) {
      setActionError(userFacingApiError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateDays(input: LeavePolicyDaysUpdateInput) {
    if (!gateway || !editPolicy) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await gateway.updatePolicyDays(editPolicy.policyId, input);
      setNotice(`${editPolicy.policyName} days updated.`);
      setEditPolicy(null);
      await load();
    } catch (error) {
      setActionError(userFacingApiError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusConfirm() {
    if (!gateway || !statusConfirm.open) {
      return;
    }
    const { policy, kind } = statusConfirm;
    setBusy(true);
    try {
      await gateway.updatePolicyStatus(
        policy.policyId,
        kind === "activate" ? "Active" : "Inactive",
      );
      setNotice(
        kind === "activate"
          ? `${policy.policyName} activated.`
          : `${policy.policyName} deactivated.`,
      );
      setStatusConfirm({ open: false });
      await load();
    } catch (error) {
      setNotice(userFacingApiError(error));
      setStatusConfirm({ open: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={ui.directory}>
      {canWrite ? (
        <div className={ui.toolbar}>
          <div className={ui.toolbarActions}>
            <AppButton
              onClick={() => {
                setActionError(null);
                setEditPolicy(null);
                setAddOpen(true);
              }}
              disabled={!gateway}
            >
              <PlusIcon />
              Add policy
            </AppButton>
          </div>
        </div>
      ) : null}

      {loading ? (
        <AppTableSkeleton
          label="Loading leave policies"
          headers={[
            "Policy name",
            "Year range",
            "Leave entitlements",
            "Assigned employees",
            "Status",
            ...(canWrite ? ["Actions"] : []),
          ]}
        />
      ) : null}
      {loadError ? (
        <FeedbackState
          kind="error"
          title="Could not load policies"
          message={loadError}
        />
      ) : null}

      {!loading && !loadError && policies.length === 0 ? (
        <div className={cx(ui.tableWrap, "p-6")}>
          <DirectoryEmptyState
            icon={<FileText size={22} strokeWidth={1.6} aria-hidden="true" />}
            title="No leave policies yet"
            message={
              canWrite
                ? "Add a policy to define leave entitlements for employees."
                : "Leave policies will appear here once HR adds them."
            }
          />
        </div>
      ) : null}

      {!loading && !loadError && policies.length > 0 ? (
        <>
          <PolicyTable
            policies={policies}
            actions={
              canWrite
                ? {
                    onEditDays: (policy) => {
                      setActionError(null);
                      setAddOpen(false);
                      setEditPolicy(policy);
                    },
                    onActivate: (policy) =>
                      setStatusConfirm({ open: true, policy, kind: "activate" }),
                    onDeactivate: (policy) =>
                      setStatusConfirm({ open: true, policy, kind: "deactivate" }),
                  }
                : null
            }
          />
          <p className="m-0 text-[0.85rem] text-emp-muted">
            Showing {policies.length}{" "}
            {policies.length === 1 ? "policy" : "policies"}.
          </p>
        </>
      ) : null}

      <AddPolicyDialog
        open={canWrite && (addOpen || editPolicy !== null)}
        policy={editPolicy}
        leaveTypes={leaveTypes}
        existingPolicyNames={existingPolicyNames}
        busy={busy}
        actionError={actionError}
        onClose={closePolicyDialog}
        onClearActionError={() => setActionError(null)}
        onSubmit={handleCreate}
        onUpdateDays={handleUpdateDays}
      />
      {canWrite && statusConfirm.open ? (
        <ConfirmPolicyStatusDialog
          policy={statusConfirm.policy}
          kind={statusConfirm.kind}
          busy={busy}
          onCancel={() => setStatusConfirm({ open: false })}
          onConfirm={() => void handleStatusConfirm()}
        />
      ) : null}
      {createSuccessNotice ? (
        <EmployeesInviteSuccessDialog
          message={createSuccessNotice}
          title="Leave policy saved"
          onClose={() => setCreateSuccessNotice(null)}
        />
      ) : null}
      <AppShellToast message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
