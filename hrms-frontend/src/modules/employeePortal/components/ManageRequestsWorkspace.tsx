"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { userFacingApiError } from "@/shared";
import {
  AppButton,
  AppNotice,
  AppPagination,
  AppSearchField,
  AppSectionCard,
  AppClearFilters,
  AppEmptyState,
  AppSelect,
  AppShellToast,
  AppTableSkeleton,
  RejectReasonDialog,
  RequestRow,
  useQueueShortcuts,
  usePersistentState,
} from "@/shared/ui";
import { SkillCertificatePreviewDialog } from "@/modules/employees/components/SkillCertificatePreviewDialog";
import type { SkillCertificatePreview } from "@/modules/employees/components/SkillCertificatePreviewDialog";
import { formatRequestDate, isPendingRequestStatus } from "../myRequests";
import { requestStatusTone } from "../requestStatus";
import {
  countQueueByStatus,
  mapAssetQueueRow,
  mapItQueueRow,
  mapProfileQueueRow,
  visibleQueueRows,
  type ManageQueueRow,
  type QueueStatusFilter,
  type QueueTypeFilter,
} from "../manageQueue";
import type { OpenEmployeeProfileFromRequestOptions } from "../profileUpdateCompletion";
import type {
  DecideAssetRequestInput,
  EmployeePortalGateway,
  ManagingOptionResponse,
} from "../types";
import { ApproveAssetRequestDialog } from "./ApproveAssetRequestDialog";
import { RequestViewDetails } from "./RequestViewDetails";

export const REQUEST_QUEUE_PAGE_SIZE = 5;

export interface ManageRequestsWorkspaceProps {
  readonly gateway?: EmployeePortalGateway | null;
  readonly managingOption?: ManagingOptionResponse | null;
  readonly onOpenEmployeeProfile?: (
    employeeId: string,
    options?: OpenEmployeeProfileFromRequestOptions,
  ) => void;
  /** Lets the Manage tabs show how many requests are waiting. */
  readonly onWaitingCountChange?: (count: number) => void;
}

function rowKey(row: Pick<ManageQueueRow, "id" | "kind">): string {
  return `${row.kind}:${row.id}`;
}

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "profileUpdate", label: "Profile updates" },
  { value: "asset", label: "Assets" },
  { value: "it", label: "IT" },
];

const EMPTY_TEXT: Record<QueueStatusFilter, { title: string; message: string }> = {
  waiting: {
    title: "You are all caught up",
    message: "New requests from your team appear here, oldest first.",
  },
  approved: {
    title: "No approved requests",
    message: "Requests you approve show up here.",
  },
  rejected: {
    title: "No rejected requests",
    message: "Requests you reject show up here, with your comment.",
  },
  all: { title: "No requests yet", message: "Requests from your team show up here." },
};

export function ManageRequestsWorkspace({
  gateway = null,
  managingOption = null,
  onOpenEmployeeProfile,
  onWaitingCountChange,
}: ManageRequestsWorkspaceProps) {
  const [rows, setRows] = useState<readonly ManageQueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = usePersistentState<QueueStatusFilter>(
    "employeePortal.manageRequests.status",
    "waiting",
  );
  const [typeFilter, setTypeFilter] = usePersistentState<QueueTypeFilter>(
    "employeePortal.manageRequests.type",
    "all",
  );
  const [queueQuery, setQueueQuery] = usePersistentState(
    "employeePortal.manageRequests.search",
    "",
  );
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] =
    useState<SkillCertificatePreview | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const canProfile = Boolean(managingOption?.canManageProfileUpdates);
  const canAsset = Boolean(managingOption?.canManageAssetRequests);
  const canIt = Boolean(managingOption?.canManageItRequests);

  const counts = useMemo(() => countQueueByStatus(rows), [rows]);
  const visible = useMemo(
    () =>
      visibleQueueRows(rows, {
        status: statusFilter,
        type: typeFilter,
        query: queueQuery,
      }),
    [rows, statusFilter, typeFilter, queueQuery],
  );

  // IT requests are read only here, so they are not "waiting for you".
  const actionableWaiting = useMemo(
    () =>
      rows.filter((row) => row.kind !== "it" && isPendingRequestStatus(row.status))
        .length,
    [rows],
  );
  useEffect(() => {
    if (!loading) {
      onWaitingCountChange?.(actionableWaiting);
    }
  }, [actionableWaiting, loading, onWaitingCountChange]);

  const refreshQueue = useCallback(async () => {
    if (!gateway) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profile, asset, it] = await Promise.all([
        canProfile ? gateway.listManageProfileUpdateRequests() : Promise.resolve([]),
        canAsset ? gateway.listManageAssetRequests() : Promise.resolve([]),
        canIt ? gateway.listManageItRequests() : Promise.resolve([]),
      ]);
      setRows([
        ...profile.map(mapProfileQueueRow),
        ...asset.map(mapAssetQueueRow),
        ...it.map(mapItQueueRow),
      ]);
    } catch (loadError) {
      setRows([]);
      setError(userFacingApiError(loadError));
    } finally {
      setLoading(false);
    }
  }, [canAsset, canIt, canProfile, gateway]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  // The open request is derived from the list, so it is never stale. Nothing
  // opens on its own: the manager clicks a request in the queue to read it.
  const selected = visible.find((row) => rowKey(row) === selectedKey) ?? null;

  const pageCount = Math.max(1, Math.ceil(visible.length / REQUEST_QUEUE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(
    safePage * REQUEST_QUEUE_PAGE_SIZE,
    (safePage + 1) * REQUEST_QUEUE_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [queueQuery, statusFilter, typeFilter]);

  // Follow the open request onto its page.
  const selectedIndex = selected ? visible.findIndex((row) => rowKey(row) === rowKey(selected)) : -1;
  useEffect(() => {
    if (selectedIndex >= 0) {
      setPage(Math.floor(selectedIndex / REQUEST_QUEUE_PAGE_SIZE));
    }
  }, [selectedIndex]);

  const pending = selected ? isPendingRequestStatus(selected.status) : false;
  const canDecide =
    pending && selected !== null && selected.kind !== "it" && Boolean(gateway);

  function selectRow(row: ManageQueueRow) {
    setSelectedKey(rowKey(row));
    setAttachmentError(null);
    // On a phone the request opens below the list, so bring it into view.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      detailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }

  function moveSelection(step: number) {
    if (visible.length === 0) {
      return;
    }
    const next = visible[Math.min(visible.length - 1, Math.max(0, selectedIndex + step))];
    if (next) {
      selectRow(next);
    }
  }

  function startApprove() {
    if (!canDecide || !selected) {
      return;
    }
    if (selected.kind === "asset") {
      setDialogError(null);
      setApproveOpen(true);
    } else {
      void handleApprove({ action: "approve" });
    }
  }

  useQueueShortcuts({
    enabled: !rejectOpen && !approveOpen && !busy,
    onNext: () => moveSelection(1),
    onPrevious: () => moveSelection(-1),
    onApprove: canDecide ? startApprove : undefined,
    onClose: selected ? () => setSelectedKey(null) : undefined,
  });

  function openSubjectProfile() {
    if (!selected?.subjectEmployeeId || !onOpenEmployeeProfile) {
      return;
    }
    if (selected.kind === "profileUpdate" && pending) {
      onOpenEmployeeProfile(selected.subjectEmployeeId, {
        profileUpdateRequestId: selected.id,
        shortDescription: selected.description,
        longDescription: selected.longDescription,
        returnToManageQueue: "profileUpdates",
      });
      return;
    }
    onOpenEmployeeProfile(selected.subjectEmployeeId, {
      returnToManageQueue: "profileUpdates",
    });
  }

  async function fetchAttachmentBlob(): Promise<{
    blob: Blob;
    name: string;
  } | null> {
    if (!gateway || !selected?.hasAttachment) {
      return null;
    }
    const { blob, fileName } = await gateway.downloadProfileUpdateAttachment(
      selected.id,
    );
    const name =
      (selected.attachmentFileName ?? "").trim() || fileName || "document";
    return { blob, name };
  }

  async function viewAttachment() {
    if (!gateway || !selected?.hasAttachment) {
      return;
    }
    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      const loaded = await fetchAttachmentBlob();
      if (!loaded) {
        return;
      }
      setAttachmentPreview({
        url: URL.createObjectURL(loaded.blob),
        fileName: loaded.name,
        contentType: loaded.blob.type || "application/octet-stream",
        blob: loaded.blob,
      });
    } catch (viewError) {
      setAttachmentError(
        viewError instanceof Error
          ? viewError.message
          : "Could not open the supporting document.",
      );
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function downloadAttachment() {
    if (!gateway || !selected?.hasAttachment) {
      return;
    }
    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      const loaded = await fetchAttachmentBlob();
      if (!loaded) {
        return;
      }
      const url = URL.createObjectURL(loaded.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = loaded.name;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setAttachmentError(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not download the supporting document.",
      );
    } finally {
      setAttachmentBusy(false);
    }
  }

  /** The request after this one in the list, if any ("Approve & next"). */
  const following = selectedIndex >= 0 ? (visible[selectedIndex + 1] ?? null) : null;

  /** After a decision open the next request, or close the panel when it was the last. */
  function openFollowing() {
    setSelectedKey(following ? rowKey(following) : null);
  }

  async function decide(input: DecideAssetRequestInput): Promise<void> {
    if (!gateway || !selected) {
      return;
    }
    if (selected.kind === "profileUpdate") {
      await gateway.decideProfileUpdateRequest(selected.id, {
        action: input.action,
        ...(input.notes ? { notes: input.notes } : {}),
      });
    } else {
      await gateway.decideAssetRequest(selected.id, input);
    }
  }

  async function handleApprove(input: DecideAssetRequestInput) {
    if (!gateway || !selected || !canDecide) {
      return;
    }
    setBusy(true);
    setError(null);
    setDialogError(null);
    try {
      await decide(input);
      openFollowing();
      setApproveOpen(false);
      setNotice(
        selected.kind === "profileUpdate" && selected.change
          ? "Request approved and the profile is updated."
          : "Request approved.",
      );
      await refreshQueue();
    } catch (approveError) {
      const message = userFacingApiError(approveError);
      // The asset dialog shows its own error; otherwise show it on the page.
      if (approveOpen) {
        setDialogError(message);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(notes: string) {
    if (!gateway || !selected || !canDecide) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await decide({ action: "reject", notes });
      openFollowing();
      setRejectOpen(false);
      setNotice("Request rejected. The employee was emailed your comment.");
      await refreshQueue();
    } catch (rejectError) {
      setError(userFacingApiError(rejectError));
    } finally {
      setBusy(false);
    }
  }

  const empty = EMPTY_TEXT[statusFilter];
  const filtering = Boolean(queueQuery.trim()) || typeFilter !== "all";

  return (
    <div className="grid gap-[1rem]" aria-label="Manage requests">
      <div className="flex flex-wrap items-baseline justify-between gap-[0.5rem]">
        <h2 className="m-0 text-[1.05rem] font-semibold text-emp-text">
          Manage requests
        </h2>
        <span className="text-[0.85rem] text-emp-muted" aria-live="polite">
          {loading
            ? "Loading…"
            : `${actionableWaiting} ${actionableWaiting === 1 ? "request" : "requests"} waiting for you`}
        </span>
      </div>
      {notice ? (
        <AppShellToast
          message={notice}
          variant="success"
          onClose={() => setNotice(null)}
        />
      ) : null}
      {error ? <AppNotice tone="error">{error}</AppNotice> : null}

      <div className="grid gap-[1rem] min-[64rem]:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] min-[64rem]:items-start">
        <AppSectionCard aria-label="Request queue">
          <div className="grid min-h-0 gap-[0.75rem]" aria-label="Request queue">
            <div className="flex items-center gap-[0.55rem]">
              <AppSearchField
                id="manage-requests-search"
                value={queueQuery}
                onChange={setQueueQuery}
                placeholder="Search name or details"
                aria-label="Search requests"
                className="min-w-[10rem] flex-1"
              />
              <AppButton
                variant="secondary"
                size="icon"
                aria-label="Refresh"
                title="Refresh"
                disabled={loading || busy || !gateway}
                onClick={() => {
                  void refreshQueue();
                }}
              >
                <RefreshCw size={16} strokeWidth={1.9} aria-hidden="true" />
              </AppButton>
            </div>
            <div className="grid grid-cols-2 gap-[0.55rem]">
              <AppSelect
                aria-label="Filter by status"
                placeholder="Select status"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as QueueStatusFilter)}
                options={[
                  { value: "waiting", label: `Waiting (${counts.waiting})` },
                  { value: "approved", label: `Approved (${counts.approved})` },
                  { value: "rejected", label: `Rejected (${counts.rejected})` },
                  { value: "all", label: "All" },
                ]}
              />
              <AppSelect
                aria-label="Filter by request type"
                placeholder="Select type"
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as QueueTypeFilter)}
                options={TYPE_OPTIONS}
              />
            </div>
            <AppClearFilters
              active={
                queueQuery.trim() !== "" ||
                statusFilter !== "waiting" ||
                typeFilter !== "all"
              }
              onClear={() => {
                setQueueQuery("");
                setStatusFilter("waiting");
                setTypeFilter("all");
              }}
            />
            {loading && rows.length === 0 ? (
              <AppTableSkeleton
                label="Loading requests"
                headers={["Requester", "Type", "Details", "Requested", "Status"]}
              />
            ) : pageRows.length === 0 ? (
              <AppEmptyState
                variant={
                  filtering
                    ? "search"
                    : statusFilter === "waiting"
                      ? "caught-up"
                      : "empty"
                }
                title={filtering ? "No requests match" : empty.title}
                message={filtering ? "Try a different search or type." : empty.message}
              />
            ) : (
              <ul className="m-0 grid list-none gap-[0.55rem] p-0">
                {pageRows.map((row) => (
                  <li key={`${row.kind}:${row.id}`}>
                    <RequestRow
                      layout="stack"
                      requester={row.requesterName}
                      requestType={row.typeLabel}
                      dateLabel={
                        row.requestedDate ? formatRequestDate(row.requestedDate) : "—"
                      }
                      summary={row.description}
                      selected={selected ? rowKey(selected) === rowKey(row) : false}
                      onSelect={() => selectRow(row)}
                      status={{
                        label: row.statusLabel,
                        tone: requestStatusTone(row.statusLabel),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <AppPagination
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
              disabled={loading || busy}
            />
          </div>
        </AppSectionCard>

        <div ref={detailRef}>
          <AppSectionCard aria-label="Request details" className="!p-0 overflow-hidden">
            {selected ? (
              <RequestViewDetails
                request={selected}
                onClose={() => setSelectedKey(null)}
                showProfileApplyHints={
                  Boolean(onOpenEmployeeProfile) &&
                  selected.kind === "profileUpdate" &&
                  pending &&
                  !selected.change
                }
                onOpenSubjectProfile={
                  selected.subjectEmployeeId && onOpenEmployeeProfile && pending
                    ? openSubjectProfile
                    : undefined
                }
                attachmentActions={
                  selected.hasAttachment
                    ? {
                        busy: attachmentBusy || !gateway,
                        error: attachmentError,
                        onView: () => {
                          void viewAttachment();
                        },
                        onDownload: () => {
                          void downloadAttachment();
                        },
                      }
                    : null
                }
                actionHint={
                  selected.kind === "it" && pending
                    ? "IT requests cannot be approved from this queue yet."
                    : pending && selected.kind === "profileUpdate" && selected.change
                      ? `Approving updates ${selected.change.fieldLabel.toLowerCase()} on the employee's profile and records it in the audit log.`
                      : pending && selected.kind === "asset"
                        ? "Approving asks you which asset to hand out, then assigns it in Assets."
                        : undefined
                }
                actions={
                  canDecide ? (
                    <>
                      <AppButton
                        variant="danger"
                        disabled={busy}
                        onClick={() => setRejectOpen(true)}
                      >
                        Reject
                      </AppButton>
                      <AppButton disabled={busy} onClick={startApprove}>
                        {selected.kind === "asset"
                          ? "Approve…"
                          : following
                            ? "Approve & next"
                            : "Approve"}
                      </AppButton>
                    </>
                  ) : selected.kind === "it" && pending ? (
                    <span />
                  ) : undefined
                }
              />
            ) : (
              <div className="p-[1.25rem]">
                <AppEmptyState
                  variant="select"
                  title="Select a request"
                  message="Choose a request in the queue to read it and approve or reject."
                  className="py-[1.25rem]"
                />
              </div>
            )}
          </AppSectionCard>
        </div>
      </div>

      {rejectOpen && selected ? (
        <RejectReasonDialog
          title="Reject request"
          label="Comment"
          description={`${selected.requesterName}. The employee is emailed this comment.`}
          busy={busy}
          onCancel={() => setRejectOpen(false)}
          onConfirm={(notes) => {
            void handleReject(notes);
          }}
        />
      ) : null}
      {approveOpen && selected && gateway ? (
        <ApproveAssetRequestDialog
          request={selected}
          gateway={gateway}
          busy={busy}
          error={dialogError}
          onCancel={() => setApproveOpen(false)}
          onConfirm={(input) => {
            void handleApprove(input);
          }}
        />
      ) : null}
      <SkillCertificatePreviewDialog
        preview={attachmentPreview}
        description="Supporting document preview"
        onClose={() => setAttachmentPreview(null)}
        onDownload={() => {
          if (!attachmentPreview) {
            return;
          }
          const url = URL.createObjectURL(attachmentPreview.blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = attachmentPreview.fileName || "document";
          anchor.rel = "noopener";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        }}
      />
    </div>
  );
}
