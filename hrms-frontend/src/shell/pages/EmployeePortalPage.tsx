"use client";

import { useMemo } from "react";

import { EmployeePortalModule } from "@/modules/employeePortal/EmployeePortalModule";
import { createHttpEmployeePortalGateway } from "@/modules/employeePortal/gateway";
import type { EmployeePortalProfileSnapshot } from "@/modules/employeePortal/types";
import { selectEmployeeById } from "@/modules/employees/selectors";
import { createHttpCompanyHolidaysGateway } from "@/modules/companyHolidays";
import { createHttpLeaveApprovalsGateway } from "@/modules/leaveApprovals";
import { createHttpLeaveRequestsGateway } from "@/modules/leaveRequests";
import { createHttpTimesheetsGateway } from "@/modules/timesheets";
import { apiRequest } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";

export function EmployeePortalPage() {
  const {
    liveSession,
    moduleHostKey,
    theme,
    activeLocationAllowed,
    heading,
    employeePortalMode,
    employeePortalQueue,
    employeePortalTab,
    employeePortalManagingOption,
    setEmployeePortalQueue,
    employeeActor,
    liveEmployeesData,
    openEmployeeProfile,
  } = useHrms();

  const gateway = useMemo(
    () => createHttpEmployeePortalGateway({ request: apiRequest }),
    [],
  );
  const timesheetsGateway = useMemo(
    () => createHttpTimesheetsGateway({ request: apiRequest }),
    [],
  );
  const holidaysGateway = useMemo(
    () => createHttpCompanyHolidaysGateway({ request: apiRequest }),
    [],
  );
  const leaveRequestsGateway = useMemo(
    () => createHttpLeaveRequestsGateway({ request: apiRequest }),
    [],
  );
  const leaveApprovalsGateway = useMemo(
    () => createHttpLeaveApprovalsGateway({ request: apiRequest }),
    [],
  );

  const profile = useMemo((): EmployeePortalProfileSnapshot | null => {
    const employeeId = employeeActor.employeeId?.trim();
    if (!employeeId) {
      return null;
    }
    const record = selectEmployeeById(liveEmployeesData, employeeId);
    if (!record) {
      return {
        firstName: "",
        lastName: "",
        employeeId,
        dateOfBirth: "",
        nationality: "",
      };
    }
    return {
      firstName: record.firstName?.trim() ?? "",
      lastName: record.lastName?.trim() ?? "",
      employeeId:
        record.businessEmployeeId?.trim() ||
        record.employeeCode?.trim() ||
        employeeId,
      dateOfBirth: record.personal?.dateOfBirth?.trim() ?? "",
      nationality: record.personal?.nationality?.trim() ?? "",
    };
  }, [employeeActor.employeeId, liveEmployeesData]);

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  return (
    <EmployeePortalModule
      key={`employee-portal-${moduleHostKey}`}
      theme={theme}
      mode={employeePortalMode}
      gateway={liveSession ? gateway : undefined}
      timesheetsGateway={liveSession ? timesheetsGateway : undefined}
      holidaysGateway={liveSession ? holidaysGateway : undefined}
      leaveRequestsGateway={liveSession ? leaveRequestsGateway : undefined}
      leaveApprovalsGateway={liveSession ? leaveApprovalsGateway : undefined}
      profile={profile}
      managingOption={employeePortalManagingOption}
      activeQueue={employeePortalQueue}
      initialTab={employeePortalTab ?? undefined}
      onActiveQueueChange={setEmployeePortalQueue}
      onOpenEmployeeProfile={openEmployeeProfile}
    />
  );
}
