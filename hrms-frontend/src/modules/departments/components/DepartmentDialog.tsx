import { useId, useMemo, useState, type FormEvent } from "react";

import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
  CatalogSearchSelect,
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { AppCheckbox } from "@/shared/ui";
import { selectableParentDepartments } from "../selectors";
import type { DepartmentDraft, DepartmentRecord } from "../types";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

export interface DepartmentHeadOption {
  readonly id: string;
  readonly displayName: string;
}

interface DepartmentDialogProps {
  readonly mode: "create" | "edit";
  readonly department?: DepartmentRecord | null;
  readonly departments: readonly DepartmentRecord[];
  readonly headOptions?: readonly DepartmentHeadOption[];
  readonly onClose: () => void;
  readonly onSave: (draft: DepartmentDraft) => void;
}

function indentedParentLabel(name: string, depth: number): string {
  if (depth <= 0) {
    return name;
  }
  return `${"\u00A0\u00A0".repeat(depth)}${name}`;
}

export function DepartmentDialog({
  mode,
  department,
  departments,
  headOptions = [],
  onClose,
  onSave,
}: DepartmentDialogProps) {
  const titleId = useId();
  const [name, setName] = useState(department?.name ?? "");
  const [isChildDepartment, setIsChildDepartment] = useState(
    Boolean(department?.parentId),
  );
  const [parentId, setParentId] = useState(department?.parentId ?? "");
  const [headId, setHeadId] = useState(department?.headId ?? "");
  const [error, setError] = useState<string | null>(null);

  const parentOptions = useMemo(() => {
    const rows = selectableParentDepartments(
      departments,
      mode === "edit" ? department?.id : null,
    );
    return rows.map((row) => ({
      value: row.id,
      label: indentedParentLabel(row.name, row.depth),
      searchText: row.name,
    }));
  }, [departments, department?.id, mode]);

  const headSelectOptions = useMemo(() => {
    const options = headOptions.map((row) => ({
      value: row.id,
      label: row.displayName,
      searchText: row.displayName,
    }));
    if (
      department?.headId &&
      !options.some((row) => row.value === department.headId)
    ) {
      options.unshift({
        value: department.headId,
        label: department.headName || "Current head",
        searchText: department.headName || department.headId,
      });
    }
    return options;
  }, [department, headOptions]);

  function handleChildToggle(checked: boolean) {
    setIsChildDepartment(checked);
    if (!checked) {
      setParentId("");
    }
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Department name is required.");
      return;
    }
    if (isChildDepartment && !parentId) {
      setError("Select a parent department for a child department.");
      return;
    }
    onSave({
      name: trimmed,
      parentId: isChildDepartment ? parentId : "",
      headId,
      status: department?.status ?? "Active",
    });
  }

  const title = mode === "edit" ? "Edit department" : "Create department";

  return (
    <CatalogModal
      title={title}
      titleId={titleId}
      size="wide"
      accentTop
      onClose={onClose}
      onSubmit={handleSubmit}
      bodyClassName="grid content-start gap-4 sm:grid-cols-2"
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
        <p className={`${ui.error} mb-0 sm:col-span-2`} role="alert">
          {error}
        </p>
      ) : null}

      <label className={ui.field}>
        <FieldLabel required>Department name</FieldLabel>
        <CatalogTextInput
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Department name"
        />
      </label>

      <div className={ui.field}>
        <FieldLabel optional>Head of department</FieldLabel>
        <CatalogSearchSelect
          value={headId}
          aria-label="Head of department"
          placeholder="Select employee"
          searchPlaceholder="Search employee"
          allowEmpty
          options={headSelectOptions}
          onChange={setHeadId}
        />
        <span className={ui.fieldHint}>
          Optional. Choose an active employee who leads this department.
        </span>
      </div>

      {isChildDepartment ? (
        <>
          <div className={ui.field}>
            <span className={ui.fieldLabel} aria-hidden="true">
              &nbsp;
            </span>
            <div className="flex min-h-[2.35rem] items-center">
              <AppCheckbox
                checked={isChildDepartment}
                label="Is it a child department"
                aria-label="Is it a child department"
                onChange={handleChildToggle}
              />
            </div>
            <span className={ui.fieldHint} aria-hidden="true">
              &nbsp;
            </span>
          </div>
          <div className={ui.field}>
            <FieldLabel required>Parent department</FieldLabel>
            <CatalogSearchSelect
              value={parentId}
              aria-label="Parent department"
              placeholder="Select parent department"
              searchPlaceholder="Search parent department"
              allowEmpty={false}
              required
              options={parentOptions}
              onChange={setParentId}
            />
            <span className={ui.fieldHint}>
              Required for child departments. Choose the parent this department
              nests under.
            </span>
          </div>
        </>
      ) : (
        <div className="flex min-h-[2.35rem] items-center sm:col-span-2">
          <AppCheckbox
            checked={isChildDepartment}
            label="Is it a child department"
            aria-label="Is it a child department"
            onChange={handleChildToggle}
          />
        </div>
      )}
    </CatalogModal>
  );
}
