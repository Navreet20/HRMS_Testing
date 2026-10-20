"use client";

import { Undo2 } from "lucide-react";
import { useId, type FormEvent } from "react";

import { AppSelect } from "@/shared/ui";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import {
  CONDITION_SELECT_OPTIONS,
  RETURN_REASON_SELECT_OPTIONS,
} from "../constants";
import { assetStatusAfterReturn } from "../selectors";
import type { AssetRecord } from "../types";

interface ReturnAssetDialogProps {
  readonly asset: AssetRecord;
  readonly reason: string;
  readonly otherReason: string;
  readonly condition: string;
  readonly notes: string;
  readonly busy: boolean;
  readonly onReasonChange: (reason: string) => void;
  readonly onOtherReasonChange: (other: string) => void;
  readonly onConditionChange: (condition: string) => void;
  readonly onNotesChange: (notes: string) => void;
  readonly onClose: () => void;
  readonly onReturn: () => void;
}

export function ReturnAssetDialog({
  asset,
  reason,
  otherReason,
  condition,
  notes,
  busy,
  onReasonChange,
  onOtherReasonChange,
  onConditionChange,
  onNotesChange,
  onClose,
  onReturn,
}: ReturnAssetDialogProps) {
  const titleId = useId();
  const canSubmit =
    Boolean(reason) &&
    (reason !== "Other" || Boolean(otherReason.trim())) &&
    Boolean(condition);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !canSubmit) {
      return;
    }
    onReturn();
  }

  return (
    <CatalogModal
      title="Return asset"
      titleId={titleId}
      size="narrow"
      icon={
        <Undo2
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-accent"
          aria-hidden
        />
      }
      subtitle={`${asset.assetId} · ${asset.assignedEmployeeName ?? "—"}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </CatalogButton>
          <CatalogButton type="submit" disabled={busy || !canSubmit}>
            Return
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <label className={ui.field}>
        <FieldLabel required>Reason</FieldLabel>
        <AppSelect
          required
          value={reason}
          placeholder="Select reason"
          aria-label="Reason"
          options={RETURN_REASON_SELECT_OPTIONS}
          onChange={onReasonChange}
        />
        {assetStatusAfterReturn(reason) === "Under Repair" ? (
          <p className="mb-0 mt-1 text-[0.85rem] text-emp-muted">
            This asset will go to Under Repair
          </p>
        ) : null}
      </label>

      {reason === "Other" ? (
        <label className={ui.field}>
          <FieldLabel required>Other reason</FieldLabel>
          <CatalogTextInput
            value={otherReason}
            onChange={(event) => onOtherReasonChange(event.target.value)}
            required
            aria-label="Other reason"
          />
        </label>
      ) : null}

      <label className={ui.field}>
        <FieldLabel required>Condition at return</FieldLabel>
        <AppSelect
          required
          value={condition}
          placeholder="Select condition"
          aria-label="Condition at return"
          options={CONDITION_SELECT_OPTIONS}
          onChange={onConditionChange}
        />
      </label>

      <label className={ui.field}>
        <FieldLabel optional>Notes</FieldLabel>
        <textarea
          className={cx(CATALOG_CONTROL, "min-h-[5.5rem] resize-y py-2")}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={3}
          aria-label="Notes"
        />
      </label>
    </CatalogModal>
  );
}
