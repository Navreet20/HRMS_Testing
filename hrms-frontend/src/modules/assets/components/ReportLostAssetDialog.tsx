"use client";

import { TriangleAlert } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { AppDateField, AppSelect, localIsoToday } from "@/shared/ui";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import { LOST_REASON_SELECT_OPTIONS } from "../constants";
import type { AssetRecord } from "../types";

export interface ReportLostBody {
  readonly reason: string;
  readonly lostDate: string;
  readonly notes?: string;
}

interface ReportLostAssetDialogProps {
  readonly asset: AssetRecord;
  readonly busy?: boolean;
  readonly error?: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: (body: ReportLostBody) => void;
}

/** Confirm that an asset is lost or stolen, with when and why. */
export function ReportLostAssetDialog({
  asset,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: ReportLostAssetDialogProps) {
  const titleId = useId();
  const [reason, setReason] = useState("Lost");
  const [lostDate, setLostDate] = useState(() => localIsoToday());
  const [notes, setNotes] = useState("");
  const holder = asset.assignedEmployeeName?.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !reason || !lostDate) {
      return;
    }
    const trimmed = notes.trim();
    onConfirm({ reason, lostDate, ...(trimmed ? { notes: trimmed } : {}) });
  }

  return (
    <CatalogModal
      title={`Report ${asset.assetId} as lost?`}
      titleId={titleId}
      size="narrow"
      icon={
        <TriangleAlert
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-critical"
          aria-hidden
        />
      }
      onClose={onCancel}
      onSubmit={handleSubmit}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </CatalogButton>
          <CatalogButton
            variant="danger"
            type="submit"
            disabled={busy || !reason || !lostDate}
          >
            {busy ? "Reporting…" : "Report lost"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <p className="m-0 text-[0.92rem] leading-relaxed text-emp-text">
        {holder ? (
          <>
            This closes the assignment to <strong>{holder}</strong> and marks
            the asset Lost.{" "}
          </>
        ) : (
          <>This marks the asset Lost. </>
        )}
        It can no longer be assigned. {holder ? `${holder} and the` : "The"}{" "}
        asset managers are emailed, and the activity log records it.
      </p>

      <label className={ui.field}>
        <FieldLabel required>What happened</FieldLabel>
        <AppSelect
          required
          value={reason}
          aria-label="What happened"
          options={LOST_REASON_SELECT_OPTIONS}
          onChange={setReason}
        />
      </label>

      <label className={ui.field}>
        <FieldLabel required>Date</FieldLabel>
        <AppDateField
          value={lostDate}
          aria-label="Date lost"
          maxDate={localIsoToday()}
          onChange={setLostDate}
        />
      </label>

      <label className={ui.field}>
        <FieldLabel optional>Notes</FieldLabel>
        <textarea
          className={cx(CATALOG_CONTROL, "min-h-[5.5rem] resize-y py-2")}
          value={notes}
          maxLength={255}
          rows={3}
          aria-label="Notes"
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {error ? (
        <p className="m-0 text-[0.85rem] text-emp-critical" role="alert">
          {error}
        </p>
      ) : null}
    </CatalogModal>
  );
}
