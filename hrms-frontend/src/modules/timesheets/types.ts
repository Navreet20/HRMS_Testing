import type { ClientCategory } from "@/modules/clients/clientCategory";
import type { AppTheme, HrmsRole } from "@/shared";
import type { TimesheetsGateway } from "./gateway";

export type TimesheetStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Rejected";

export interface TimesheetEntryRecord {
  readonly entryId?: string;
  readonly workDate: string;
  readonly hours: number;
  readonly comment?: string | null;
}

export interface TimesheetLineRecord {
  readonly lineId?: string;
  readonly clientKey: string;
  readonly projectCodeCategory: string;
  readonly projectCode: string | null;
  readonly activityType: string | null;
  readonly leaveType: string | null;
  readonly otherType: string | null;
  readonly otherComment: string | null;
  readonly billable: boolean;
  readonly entries: readonly TimesheetEntryRecord[];
}

export interface TimesheetWeekRecord {
  readonly timesheetId: string;
  readonly employeeId: string;
  readonly businessEmployeeId?: string | null;
  readonly employeeName?: string | null;
  readonly weekStartDate: string;
  readonly weekEndDate: string;
  readonly status: TimesheetStatus;
  readonly rejectionComment?: string | null;
  readonly submittedDate?: string | null;
  /** When the manager approved or rejected the week, and who. */
  readonly approvedDate?: string | null;
  readonly approvedByName?: string | null;
  readonly reopenedFromApproved?: boolean;
  /** Your own Submitted week: who has to act next, like "Meena P (your manager)". */
  readonly waitingOn?: string | null;
  readonly expectedWeeklyHours?: number;
  /** Company setting: type and show hours as 7:30 ("clock") or 7.5 ("decimal"). */
  readonly hoursFormat?: HoursFormat;
  /** Holidays and Pending/Approved leave in this week, shown on the day columns. */
  readonly dayMarkers?: readonly TimesheetDayMarker[];
  readonly lines: readonly TimesheetLineRecord[];
}

export type HoursFormat = "clock" | "decimal";

/** A company holiday or a leave day from the leave module, for one date. */
export type TimesheetDayMarker =
  | {
      readonly date: string;
      readonly kind: "holiday";
      readonly name: string;
      readonly holidayType: string;
    }
  | {
      readonly date: string;
      readonly kind: "leave";
      readonly leaveType: string;
      readonly status: "Pending" | "Approved";
      readonly halfDay: boolean;
    };

/** How a day column looks: its header tag, hover text and column colour. */
export interface TimesheetDayLabel {
  readonly tone: "holiday" | "leave" | "halfLeave" | "pending";
  readonly tag: string;
  readonly title: string;
}

export interface ProjectCodeOption {
  readonly code: string;
  readonly label: string;
  readonly projectId?: string | null;
  readonly source?: string;
  /** Allocated projects only: the project's client and its type. */
  readonly clientName?: string | null;
  readonly clientCategory?: ClientCategory | null;
}

export interface ProjectCodeOptions {
  readonly categories: readonly string[];
  readonly allocatedProjects: readonly ProjectCodeOption[];
  readonly internalProjectCodes: readonly ProjectCodeOption[];
  readonly otherTypes: readonly string[];
  readonly activityTypes: readonly string[];
  readonly leaveTypes: readonly string[];
}

export interface TimesheetsModuleProps {
  readonly role?: HrmsRole;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly gateway?: TimesheetsGateway;
  readonly onNavigate?: (destination: string) => void;
}
