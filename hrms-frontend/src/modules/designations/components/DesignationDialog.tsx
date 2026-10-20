"use client";

import { IdCard } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  DESIGNATION_JOB_FAMILIES,
  validateDesignationDraft,
} from "@/modules/org";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { AppSelect } from "@/shared/ui";
import type { DesignationDraft, DesignationRecord } from "../types";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

interface DesignationDialogProps {
  readonly mode: "create" | "edit";
  readonly designation?: DesignationRecord | null;
  readonly onClose: () => void;
  readonly onSave: (draft: DesignationDraft) => void;
}

export function DesignationDialog({
  mode,
  designation,
  onClose,
  onSave,
}: DesignationDialogProps) {
  const titleId = useId();
  const [title, setTitle] = useState(designation?.title ?? "");
  const [jobFamily, setJobFamily] = useState(designation?.jobFamily ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const draft: DesignationDraft = {
      title,
      jobFamily,
    };
    const invalid = validateDesignationDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    onSave(draft);
  }

  const heading = mode === "edit" ? "Edit designation" : "Create designation";
  const subtitle =
    mode === "edit"
      ? "Update a job title that can be assigned to employees."
      : "Add a job title that can be assigned to employees.";

  return (
    <CatalogModal
      title={heading}
      titleId={titleId}
      size="narrow"
      accentTop
      icon={
        <IdCard
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-accent"
          aria-hidden
        />
      }
      subtitle={subtitle}
      onClose={onClose}
      onSubmit={handleSubmit}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onClose}>
            Cancel
          </CatalogButton>
          <CatalogButton type="submit">
            {mode === "edit" ? "Save" : "Create"}
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      {error ? (
        <p className={`${ui.error} mb-4`} role="alert">
          {error}
        </p>
      ) : null}
      <label className={ui.field}>
        <FieldLabel required>Job title</FieldLabel>
        <CatalogTextInput
          required
          value={title}
          placeholder="Senior Software Engineer"
          aria-label="Job title"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className={ui.field}>
        <FieldLabel required>Job family</FieldLabel>
        <AppSelect
          required
          value={jobFamily}
          aria-label="Job family"
          placeholder="Select job family"
          options={DESIGNATION_JOB_FAMILIES.map((family) => ({
            value: family,
            label: family,
          }))}
          onChange={setJobFamily}
        />
      </label>
    </CatalogModal>
  );
}
