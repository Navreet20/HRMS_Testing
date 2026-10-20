import { useId, useMemo, type FormEvent } from "react";

import {
  AppDataTable,
  StatusBadge,
  type AppDataTableColumn,
} from "../../../shared/ui";
import {
  CatalogButton,
  CatalogDialogFooter,
  CatalogModal,
} from "../../org/catalogFields";
import { catalogUi } from "@/shared/ui/catalogUi";
import { ACCESS_LEVEL_LABELS } from "../constants";
import {
  countDistinctModules,
  formatGrantedOn,
  formatModuleCode,
  grantedByLabel,
  groupGrantsByModule,
} from "../selectors";
import type { AccessGrant, EmployeeSearchHit } from "../types";
import { EmployeeSubjectHeader } from "./EmployeeSubjectHeader";

interface AccessRow {
  readonly grant: AccessGrant;
  readonly moduleId: number;
  readonly moduleName: string;
}

interface ViewAccessDialogProps {
  readonly employee: EmployeeSearchHit;
  readonly grants: readonly AccessGrant[];
  readonly canEdit: boolean;
  readonly allowRevoke?: boolean;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onEdit?: () => void;
  readonly onRevoke?: (grant: AccessGrant) => void;
}

export function ViewAccessDialog({
  employee,
  grants,
  canEdit,
  allowRevoke = false,
  busy = false,
  onClose,
  onEdit,
  onRevoke,
}: ViewAccessDialogProps) {
  const titleId = useId();
  const grouped = useMemo(() => groupGrantsByModule(grants), [grants]);
  const moduleCount = countDistinctModules(grants);
  const summary = `${moduleCount} module${moduleCount === 1 ? "" : "s"} · ${grants.length} access row${grants.length === 1 ? "" : "s"}`;

  const rows = useMemo(
    () =>
      grouped.flatMap((group) =>
        group.grants.map((grant) => ({
          grant,
          moduleId: group.moduleId,
          moduleName: group.moduleName,
        })),
      ),
    [grouped],
  );

  const columns = useMemo<AppDataTableColumn<AccessRow>[]>(
    () => [
      {
        id: "access",
        header: "Access",
        cell: ({ grant }) => grant.submoduleName ?? "Module",
      },
      {
        id: "accessLevel",
        header: "Access level",
        cell: ({ grant }) => (
          <StatusBadge
            label={ACCESS_LEVEL_LABELS[grant.accessLevel]}
            tone={grant.accessLevel === "full_access" ? "success" : "neutral"}
          />
        ),
      },
      {
        id: "grantedBy",
        header: "Granted by",
        cell: ({ grant }) => grantedByLabel(grant),
      },
      {
        id: "grantedOn",
        header: "Granted on",
        cell: ({ grant }) => formatGrantedOn(grant.grantedDate),
      },
      ...(allowRevoke
        ? [
            {
              id: "actions",
              header: "Actions",
              cell: ({ grant }: AccessRow) =>
                onRevoke ? (
                  <CatalogButton
                    variant="danger"
                    disabled={busy}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRevoke(grant);
                    }}
                  >
                    Revoke
                  </CatalogButton>
                ) : null,
              cellClassName: catalogUi.cellActions,
            },
          ]
        : []),
    ],
    [allowRevoke, busy, onRevoke],
  );

  return (
    <CatalogModal
      title="View access"
      titleId={titleId}
      brand="COGNIVANCE"
      eyebrow="RBAC · View access"
      size="wide"
      accentTop
      onClose={onClose}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onClose();
      }}
      bodyClassName="grid content-start gap-4"
      footer={
        <CatalogDialogFooter>
          <CatalogButton variant="ghost" onClick={onClose}>
            Close
          </CatalogButton>
          {canEdit && onEdit ? (
            <CatalogButton
              onClick={(event) => {
                event.preventDefault();
                onEdit();
              }}
            >
              Edit access
            </CatalogButton>
          ) : null}
        </CatalogDialogFooter>
      }
    >
      <EmployeeSubjectHeader employee={employee} summary={summary} />

      {grants.length === 0 ? (
        <p className={catalogUi.empty}>No active grants.</p>
      ) : (
        <AppDataTable
          ariaLabel="Access grants"
          data={rows}
          columns={columns}
          getRowId={(row) => String(row.grant.grantId)}
          groupHeader={{
            key: (row) => String(row.moduleId),
            render: (row) => `${row.moduleName} · ${formatModuleCode(row.moduleId)}`,
          }}
        />
      )}
    </CatalogModal>
  );
}
