import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookMarked,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  DoorOpen,
  FolderTree,
  History,
  Home,
  IdCard,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Package,
  Settings2,
  Table2,
  Tags,
  TrendingUp,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

type SidebarIconId =
  | "dashboard"
  | "company"
  | "companyFolder"
  | "departments"
  | "locations"
  | "designations"
  | "leavePolicy"
  | "manageAccess"
  | "notifications"
  | "skills"
  | "clients"
  | "vendors"
  | "assets"
  | "timesheets"
  | "projects"
  | "employeePortal"
  | "employeePortalSelf"
  | "employeePortalManage"
  | "employees"
  | "employeesFolder"
  | "employeesOnboarding"
  | "activityLog"
  | "billing"
  | "payrolls"
  | "revenue"
  | "attendance"
  | "leaves"
  | "schedule"
  | "chevron";

const ICONS: Record<SidebarIconId, LucideIcon> = {
  dashboard: LayoutDashboard,
  company: Building2,
  companyFolder: Settings2,
  departments: FolderTree,
  locations: MapPin,
  designations: IdCard,
  leavePolicy: CalendarDays,
  manageAccess: KeyRound,
  notifications: Bell,
  skills: Tags,
  clients: Building2,
  vendors: Home,
  assets: Package,
  timesheets: Table2,
  projects: Briefcase,
  employeePortal: DoorOpen,
  employeePortalSelf: User,
  employeePortalManage: Users,
  employees: User,
  employeesFolder: Users,
  employeesOnboarding: UserPlus,
  activityLog: History,
  billing: CreditCard,
  payrolls: DollarSign,
  revenue: TrendingUp,
  attendance: Clock,
  leaves: BookMarked,
  schedule: Calendar,
  chevron: ChevronUp,
};


/** Stroke icons for the sidebar, powered by Lucide. */
export function SidebarNavIcon({
  id,
}: {
  readonly id: SidebarIconId;
}): ReactNode {
  const Icon = ICONS[id];
  if (!Icon) return null;

  const size = id === "chevron" ? 14 : 18;
  return (
    <Icon
      size={size}
      strokeWidth={1.75}
      aria-hidden
      focusable={false}
    />
  );
}
