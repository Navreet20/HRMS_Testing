"use client";

import { CalendarDays, FileText } from "lucide-react";
import { useDeferredValue, useState } from "react";

import {
  CompanyHolidaysPanel,
  type CompanyHolidaysGateway,
} from "@/modules/companyHolidays";
import { catalogUi as ui } from "@/shared/ui/catalogUi";
import { AppTabs } from "@/shared/ui";
import { LeavePoliciesPanel } from "./components/LeavePoliciesPanel";
import { LEAVE_POLICY_TABS, type LeavePolicyTabId } from "./constants";
import type { LeavePoliciesGateway } from "./gateway";

export interface LeavePolicyModuleProps {
  readonly policiesGateway?: LeavePoliciesGateway | null;
  readonly holidaysGateway?: CompanyHolidaysGateway | null;
  readonly initialTab?: LeavePolicyTabId;
  /** False for View only access: lists stay visible, add / edit / status actions are hidden. */
  readonly canWrite?: boolean;
}

/** Company Setup → Leave Policy: leave policies and company holidays. */
export function LeavePolicyModule({
  policiesGateway = null,
  holidaysGateway = null,
  initialTab = "policies",
  canWrite = true,
}: LeavePolicyModuleProps) {
  const [tab, setTab] = useState<LeavePolicyTabId>(initialTab);
  // The pill moves first; the (heavier) panel swaps right after.
  const shownTab = useDeferredValue(tab);

  return (
    <section className={`${ui.module} grid gap-4`} aria-label="Leave Policy">
      <AppTabs
        items={LEAVE_POLICY_TABS.map((item) => ({
          ...item,
          icon:
            item.id === "holidays" ? (
              <CalendarDays size={16} strokeWidth={1.9} />
            ) : (
              <FileText size={16} strokeWidth={1.9} />
            ),
        }))}
        value={tab}
        onChange={setTab}
        ariaLabel="Leave Policy sections"
        idPrefix="leave-policy-tab"
      />
      <div
        role="tabpanel"
        id={`leave-policy-panel-${shownTab}`}
        aria-labelledby={`leave-policy-tab-${shownTab}`}
      >
        {shownTab === "holidays" ? (
          <CompanyHolidaysPanel gateway={holidaysGateway} canWrite={canWrite} />
        ) : (
          <LeavePoliciesPanel gateway={policiesGateway} canWrite={canWrite} />
        )}
      </div>
    </section>
  );
}
