import type { AppTheme, HrmsRole } from "@/shared";
import type { RevenueGateway } from "./gateway/revenueGateway";

export interface RevenueAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

export interface RevenueActor {
  readonly role: HrmsRole;
  readonly accessFlags: RevenueAccessFlags;
}

export interface OverdueInvoiceRecord {
  readonly invoiceNumber: string;
  readonly clientName: string;
  readonly invoiceDueDate: string;
  readonly dueAmount: number;
}

export interface ClientRevenueRecord {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly invoicedAmount: number;
  readonly receivedAmount: number;
  readonly additionalExpenses: number;
  readonly dueAmount: number;
  readonly overdueAmount: number;
  readonly overdueInvoices: readonly OverdueInvoiceRecord[];
}

export interface RevenueModuleData {
  readonly clients: readonly ClientRevenueRecord[];
}

export type RevenueViewMode = "list" | "card";
export type RevenueDestination = "/revenue" | "/dashboard";

export interface RevenueModuleProps {
  readonly actor?: RevenueActor;
  readonly defaultActor?: RevenueActor;
  readonly data?: RevenueModuleData;
  readonly defaultData?: RevenueModuleData;
  /** Live FastAPI gateway; when set, reminders POST to REST. */
  readonly gateway?: RevenueGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly onDataChange?: (data: RevenueModuleData) => void;
  readonly onNavigate?: (destination: RevenueDestination) => void;
  readonly role?: HrmsRole;
  readonly onRoleChange?: (role: HrmsRole) => void;
  readonly onThemeChange?: (theme: AppTheme) => void;
}

export type DirectorySortKey =
  | "clientName"
  | "invoicedAmount"
  | "receivedAmount"
  | "dueAmount"
  | "additionalExpenses"
  | "overdueAmount";
export type DirectorySortDirection = "asc" | "desc";

export interface DirectoryQuery {
  readonly search: string;
  readonly sortKey: DirectorySortKey;
  readonly sortDirection: DirectorySortDirection;
  readonly viewMode: RevenueViewMode;
}

export interface RevenueGrandTotals {
  readonly invoicedAmount: number;
  readonly receivedAmount: number;
  readonly additionalExpenses: number;
  readonly dueAmount: number;
  readonly overdueAmount: number;
  readonly pastDueClientCount: number;
}

export interface RevenuePerformers {
  readonly top: ClientRevenueRecord | null;
  readonly low: ClientRevenueRecord | null;
}

export type RevenueDialog =
  | { readonly kind: "detail"; readonly clientId: string }
  | { readonly kind: "pastDue" }
  | {
      readonly kind: "overdue";
      readonly clientId: string;
      readonly clientName: string;
    }
  | {
      readonly kind: "email";
      readonly invoiceNumber: string;
      readonly clientName: string;
      readonly defaultEmail: string;
    };

export type RevenueAction =
  | { readonly type: "REPLACE_DATA"; readonly data: RevenueModuleData }
  | {
      readonly type: "SEND_EMAIL_REMINDER";
      readonly invoiceNumber: string;
      readonly email: string;
    }
  | { readonly type: "SET_ERROR"; readonly error: string }
  | { readonly type: "CLEAR_ERROR" };

export interface RevenueUiState {
  readonly lastError: string | null;
  readonly lastNotice: string | null;
}

export interface RevenueReducerState {
  readonly data: RevenueModuleData;
  readonly ui: RevenueUiState;
}
