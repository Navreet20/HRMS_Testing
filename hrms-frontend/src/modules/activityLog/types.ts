import type { AppTheme, HrmsRole } from "@/shared";
import type { EmployeesGateway } from "@/modules/employees/gateway";

export type DirectoryPageSize = 10 | 25 | 50;

export interface ActivityLogActor {
  readonly role: HrmsRole;
}

export interface ActivityLogRecord {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeCode: string | null;
  readonly businessEmployeeId: string | null;
  readonly employeeName: string;
  readonly fieldName: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
  readonly changedBy: string | null;
  readonly changedById: string | null;
  readonly changedByRole: string | null;
  readonly reason: string | null;
  readonly changedAt: string | null;
}

export interface ActivityLogListPayload {
  readonly items: readonly ActivityLogRecord[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface ActivityLogModuleProps {
  readonly actor?: ActivityLogActor;
  readonly defaultActor?: ActivityLogActor;
  readonly role?: HrmsRole;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly gateway?: Pick<EmployeesGateway, "listActivityLog">;
  readonly accessGrants?: readonly import("@/shared").SessionAccessGrant[];
}
