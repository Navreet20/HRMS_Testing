"use client";

import { Suspense } from "react";

import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import { useHrms } from "../HrmsContext";
import { DetailLoading } from "./LiveDataSkeletons";

export function ProfilePage() {
  const {
    liveSession,
    liveData,
    moduleHostKey,
    liveEmployeesData,
    liveModuleGateways,
    employeeActor,
    theme,
    role,
    setEmployeesSnapshot,
    handleRoleChange,
    handleThemePreferenceChange,
  } = useHrms();


  // Until the app's first data load finishes, show the page's shape instead of empty data.
  if (liveSession && !liveData.loaded) {
    return <DetailLoading label="Loading profile" sections={2} />;
  }

  return (
    <Suspense fallback={null}>
      <EmployeesModule
        key={`my-profile-${moduleHostKey}`}
        variant="myProfile"
        actor={employeeActor}
        theme={theme}
        role={role}
        defaultData={liveSession ? liveEmployeesData : undefined}
        gateway={liveSession ? liveModuleGateways?.employees : undefined}
        skillsGateway={liveSession ? liveModuleGateways?.skills : undefined}
        onDataChange={setEmployeesSnapshot}
        onRoleChange={handleRoleChange}
        onThemeChange={handleThemePreferenceChange}
      />
    </Suspense>
  );
}
