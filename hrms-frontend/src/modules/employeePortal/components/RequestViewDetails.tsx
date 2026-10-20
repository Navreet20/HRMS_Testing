"use client";

import type { ReactNode } from "react";

import {
  AppButton,
  AppNotice,
  ReviewActionBar,
  ReviewBody,
  ReviewFact,
  ReviewFacts,
  ReviewHeader,
  ReviewNote,
  ReviewQuote,
  ReviewSection,
  StatusBadge,
} from "@/shared/ui";
import { formatRequestDate } from "../myRequests";
import { requestStatusTone } from "../requestStatus";
import type { RequestPartyIdentity } from "../types";

export interface RequestViewModel {
  readonly id: string;
  readonly kind: "profileUpdate" | "asset" | "it";
  readonly typeLabel: string;
  readonly requesterName: string;
  readonly requesterEmployeeId: string | null;
  readonly requester: RequestPartyIdentity | null;
  readonly subjectName: string;
  readonly subjectEmployeeId: string | null;
  readonly subject: RequestPartyIdentity | null;
  readonly description: string;
  readonly longDescription: string | null;
  readonly attachmentFileName: string | null;
  readonly hasAttachment: boolean;
  readonly statusLabel: string;
  readonly requestedDate: string | null;
  /** Structured profile change, shown as Now → Requested. */
  readonly change?: {
    readonly fieldLabel: string;
    readonly oldValue: string;
    readonly newValue: string;
  } | null;
  /** How it was decided: who, when and the comment (rejections always have one). */
  readonly decidedByName?: string | null;
  readonly decidedDate?: string | null;
  readonly decisionNote?: string | null;
}

export interface RequestViewAttachmentActions {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onView: () => void;
  readonly onDownload: () => void;
}

export interface RequestViewDetailsProps {
  readonly request: RequestViewModel;
  /** When set, subject name becomes a link (manage queue apply flow). */
  readonly onOpenSubjectProfile?: () => void;
  /** Show “Open this profile…” helper under subject (manage only). */
  readonly showProfileApplyHints?: boolean;
  /** When set, Eye/Download are shown for profile attachments. */
  readonly attachmentActions?: RequestViewAttachmentActions | null;
  /** ✕ in the header: stop working on this request for now. */
  readonly onClose?: () => void;
  /** Decision buttons, shown in the bar at the bottom. */
  readonly actions?: ReactNode;
  /** Short line beside the buttons, such as what approving will do. */
  readonly actionHint?: ReactNode;
}

function partyDisplayName(
  party: RequestPartyIdentity | null,
  fallback: string,
): string {
  if (party) {
    const name = [party.firstName, party.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    if (name) {
      return name;
    }
  }
  return fallback.trim() || "—";
}

function partyEmployeeId(
  party: RequestPartyIdentity | null,
  fallbackId: string | null,
): string {
  return (party?.businessEmployeeId ?? fallbackId ?? "").trim();
}

/** One request, laid out for a reviewer: who, what they asked for, and what happens next. */
export function RequestViewDetails({
  request,
  onOpenSubjectProfile,
  showProfileApplyHints = false,
  attachmentActions = null,
  onClose,
  actions,
  actionHint,
}: RequestViewDetailsProps) {
  const requesterName = partyDisplayName(request.requester, request.requesterName);
  const subjectName = partyDisplayName(request.subject, request.subjectName);
  const requesterCode = partyEmployeeId(request.requester, request.requesterEmployeeId);
  const onBehalf =
    (request.requesterEmployeeId ?? "") !== (request.subjectEmployeeId ?? "");
  const decided =
    request.statusLabel === "Approved" ||
    request.statusLabel === "Completed" ||
    request.statusLabel === "Rejected";
  const canOpenProfile = !decided && Boolean(onOpenSubjectProfile);
  const showApplyHint = showProfileApplyHints && canOpenProfile;
  const firstName = requesterName.split(" ")[0] ?? requesterName;
  const note = (request.longDescription ?? "").trim();

  return (
    <div className="grid">
      <ReviewHeader
        name={requesterName}
        subline={
          <>
            {requesterCode ? `${requesterCode} · ` : ""}
            Requested {request.requestedDate ? formatRequestDate(request.requestedDate) : "—"}
          </>
        }
        badges={
          <>
            <StatusBadge label={request.typeLabel} tone="neutral" />
            <StatusBadge
              label={request.statusLabel}
              tone={requestStatusTone(request.statusLabel)}
            />
          </>
        }
        onClose={onClose}
        closeLabel="Close request"
      />

      <ReviewBody>
        <ReviewFacts>
          <ReviewFact label="Request type" value={request.typeLabel} />
          <ReviewFact
            label="For"
            value={
              request.subjectEmployeeId && canOpenProfile ? (
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-left font-extrabold text-emp-accent underline-offset-2 hover:underline"
                  onClick={onOpenSubjectProfile}
                >
                  {subjectName}
                </button>
              ) : (
                subjectName
              )
            }
            hint={
              onBehalf
                ? `Raised by ${requesterName}`
                : partyEmployeeId(request.subject, request.subjectEmployeeId) || undefined
            }
          />
          <ReviewFact
            label="Requested on"
            value={request.requestedDate ? formatRequestDate(request.requestedDate) : "—"}
          />
        </ReviewFacts>

        <ReviewSection title="What they asked for">
          {request.change ? (
            <div className="overflow-hidden">
              <div className="grid grid-cols-[minmax(6rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] bg-emp-raised px-[0.9rem] py-[0.45rem] text-[0.85rem] font-extrabold uppercase tracking-[0.05em] text-emp-muted">
                <span>Field</span>
                <span>Now</span>
                <span>Requested</span>
              </div>
              <div className="grid grid-cols-[minmax(6rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 px-[0.9rem] py-[0.8rem]">
                <span className="font-extrabold text-emp-text">{request.change.fieldLabel}</span>
                <span className="text-emp-muted [overflow-wrap:anywhere]">{request.change.oldValue}</span>
                <span className="font-extrabold text-emp-accent [overflow-wrap:anywhere]">
                  {request.change.newValue}
                </span>
              </div>
            </div>
          ) : (
            <p className="m-0 text-[1.05rem] font-extrabold leading-snug text-emp-text [overflow-wrap:anywhere]">
              {request.description}
            </p>
          )}
          {showApplyHint ? (
            <p className="m-0 text-[0.85rem] text-emp-muted">
              Open this profile to apply the change.
            </p>
          ) : null}
        </ReviewSection>

        {note ? (
          <ReviewSection title={`Note from ${firstName}`}>
            <ReviewQuote>{note}</ReviewQuote>
          </ReviewSection>
        ) : null}

        {request.hasAttachment ? (
          <ReviewSection title="Supporting document">
            <div className="flex flex-wrap items-center gap-[0.55rem] border-0 border-y border-solid border-emp-line py-[0.6rem]">
              <span className="min-w-0 flex-1 truncate font-semibold text-emp-text">
                {(request.attachmentFileName ?? "").trim() || "Document"}
              </span>
              {attachmentActions ? (
                <>
                  <AppButton
                    variant="secondary"
                    size="compact"
                    aria-label="View supporting document"
                    disabled={attachmentActions.busy}
                    onClick={attachmentActions.onView}
                  >
                    View
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    size="compact"
                    aria-label="Download supporting document"
                    disabled={attachmentActions.busy}
                    onClick={attachmentActions.onDownload}
                  >
                    Download
                  </AppButton>
                </>
              ) : null}
            </div>
            {attachmentActions?.error ? (
              <AppNotice tone="error">{attachmentActions.error}</AppNotice>
            ) : null}
          </ReviewSection>
        ) : null}

        {request.decidedByName || request.decisionNote ? (
          <ReviewNote tone={request.statusLabel === "Rejected" ? "warning" : "info"}>
            <strong className="block text-[0.85rem]">
              {request.statusLabel}
              {request.decidedByName ? ` by ${request.decidedByName}` : ""}
              {request.decidedDate ? ` on ${formatRequestDate(request.decidedDate)}` : ""}
            </strong>
            {request.decisionNote ? (
              <span className="mt-[0.2rem] block whitespace-pre-line [overflow-wrap:anywhere]">
                {request.decisionNote}
              </span>
            ) : null}
          </ReviewNote>
        ) : null}
      </ReviewBody>

      {actions ? <ReviewActionBar hint={actionHint}>{actions}</ReviewActionBar> : null}
    </div>
  );
}
