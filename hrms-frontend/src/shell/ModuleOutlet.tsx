"use client";

import { useHrms } from "./HrmsContext";
import { BillingPage } from "./pages/BillingPage";
import { CompanyPage } from "./pages/CompanyPage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { DesignationsPage } from "./pages/DesignationsPage";
import { LocationsPage } from "./pages/LocationsPage";
import { LeavePolicyPage } from "./pages/LeavePolicyPage";
import { ManageAccessPage } from "./pages/ManageAccessPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ActivityLogPage } from "./pages/ActivityLogPage";
import { ClientsPage } from "./pages/ClientsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { PayrollsPage } from "./pages/PayrollsPage";
import { ModulePlaceholder } from "./pages/PlaceholderPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RevenuePage } from "./pages/RevenuePage";
import { SchedulePage } from "./pages/SchedulePage";
import { VendorsPage } from "./pages/VendorsPage";
import { AssetsPage } from "./pages/AssetsPage";
import { EmployeePortalPage } from "./pages/EmployeePortalPage";
import { TimesheetsPage } from "./pages/TimesheetsPage";

/** Test-only module switch used by `HrmsTestApp`. Production uses App Router `{children}`. */
export function ModuleOutlet() {
  const { activeNav, heading } = useHrms();

  switch (activeNav) {
    case "profile":
      return <ProfilePage />;
    case "employees":
      return <EmployeesPage />;
    case "attendance":
    case "timesheets":
      return <TimesheetsPage />;
    case "projects":
      return <ProjectsPage />;
    case "employeePortal":
      return <EmployeePortalPage />;
    case "company":
      return <CompanyPage />;
    case "departments":
      return <DepartmentsPage />;
    case "locations":
      return <LocationsPage />;
    case "designations":
      return <DesignationsPage />;
    case "leavePolicy":
      return <LeavePolicyPage />;
    case "manageAccess":
      return <ManageAccessPage />;
    case "notifications":
      return <NotificationsPage />;
    case "activityLog":
      return <ActivityLogPage />;
    case "clients":
      return <ClientsPage />;
    case "vendors":
      return <VendorsPage />;
    case "assets":
      return <AssetsPage />;
    case "billing":
      return <BillingPage />;
    case "payrolls":
      return <PayrollsPage />;
    case "revenue":
      return <RevenuePage />;
    case "schedule":
      return <SchedulePage />;
    case "dashboard":
      return <DashboardPage />;
    default:
      return <ModulePlaceholder heading={heading} />;
  }
}
