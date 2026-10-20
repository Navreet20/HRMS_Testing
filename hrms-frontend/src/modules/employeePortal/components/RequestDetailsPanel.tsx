"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  SkillCertificatePreviewDialog,
  type SkillCertificatePreview,
} from "@/modules/employees/components/SkillCertificatePreviewDialog";
import {
  AppButton,
  AppDetailPane,
  AppNotice,
  AppSidePanel,
  AppTimeline,
  StatusBadge,
  WorkflowTimeline,
  type AppTimelineStep,
} from "@/shared/ui";
import {
  normalizeWorkflowEvents,
  type WorkflowEventRecord,
} from "@/shared/workflowHistory";
import type { MyRequestRow } from "../myRequests";
import type { EmployeePortalGateway } from "../types";
import { formatRequestDay } from "./MyRequestCard";
import { requestStatusTone } from "../requestStatus";

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="grid gap-[0.55rem]">
      <h3 className="m-0 text-[0.85rem] font-extrabold uppercase tracking-[0.06em] text-emp-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function timelineSteps(request: MyRequestRow, forMyself: boolean): AppTimelineStep[] {
  const submitted: AppTimelineStep = {
    key: "submitted",
    state: "done",
    when: formatRequestDay(request.requestedDate),
    title: "Request submitted",
    detail: forMyself ? "By you, for yourself" : `By you, for ${request.subjectName}`,
  };
  if (request.statusLabel === "Pending") {
    return [
      submitted,
      {
        key: "review",
        state: "current",
        when: "Now",
        title:
          request.kind === "asset" ? "Waiting for the asset manager" : "Waiting for HR review",
        detail: "Nothing has changed yet",
      },
      {
        key: "decision",
        state: "upcoming",
        when: "Next",
        title: "Approved or rejected",
        detail:
          request.kind === "profileUpdate"
            ? "The profile changes only after approval"
            : "The asset is handled only after approval",
      },
    ];
  }
  const decidedBy =
    request.decidedByName ?? (request.kind === "asset" ? "the asset manager" : "HR");
  return [
    submitted,
    {
      key: "decision",
      state: "done",
      when: request.decidedDate ? formatRequestDay(request.decidedDate) : undefined,
      title: `${request.statusLabel} by ${decidedBy}`,
      detail: request.decisionNote ? `“${request.decisionNote}”` : undefined,
    },
  ];
}

export interface RequestDetailsPanelProps {
  readonly request: MyRequestRow | null;
  readonly gateway: EmployeePortalGateway | null;
  readonly currentEmployeeId?: string | null;
  readonly onClose: () => void;
  /** "inline": right column inside the page; "overlay": side panel over the app. */
  readonly variant?: "inline" | "overlay";
  /** A rejected request can be sent again; the form opens with its details filled in. */
  readonly onResubmit?: (request: MyRequestRow) => void;
}

/** Self → Requests: one request's details in a side panel over the list. */
export function RequestDetailsPanel({
  request,
  gateway,
  currentEmployeeId = null,
  onClose,
  variant = "overlay",
  onResubmit,
}: RequestDetailsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState<readonly WorkflowEventRecord[]>([]);
  const requestId = request?.requestId ?? null;
  const requestKind = request?.kind ?? null;
  const requestStatus = request?.statusLabel ?? null;
  // The full story (rejections with their comments, resubmissions) when the API has it.
  useEffect(() => {
    if (!requestId || !requestKind || requestKind === "it" || !gateway?.getRequestHistory) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    gateway
      .getRequestHistory(requestKind, requestId)
      .then((raw) => !cancelled && setEvents(normalizeWorkflowEvents(raw)))
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, [gateway, requestId, requestKind, requestStatus]);
  const [preview, setPreview] = useState<SkillCertificatePreview | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  if (!request) {
    return null;
  }
  const forMyself =
    !request.subjectEmployeeId ||
    request.subjectEmployeeId === request.requesterEmployeeId ||
    request.subjectEmployeeId === currentEmployeeId;
  const reason = (request.longDescription ?? "").trim();
  const canOpenFile =
    request.hasAttachment && Boolean(gateway?.downloadOwnProfileUpdateAttachment);

  async function loadFile(): Promise<SkillCertificatePreview | null> {
    if (!gateway?.downloadOwnProfileUpdateAttachment || !request) {
      return null;
    }
    const { blob, fileName } = await gateway.downloadOwnProfileUpdateAttachment(
      request.requestId,
    );
    return {
      url: URL.createObjectURL(blob),
      fileName: request.attachmentFileName || fileName,
      contentType: blob.type || "application/octet-stream",
      blob,
    };
  }

  async function openFile(download: boolean) {
    setFileBusy(true);
    setFileError(null);
    try {
      const file = await loadFile();
      if (!file) {
        return;
      }
      if (download) {
        saveFile(file);
        URL.revokeObjectURL(file.url);
      } else {
        setPreview(file);
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not open the document.");
    } finally {
      setFileBusy(false);
    }
  }

  function saveFile(file: SkillCertificatePreview) {
    const anchor = document.createElement("a");
    anchor.href = file.url;
    anchor.download = file.fileName || "document";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(request?.requestId ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const body = (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={request.statusLabel}
              tone={requestStatusTone(request.statusLabel)}
            />
            <span className="text-[0.85rem] text-emp-muted">
              {request.kindLabel} · requested {formatRequestDay(request.requestedDate)}
            </span>
          </div>

          <Section title="Timeline">
            {events.length > 1 ? (
              <WorkflowTimeline events={events} ariaLabel="Request history" />
            ) : (
              <AppTimeline ariaLabel="Request timeline" steps={timelineSteps(request, forMyself)} />
            )}
          </Section>

          {request.statusLabel === "Rejected" && onResubmit ? (
            <div className="flex flex-wrap items-center gap-2 border-0 border-l-[3px] border-solid border-emp-accent py-1 pl-3">
              <span className="min-w-0 flex-1 text-[0.86rem] text-emp-text">
                Fix what was asked and send it again. The rejection stays in the history.
              </span>
              <AppButton onClick={() => onResubmit(request)}>Edit and resubmit</AppButton>
            </div>
          ) : null}

          <Section title={request.change ? "Requested change" : "Request"}>
            {request.change ? (
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 border-0 border-y border-solid border-emp-line py-2 text-[0.88rem]">
                <dt className="text-emp-muted">{request.change.fieldLabel}</dt>
                <dd className="m-0 [overflow-wrap:anywhere]">
                  <s className="text-emp-muted">{request.change.oldValue}</s>
                  {" → "}
                  <b>{request.change.newValue}</b>
                </dd>
              </dl>
            ) : null}
            {reason ? (
              <p className="m-0 whitespace-pre-line text-[0.88rem] leading-normal text-emp-text [overflow-wrap:anywhere]">
                {reason}
              </p>
            ) : !request.change ? (
              <p className="m-0 text-[0.88rem] text-emp-muted">No details added.</p>
            ) : null}
          </Section>

          <Section title="Details">
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.86rem]">
              <dt className="text-emp-muted">Requested for</dt>
              <dd className="m-0 font-semibold">{request.subjectName}</dd>
              <dt className="text-emp-muted">Requested by</dt>
              <dd className="m-0 font-semibold">{request.requesterName}</dd>
              <dt className="text-emp-muted">Request ID</dt>
              <dd className="m-0 flex min-w-0 flex-wrap items-center gap-2">
                <code className="rounded-[0.3rem] bg-emp-raised px-[0.35rem] py-[0.05rem] text-[0.85rem] [overflow-wrap:anywhere]">
                  {request.requestId}
                </code>
                <AppButton variant="ghost" size="compact" onClick={() => void copyId()}>
                  {copied ? "Copied" : "Copy"}
                </AppButton>
              </dd>
            </dl>
          </Section>

          {request.hasAttachment ? (
            <Section title="Document">
              <div className="flex flex-wrap items-center gap-2 border-0 border-y border-solid border-emp-line py-2">
                <span className="min-w-0 flex-1 truncate text-[0.86rem] font-semibold">
                  {request.attachmentFileName || "Supporting document"}
                </span>
                {canOpenFile ? (
                  <>
                    <AppButton
                      variant="secondary"
                      size="compact"
                      disabled={fileBusy}
                      aria-label="View supporting document"
                      onClick={() => void openFile(false)}
                    >
                      View
                    </AppButton>
                    <AppButton
                      variant="ghost"
                      size="compact"
                      disabled={fileBusy}
                      aria-label="Download supporting document"
                      onClick={() => void openFile(true)}
                    >
                      Download
                    </AppButton>
                  </>
                ) : null}
              </div>
              {fileError ? <AppNotice tone="error">{fileError}</AppNotice> : null}
            </Section>
          ) : null}
        </div>
  );

  return (
    <>
      {variant === "inline" ? (
        <AppDetailPane title={request.title} onClose={onClose}>
          {body}
        </AppDetailPane>
      ) : (
        <AppSidePanel open title={request.title} onClose={onClose}>
          {body}
        </AppSidePanel>
      )}
      <SkillCertificatePreviewDialog
        preview={preview}
        description="Supporting document preview"
        onClose={() => {
          if (preview) {
            URL.revokeObjectURL(preview.url);
          }
          setPreview(null);
        }}
        onDownload={() => {
          if (preview) {
            saveFile(preview);
          }
        }}
      />
    </>
  );
}
