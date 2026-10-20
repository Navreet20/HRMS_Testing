import { useMemo } from "react";

import {
  AppButton,
  AppDataTable,
  StatusBadge,
  type AppDataTableColumn,
} from "../../../shared/ui";
import { catalogUi } from "@/shared/ui/catalogUi";
import { formatModuleCode } from "../selectors";
import type { RbacModule } from "../types";

interface RbacModulesTableProps {
  readonly rows: readonly RbacModule[];
  readonly emptyLabel: string;
  readonly onAssign: (module: RbacModule) => void;
}

export function RbacModulesTable({
  rows,
  emptyLabel,
  onAssign,
}: RbacModulesTableProps) {
  const visible = useMemo(
    () => rows.filter((m) => m.moduleName.trim().toLowerCase() !== "dashboard"),
    [rows],
  );

  const columns = useMemo<AppDataTableColumn<RbacModule>[]>(
    () => [
      {
        id: "moduleName",
        header: "Module name",
        cell: (mod) => mod.moduleName,
        cellClassName: "font-semibold text-emp-text",
      },
      {
        id: "moduleId",
        header: "Module ID",
        cell: (mod) => formatModuleCode(mod.moduleId),
        cellClassName: catalogUi.cellMuted,
      },
      {
        id: "status",
        header: "Status",
        cell: (mod) => (
          <StatusBadge
            label={mod.status === "Active" ? "Active" : mod.status}
            tone={mod.status === "Active" ? "success" : "neutral"}
          />
        ),
      },
      {
        id: "submodules",
        header: "No. of submodules",
        cell: (mod) => {
          const subCount = mod.hasSubmodules ? mod.submodules.length : 0;
          return mod.hasSubmodules
            ? `${subCount} submodule${subCount === 1 ? "" : "s"}`
            : "—";
        },
        cellClassName: catalogUi.cellMuted,
      },
      {
        id: "assign",
        header: "Assign",
        align: "end",
        cell: (mod) => (
          <AppButton size="compact" onClick={() => onAssign(mod)}>
            + Assign
          </AppButton>
        ),
        cellClassName: catalogUi.cellActions,
      },
    ],
    [onAssign],
  );

  return (
    <AppDataTable
      ariaLabel="Modules"
      data={visible}
      columns={columns}
      getRowId={(mod) => String(mod.moduleId)}
      emptyText={<p className={catalogUi.emptyLead}>{emptyLabel}</p>}
    />
  );
}
