"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { userFacingApiError } from "@/shared/http";
import {
  AppButton,
  AppDetailSplit,
  AppDateField,
  AppNotice,
  AppSelect,
  AppTextField,
  ConfirmDialogShell,
  DialogShell,
} from "@/shared/ui";
import type { LeaveRequestsGateway } from "../gateway";
import {
  EMPTY_LEAVE_DRAFT,
  daysLeft,
  draftFromRequest,
  leaveDayTotals,
  leaveInputFromDraft,
  leaveTypeOptionMeta,
  normalizePreview,
  normalizeRequest,
  shortfallMessage,
  sortByLeaveTypeOrder,
  validateLeaveDraft,
} from "../selectors";
import { RequestDaysSummary } from "./RequestDaysSummary";
import type {
  HalfDayChoices,
  HalfPart,
  LeaveBalance,
  LeavePreview,
  LeaveRequestDraft,
  LeaveRequestRecord,
} from "../types";

export interface LeaveRequestFormProps {
  readonly gateway: LeaveRequestsGateway;
  readonly balances: readonly LeaveBalance[];
  /** Recalled request being edited; omit for a new request. */
  readonly request?: LeaveRequestRecord | null;
  readonly currentYear: number;
  /** Holiday names by ISO date, to label the days that don't count. */
  readonly holidayNames?: ReadonlyMap<string, string>;
  readonly onSubmitted: (request: LeaveRequestRecord | null) => void;
  /** Recall edit screen only. */
  readonly onDeleted?: () => void;
}

type PreviewState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly preview: LeavePreview }
  | { readonly kind: "error"; readonly message: string };

/** The half-day part of a preview or submit body. */
function halfDayFields(halfDays: HalfDayChoices) {
  return {
    halfDays: [...halfDays.keys()],
    halfDayParts: Object.fromEntries(halfDays),
  };
}

const fieldErrorClass = "m-0 text-[0.85rem] leading-[1.35] text-emp-critical";
const hintClass = "m-0 text-[0.85rem] leading-normal text-emp-muted";
const NO_HOLIDAYS: ReadonlyMap<string, string> = new Map();

export function LeaveRequestForm({
  gateway,
  balances,
  request = null,
  currentYear,
  holidayNames = NO_HOLIDAYS,
  onSubmitted,
  onDeleted,
}: LeaveRequestFormProps) {
  const editing = request !== null;
  const [draft, setDraft] = useState<LeaveRequestDraft>(() =>
    request ? draftFromRequest(request) : EMPTY_LEAVE_DRAFT,
  );
  const [halfDays, setHalfDays] = useState<HalfDayChoices>(
    () =>
      new Map(
        request?.days.flatMap((day): [string, HalfPart][] =>
          day.isHalfDay ? [[day.leaveDate, day.halfPart ?? "first"]] : [],
        ) ?? [],
      ),
  );
  const [previewState, setPreviewState] = useState<PreviewState>({ kind: "idle" });
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const previewSeq = useRef(0);

  const typeOptions = useMemo(
    () =>
      sortByLeaveTypeOrder(
        balances.filter(
          (balance) =>
            balance.selectable || balance.leaveTypeId === draft.leaveTypeId,
        ),
      ).map((balance) => ({
        value: balance.leaveTypeId,
        label: balance.leaveTypeName,
        meta: leaveTypeOptionMeta(balance),
        hint: balance.description || undefined,
      })),
    [balances, draft.leaveTypeId],
  );
  const selectedType =
    balances.find((balance) => balance.leaveTypeId === draft.leaveTypeId) ?? null;

  const errors = validateLeaveDraft(draft);
  const visibleErrors = showErrors ? errors : {};
  const rangeReady =
    Boolean(draft.leaveTypeId && draft.fromDate && draft.toDate) &&
    !errors.toDate;

  // The half days the server last looked at, so a change of halves re-checks
  // for a clash on the same half without reloading the whole panel.
  const halfDaysRef = useRef(halfDays);
  halfDaysRef.current = halfDays;
  const checkedHalfDays = useRef(halfDays);

  useEffect(() => {
    if (!rangeReady) {
      setPreviewState({ kind: "idle" });
      return;
    }
    checkedHalfDays.current = halfDaysRef.current;
    const seq = ++previewSeq.current;
    setPreviewState({ kind: "loading" });
    gateway
      .preview({
        leaveTypeId: draft.leaveTypeId,
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        ...halfDayFields(halfDaysRef.current),
        reason: null,
        excludeRequestId: request?.leaveRequestId,
      })
      .then((raw) => {
        if (seq === previewSeq.current) {
          setPreviewState({ kind: "ready", preview: normalizePreview(raw) });
        }
      })
      .catch((error: unknown) => {
        if (seq === previewSeq.current) {
          setPreviewState({ kind: "error", message: userFacingApiError(error) });
        }
      });
  }, [
    gateway,
    rangeReady,
    draft.leaveTypeId,
    draft.fromDate,
    draft.toDate,
    request?.leaveRequestId,
  ]);

  const preview = previewState.kind === "ready" ? previewState.preview : null;
  const previewReady = preview !== null;

  useEffect(() => {
    if (!previewReady || checkedHalfDays.current === halfDays) {
      return;
    }
    checkedHalfDays.current = halfDays;
    const seq = ++previewSeq.current;
    gateway
      .preview({
        leaveTypeId: draft.leaveTypeId,
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        ...halfDayFields(halfDays),
        reason: null,
        excludeRequestId: request?.leaveRequestId,
      })
      .then((raw) => {
        if (seq === previewSeq.current) {
          setPreviewState({ kind: "ready", preview: normalizePreview(raw) });
        }
      })
      .catch(() => undefined);
  }, [gateway, halfDays, previewReady, draft.leaveTypeId, draft.fromDate, draft.toDate, request?.leaveRequestId]);
  const totals = preview ? leaveDayTotals(preview, halfDays) : null;

  function update(field: keyof LeaveRequestDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setActionError(null);
  }

  function chooseHalfDay(leaveDate: string, choice: HalfPart | "full") {
    setHalfDays((current) => {
      const next = new Map(current);
      if (choice === "full") {
        next.delete(leaveDate);
      } else {
        next.set(leaveDate, choice);
      }
      return next;
    });
  }

  async function send() {
    if (!preview) {
      return;
    }
    setBusy(true);
    setActionError(null);
    const input = leaveInputFromDraft(draft, preview, halfDays);
    try {
      const saved = request
        ? await gateway.resubmit(request.leaveRequestId, input)
        : await gateway.submit(input);
      if (!request) {
        setDraft(EMPTY_LEAVE_DRAFT);
        setHalfDays(new Map());
        setShowErrors(false);
      }
      onSubmitted(normalizeRequest(saved));
    } catch (error) {
      setActionError(userFacingApiError(error));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit() {
    setShowErrors(true);
    if (Object.keys(errors).length > 0 || !preview) {
      return;
    }
    if (preview.days.length === 0) {
      setActionError(
        "The selected dates have no working days (only weekends or holidays).",
      );
      return;
    }
    if (preview.overlapMessage) {
      setActionError(preview.overlapMessage);
      return;
    }
    const message = shortfallMessage(
      preview,
      halfDays,
      selectedType?.leaveTypeName ?? "leave",
    );
    if (message) {
      setShortfall(message);
      return;
    }
    void send();
  }

  async function handleDelete() {
    if (!request) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await gateway.deleteRecalled(request.leaveRequestId);
      setConfirmDelete(false);
      onDeleted?.();
    } catch (error) {
      setActionError(userFacingApiError(error));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  const jan1 = `${currentYear}-01-01`;

  return (
    <div className="grid gap-4">
      {/* Days panel slides in once a leave type and both dates are picked. */}
      <AppDetailSplit
        open={rangeReady}
        pane={
          <RequestDaysSummary
            state={previewState}
            fromDate={draft.fromDate}
            toDate={draft.toDate}
            halfDays={halfDays}
            onChooseHalfDay={chooseHalfDay}
            holidayNames={holidayNames}
            total={totals?.total ?? 0}
            leaveTypeName={selectedType && !selectedType.unlimited ? selectedType.leaveTypeName : null}
            daysLeftBefore={selectedType && !selectedType.unlimited ? daysLeft(selectedType) : null}
          />
        }
      >
        <div className="grid content-start gap-4">
          <div className="grid content-start gap-1">
            <AppSelect
              id="leave-request-type"
              label="Leave type"
              value={draft.leaveTypeId}
              options={typeOptions}
              placeholder="Select leave type"
              required
              onChange={(value) => update("leaveTypeId", value)}
            />
            {visibleErrors.leaveTypeId ? (
              <p className={fieldErrorClass}>{visibleErrors.leaveTypeId}</p>
            ) : selectedType ? (
              <p className={hintClass}>
                {selectedType.unlimited
                  ? "No day limit."
                  : `${leaveTypeOptionMeta(selectedType)} this year.`}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 min-[30rem]:grid-cols-2">
            <div className="grid content-start gap-1">
              <AppDateField
                id="leave-request-from"
                label="From date"
                value={draft.fromDate}
                minDate={jan1}
                invalid={Boolean(visibleErrors.fromDate)}
                onChange={(value) => update("fromDate", value)}
              />
              {visibleErrors.fromDate ? (
                <p className={fieldErrorClass}>{visibleErrors.fromDate}</p>
              ) : null}
            </div>
            <div className="grid content-start gap-1">
              <AppDateField
                id="leave-request-to"
                label="To date"
                value={draft.toDate}
                minDate={draft.fromDate || jan1}
                invalid={Boolean(visibleErrors.toDate)}
                onChange={(value) => update("toDate", value)}
              />
              {visibleErrors.toDate ? (
                <p className={fieldErrorClass}>{visibleErrors.toDate}</p>
              ) : null}
            </div>
          </div>
          <AppTextField
            id="leave-request-reason"
            label="Reason (optional)"
            placeholder="For example: family trip"
            value={draft.reason}
            onChange={(value) => update("reason", value)}
            multiline
            rows={3}
            maxLength={500}
            inputClassName="!text-[0.9rem] leading-normal"
          />
        </div>
      </AppDetailSplit>

      {actionError ? <AppNotice tone="error">{actionError}</AppNotice> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {editing ? (
          <AppButton
            variant="danger"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete request
          </AppButton>
        ) : null}
        <AppButton
          disabled={busy || previewState.kind === "loading" || Boolean(preview?.overlapMessage)}
          onClick={handleSubmit}
        >
          {busy ? "Submitting…" : editing ? "Resubmit" : "Submit request"}
        </AppButton>
      </div>

      <DialogShell
        open={shortfall !== null}
        title="Not enough leave balance"
        onClose={() => setShortfall(null)}
        footer={
          <AppButton onClick={() => setShortfall(null)} data-dialog-initial-focus>
            Adjust request
          </AppButton>
        }
      >
        <p className="m-0 text-[0.88rem] leading-normal text-emp-text">
          {shortfall}
        </p>
      </DialogShell>

      <ConfirmDialogShell
        open={confirmDelete}
        title="Delete leave request"
        description="This removes the request completely. It will not appear in your history."
        confirmLabel="Delete request"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
