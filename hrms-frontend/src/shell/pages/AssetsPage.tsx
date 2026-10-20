"use client";

import { Suspense, useMemo, useState } from "react";

import { AssetsModule } from "@/modules/assets/AssetsModule";
import { createHttpAssetsGateway } from "@/modules/assets/gateway";
import { formatEmployeeName } from "@/modules/employees/selectors";
import type { EmployeeRecord } from "@/modules/employees/types";
import { apiRequest } from "@/shared";
import { useEmployeeSearch } from "@/modules/employees/hooks/useEmployeeSearch";
import { normalizeEmployeeRecord } from "@/shared/live";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

function activeEmployeeOptions(
  employees: readonly EmployeeRecord[],
): { value: string; label: string }[] {
  return employees
    .filter((row) => row.status === "ACTIVE")
    .map((row) => {
      const name = formatEmployeeName(row);
      const code = row.employeeCode?.trim();
      return {
        value: row.id,
        label: code ? `${name} (${code})` : name,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function AssetsPage() {
  const {
    liveSession,
    moduleHostKey,
    liveModuleGateways,
    theme,
    role,
    accessGrants,
    goBack,
    openAssets,
    openEmployeeProfile,
    activeLocationAllowed,
    heading,
  } = useHrms();

  const assetsGateway = useMemo(
    () => createHttpAssetsGateway({ request: apiRequest }),
    [],
  );

  // People for the Assign picker are found by the server as the user types.
  const [assignQuery, setAssignQuery] = useState<string | null>(null);
  const found = useEmployeeSearch(
    liveSession ? liveModuleGateways?.employees : undefined,
    assignQuery ?? "",
    assignQuery !== null && assignQuery.trim().length > 0,
  );
  const employeeOptions = useMemo(
    () => activeEmployeeOptions(found.rows.map(normalizeEmployeeRecord)),
    [found.rows],
  );

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <Suspense fallback={null}>
      <AssetsModule
        key={`assets-${moduleHostKey}`}
        role={role}
        accessGrants={accessGrants}
        theme={theme}
        gateway={liveSession ? assetsGateway : undefined}
        employeeOptions={employeeOptions}
        onEmployeeSearch={liveSession ? setAssignQuery : undefined}
        employeesLoading={found.loading}
        onOpenEmployee={openEmployeeProfile}
        onNavigate={(destination) => {
          if (destination === "/dashboard") {
            goBack();
          } else if (destination === "/assets") {
            openAssets();
          }
        }}
      />
    </Suspense>
  );
}
