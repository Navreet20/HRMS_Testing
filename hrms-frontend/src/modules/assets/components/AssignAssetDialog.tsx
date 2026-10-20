"use client";

import { UserPlus } from "lucide-react";
import { useId, type FormEvent } from "react";

import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "@/modules/org/catalogFields";
import { EmployeesSearchCombobox } from "@/modules/employees/components/EmployeesSearchCombobox";
import type { AssetRecord } from "../types";

interface AssignAssetDialogProps {
  readonly asset: AssetRecord;
  readonly employeeId: string;
  readonly employeeOptions: readonly { value: string; label: string }[];
  /** Asks the host to search the server for people (null when the picker closes). */
  readonly onEmployeeSearch?: (query: string | null) => void;
  readonly employeesLoading?: boolean;
  readonly busy: boolean;
  readonly onEmployeeChange: (employeeId: string) => void;
  readonly onClose: () => void;
  readonly onAssign: () => void;
}

export function AssignAssetDialog({
  asset,
  employeeId,
  employeeOptions,
  onEmployeeSearch,
  employeesLoading = false,
  busy,
  onEmployeeChange,
  onClose,
  onAssign,
}: AssignAssetDialogProps) {
  const titleId = useId();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !employeeId) {
      return;
    }
    onAssign();
  }

  return (
    <CatalogModal
      title="Assign asset"
      titleId={titleId}
      size="narrow"
      icon={
        <UserPlus
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-emp-accent"
          aria-hidden
        />
      }
      subtitle={`${asset.assetId} · ${asset.categoryName ?? "—"}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </CatalogButton>
          <CatalogButton type="submit" disabled={busy || !employeeId}>
            Assign
          </CatalogButton>
        </CatalogDialogFooter>
      }
    >
      <EmployeesSearchCombobox
        value={employeeId}
        options={employeeOptions}
        serverFiltered={Boolean(onEmployeeSearch)}
        loading={employeesLoading}
        onQueryChange={onEmployeeSearch}
        onOpenChange={(open) => {
          if (!open) {
            onEmployeeSearch?.(null);
          }
        }}
        onChange={onEmployeeChange}
        allowEmpty={false}
        requireQueryToShowResults
        placeholder="Search active employees"
        aria-label="Employee to assign"
      />
    </CatalogModal>
  );
}
