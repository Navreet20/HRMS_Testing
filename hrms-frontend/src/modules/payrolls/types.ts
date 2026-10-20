import type { AppTheme, HrmsRole } from "@/shared";
import type { PayrollsGateway } from "./gateway/payrollsGateway";

export interface PayrollsAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

export interface PayrollsActor {
  readonly role: HrmsRole;
  /** Session-linked employee identifier used to scope the private My Pay view. */
  readonly employeeId?: string;
  readonly displayName?: string;
  readonly accessFlags: PayrollsAccessFlags;
}

export type PeriodType =
  | "Weekly"
  | "Biweekly"
  | "Monthly"
  | "Semi Monthly";

export type PayrollRowStatus = "pending" | "approved" | "rejected";

export interface PayrollEmployee {
  readonly employeeCode: string;
  readonly displayName: string;
  readonly isW2: boolean;
}

export interface PayrollLineRecord {
  readonly id: string;
  readonly employeeCode: string;
  readonly period: string;
  readonly periodType: PeriodType;
  readonly payDate: string;
  readonly hrs: number;
  readonly payrate: number;
  readonly salary: number;
  readonly health: number;
  readonly four01k: number;
  readonly reimbursement: number;
  readonly employerTax: number;
  readonly payrollExpenses: number;
  readonly payrollStatus: PayrollRowStatus;
}

export interface PayrollPeriodRecord {
  readonly id: string;
  readonly period: string;
  readonly periodType: PeriodType;
  readonly startDate: string;
  readonly endDate: string;
  readonly payDate: string;
  readonly employeeCount: number;
}

export interface PayrollsModuleData {
  readonly employees: readonly PayrollEmployee[];
  readonly lines: readonly PayrollLineRecord[];
}

export type PayrollsView = "directory" | "details";
export type PayrollsDestination = "/payrolls" | "/dashboard";

export interface PayrollsModuleProps {
  readonly actor?: PayrollsActor;
  readonly defaultActor?: PayrollsActor;
  readonly data?: PayrollsModuleData;
  readonly defaultData?: PayrollsModuleData;
  /** Live FastAPI gateway; when set, line saves POST/PATCH payrolls. */
  readonly gateway?: PayrollsGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly initialView?: PayrollsView;
  readonly initialPeriodId?: string | null;
  readonly onDataChange?: (data: PayrollsModuleData) => void;
  readonly onNavigate?: (destination: PayrollsDestination) => void;
  readonly onViewChange?: (
    view: PayrollsView,
    periodId?: string | null,
  ) => void;
  readonly role?: HrmsRole;
  readonly onRoleChange?: (role: HrmsRole) => void;
  readonly onThemeChange?: (theme: AppTheme) => void;
}

export interface DirectoryQuery {
  readonly search: string;
  readonly periodType: PeriodType | "";
  readonly payDate: string;
}

export interface CreatePayrollDraft {
  readonly payDate: string;
  readonly periodType: PeriodType | "";
}

export interface PayrollLineDraft {
  readonly employeeCode: string;
  readonly hrs: number;
  readonly payrate: number;
  readonly health: number;
  readonly four01k: number;
  readonly reimbursement: number;
  readonly payrollExpenses: number;
  readonly payrollStatus: PayrollRowStatus;
}

export interface PayrollDraftError {
  readonly field: string;
  readonly message: string;
}

export type PayrollsAction =
  | {
      readonly type: "SET_VIEW";
      readonly view: PayrollsView;
      readonly periodId?: string | null;
    }
  | {
      readonly type: "CREATE_PERIOD";
      readonly payDate: string;
      readonly periodType: PeriodType;
      readonly period: string;
      readonly startDate: string;
      readonly endDate: string;
    }
  | {
      readonly type: "SAVE_PERIOD_LINES";
      readonly period: string;
      readonly periodType: PeriodType;
      readonly payDate: string;
      readonly lines: readonly PayrollLineDraft[];
    }
  | { readonly type: "REPLACE_DATA"; readonly data: PayrollsModuleData };

export interface PayrollsUiState {
  readonly view: PayrollsView;
  readonly detailsPeriodId: string | null;
  readonly isNewPeriod: boolean;
  readonly lastError: string | null;
}

export interface PayrollsReducerState {
  readonly data: PayrollsModuleData;
  readonly ui: PayrollsUiState;
}
