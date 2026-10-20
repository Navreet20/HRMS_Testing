"use client";

import { EmployeesModule } from "@/modules/employees";
import { FeedbackState } from "@/shared";
import { useHrms } from "../HrmsContext";
import { ModulePlaceholder } from "./PlaceholderPage";
import { DirectoryLoading } from "./LiveDataSkeletons";

export function EmployeesPage() {
  const {
    liveSession,
    moduleHostKey,
    liveData,
    liveEmployeesData,
    liveModuleGateways,
    employeeActor,
    theme,
    role,
    setEmployeesSnapshot,
    employeesView,
    timesheetsEnabled,
    pendingTimesheetCount,
    handleRoleChange,
    handleThemePreferenceChange,
    setFocusMode,
    handleTimesheetHandoff,
    openEmployees,
    employeeProfileId,
    navigateTo,
    linkedProfileUpdateRequest,
    returnToEmployeePortalFromProfile,
    employeeProfileReturnQueue,
    employeePortalGateway,
    activeLocationAllowed,
    heading,
  } = useHrms();

  if (!activeLocationAllowed) {
    return <ModulePlaceholder heading={heading} />;
  }

  if (
    liveSession &&
    !liveData.loading &&
    liveData.error &&
    liveEmployeesData.employees.length === 0
  ) {
    return (
      <FeedbackState
        kind="error"
        title="Unable to load employees"
        message={liveData.error}
      />
    );
  }


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DirectoryLoading label="Loading employees" headers={["Name", "Department", "Designation", "Location", "Status"]} />;
  }

  return (
    <EmployeesModule
      key={`employees-${moduleHostKey}`}
      actor={employeeActor}
      theme={theme}
      role={role}
      defaultData={liveSession ? liveEmployeesData : undefined}
      gateway={liveSession ? liveModuleGateways?.employees : undefined}
      skillsGateway={liveSession ? liveModuleGateways?.skills : undefined}
      onDataChange={setEmployeesSnapshot}
      initialView={employeesView}
      initialProfileEmployeeId={employeeProfileId}
      onInitialProfileConsumed={() => {
        navigateTo({ nav: "employees", employeesView: "directory" }, true);
      }}
      linkedProfileUpdateRequest={linkedProfileUpdateRequest}
      onCompleteLinkedProfileUpdateRequest={async ({
        requestId,
        changesSummary,
      }) => {
        await employeePortalGateway.completeProfileUpdateRequest(requestId, {
          changesSummary,
        });
      }}
      onLinkedProfileUpdateRequestFinished={() => {
        returnToEmployeePortalFromProfile();
      }}
      onReturnToPortalFromProfile={
        linkedProfileUpdateRequest || employeeProfileReturnQueue
          ? returnToEmployeePortalFromProfile
          : undefined
      }
      pendingTimesheetCount={
        timesheetsEnabled ? pendingTimesheetCount : undefined
      }
      onRoleChange={handleRoleChange}
      onThemeChange={handleThemePreferenceChange}
      onFocusModeChange={setFocusMode}
      onOpenTimesheetApprovals={
        timesheetsEnabled ? handleTimesheetHandoff : undefined
      }
      onNavigate={(destination) => {
        if (destination === "/dashboard") {
          // Legacy close destination — keep HR on Employees directory.
          openEmployees("directory");
        } else if (destination === "/employees") {
          openEmployees("directory");
        } else if (destination === "/employees/drafts") {
          openEmployees("drafts");
        } else if (destination === "/PendingApprovals") {
          openEmployees("approvals");
        }
      }}
    />
  );
}
