"use client";

import {
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import { validateProjectDraft } from "../selectors";
import type {
  ClientOption,
  EmployeeOption,
  ProjectDraftError,
  ProjectDraft,
  ProjectRecord,
} from "../types";
import {
  buildProjectDraft,
  formFromProject,
  INITIAL_PROJECT_FORM,
  type ProjectFormState,
} from "../projectFormState";
import { ProjectFormFields } from "./ProjectFormFields";

export type CreateProjectSaveIntent = "exit" | "allocate";

interface CreateProjectDialogProps {
  readonly clients: readonly ClientOption[];
  readonly employees: readonly EmployeeOption[];
  readonly existingProjects: readonly ProjectRecord[];
  /** Backend master list from GET /projects/meta. */
  readonly projectTypeOptions: readonly string[];
  readonly projectTypesLoading?: boolean;
  /** When set, dialog opens in edit/view mode with this project prefilled. */
  readonly project?: ProjectRecord | null;
  /** Prefill client when creating from a client card. */
  readonly initialClientId?: string | null;
  readonly readOnly?: boolean;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onSave: (
    draft: ProjectDraft,
    intent: CreateProjectSaveIntent,
  ) => void | Promise<void>;
}

export function CreateProjectDialog({
  clients,
  employees,
  existingProjects,
  projectTypeOptions,
  projectTypesLoading = false,
  project = null,
  initialClientId = null,
  readOnly = false,
  busy = false,
  onClose,
  onSave,
}: CreateProjectDialogProps) {
  const titleId = useId();
  const saveIntentRef = useRef<CreateProjectSaveIntent>("exit");
  const [form, setForm] = useState<ProjectFormState>(() => {
    if (project) {
      return formFromProject(project);
    }
    if (initialClientId) {
      return { ...INITIAL_PROJECT_FORM, clientId: initialClientId };
    }
    return INITIAL_PROJECT_FORM;
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(project);
  const excludeProjectId = project?.id;

  function mapFieldErrors(
    errors: readonly ProjectDraftError[],
  ): Record<string, string> {
    const byField: Record<string, string> = {};
    for (const row of errors) {
      if (!byField[row.field]) {
        byField[row.field] = row.message;
      }
    }
    return byField;
  }

  function patchForm(partial: Partial<ProjectFormState>) {
    setForm((current) => ({ ...current, ...partial }));
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(partial)) {
        delete next[key];
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting) {
      return;
    }
    const draft = buildProjectDraft(form, clients);
    const errors = validateProjectDraft(
      draft,
      existingProjects,
      excludeProjectId,
      {
        clients,
        employees,
      },
    );
    if (errors.length > 0) {
      setFieldErrors(mapFieldErrors(errors));
      setError(null);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      await onSave(draft, saveIntentRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = busy || submitting || readOnly;

  return (
    <CatalogModal
      title={isEditing ? "Edit Project" : "Create New Project"}
      titleId={titleId}
      size="wide"
      brand="EAOVA"
      eyebrow={isEditing ? "Projects · edit" : "Projects · add"}
      backdrop="create"
      accentTop
      onClose={onClose}
      onSubmit={handleSubmit}
      bodyClassName="!block"
      footer={
        <CatalogDialogFooter className="flex-wrap justify-end gap-2">
          <CatalogButton
            type="button"
            variant="ghost"
            disabled={busy || submitting}
            onClick={onClose}
          >
            {readOnly ? "Close" : "Cancel"}
          </CatalogButton>
          {readOnly ? null : (
            <>
              <CatalogButton
                type="submit"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  saveIntentRef.current = "exit";
                }}
              >
                {disabled ? "Saving…" : "Save Project & Exit"}
              </CatalogButton>
              <CatalogButton
                type="submit"
                variant="primary"
                disabled={disabled}
                onClick={() => {
                  saveIntentRef.current = "allocate";
                }}
              >
                {disabled
                  ? "Saving…"
                  : "Save & Allocate Resources →"}
              </CatalogButton>
            </>
          )}
        </CatalogDialogFooter>
      }
    >
      {error ? (
        <p className="m-0 mb-4 text-[0.85rem] text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ProjectFormFields
        form={form}
        clients={clients}
        employees={employees}
        projectTypeOptions={projectTypeOptions}
        projectTypesLoading={projectTypesLoading}
        fieldErrors={fieldErrors}
        disabled={disabled}
        onChange={patchForm}
      />
    </CatalogModal>
  );
}
