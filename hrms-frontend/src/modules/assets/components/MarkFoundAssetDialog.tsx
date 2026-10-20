"use client";

import { PackageCheck } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { AppSelect } from "@/shared/ui";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import {
  FOUND_CONDITIONS,
  FOUND_CONDITION_SELECT_OPTIONS,
} from "../constants";
import type { AssetRecord } from "../types";

export interface MarkFoundBody {
  readonly condition: string;
  readonly notes?: string;
}

interface MarkFoundAssetDialogProps {
  readonly asset: AssetRecord;
  readonly busy?: boolean;
  readonly error?: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: (body: MarkFoundBody) => void;
}

/** A lost asset turned up: its condition decides where it goes next. */
export function MarkFoundAssetDialog({
  asset,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: MarkFoundAssetDialogProps) {
  const titleId = useId();
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const next = FOUND_CONDITIONS.find((item) => item.value === condition)?.next;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !condition) {
      return;
    }
    const trimmed = notes.trim();
    onConfirm({ condition, ...(trimmed ? { notes: trimmed } : {}) });
  }

  return (
    <CatalogModal
      title={`Mark ${asset.assetId} as found`}
      titleId={titleId}
      size="narrow"
      icon={
        <PackageCheck
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-accent"
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
          <CatalogButton type="submit" disabled={busy || !condition}>
            {busy ? "Saving…" : "Mark found"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <label className={ui.field}>
        <FieldLabel required>Condition it was found in</FieldLabel>
        <AppSelect
          required
          value={condition}
          placeholder="Select condition"
          aria-label="Condition it was found in"
          options={FOUND_CONDITION_SELECT_OPTIONS}
          onChange={setCondition}
        />
        {next ? (
          <p className="mb-0 mt-1 text-[0.85rem] text-emp-muted">
            This asset will go to {next}
          </p>
        ) : null}
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
