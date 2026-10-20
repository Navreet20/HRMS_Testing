import type { AppTheme, HrmsRole } from "@/shared";
import type { VendorsGateway } from "./gateway/vendorsGateway";

export interface VendorAccessFlags {
  readonly createAccess: boolean;
  readonly editAccess: boolean;
  readonly viewAccess: boolean;
  readonly fullAccess: boolean;
}

export interface VendorActor {
  readonly role: HrmsRole;
  readonly accessFlags: VendorAccessFlags;
}

export type VendorStatus = "ACTIVE" | "INACTIVE";
export type NetPayTerm = "7" | "15" | "30" | "45" | "60" | "120";
export type ExtraContactType = "accountingteam" | "paymentteam" | "others";
export type PaymentType = "ach" | "Checks";
export type AccountType =
  | "Personal Checking"
  | "Business Checking"
  | "MMA Checking"
  | "Savings";
export type ChecksAddressType = "billing" | "corporate";

export interface AddressFields {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

export interface ExtraContact {
  readonly id: string;
  readonly contactType: ExtraContactType | "";
  readonly name: string;
  readonly designation: string;
  readonly email: string;
  readonly phone: string;
}

export interface AchPaymentDetails {
  readonly accountNumber: string;
  readonly routingNumber: string;
  readonly bankName: string;
  readonly accountType: AccountType | "";
}

export interface VendorPayment {
  readonly paymentType: PaymentType | "";
  readonly ach: AchPaymentDetails;
  readonly checksAddressType: ChecksAddressType | "";
}

export interface VendorEmployeeLink {
  readonly id: string;
  readonly employeeId: string;
  readonly displayName: string;
  readonly projectName: string;
  readonly clientName: string;
  readonly vendorId: string;
}

export interface VendorRecord {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly contactName: string;
  readonly designation: string;
  readonly ein: string;
  readonly netPayTerm: NetPayTerm;
  readonly corporateAddress: AddressFields;
  readonly billingAddress: AddressFields;
  readonly billingIsCorporate: boolean;
  readonly payment: VendorPayment;
  readonly extraContacts: readonly ExtraContact[];
  readonly msaStartDate: string | null;
  readonly msaEndDate: string | null;
  readonly status: VendorStatus;
}

export interface VendorsModuleData {
  readonly vendors: readonly VendorRecord[];
  readonly employeeLinks: readonly VendorEmployeeLink[];
}

export type VendorsView = "directory" | "details";
export type VendorsDestination = "/vendors" | "/dashboard";

export interface VendorsModuleProps {
  readonly actor?: VendorActor;
  readonly defaultActor?: VendorActor;
  readonly data?: VendorsModuleData;
  readonly defaultData?: VendorsModuleData;
  /** Live FastAPI gateway; when set, mutations hit REST then refresh. */
  readonly gateway?: VendorsGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly initialView?: VendorsView;
  readonly initialVendorId?: string | null;
  readonly onDataChange?: (data: VendorsModuleData) => void;
  readonly onNavigate?: (destination: VendorsDestination) => void;
  readonly onViewChange?: (
    view: VendorsView,
    vendorId?: string | null,
  ) => void;
  readonly role?: HrmsRole;
  readonly onRoleChange?: (role: HrmsRole) => void;
  readonly onThemeChange?: (theme: AppTheme) => void;
}

export interface DirectoryQuery {
  readonly search: string;
  readonly status: VendorStatus | "" | "all";
}

export interface VendorDraft {
  readonly name: string;
  readonly type: string;
  readonly contactName: string;
  readonly designation: string;
  readonly ein: string;
  readonly netPayTerm: NetPayTerm | "";
  readonly corporateAddress: AddressFields;
  readonly billingAddress: AddressFields;
  readonly billingIsCorporate: boolean;
  readonly payment: VendorPayment;
  readonly extraContacts: readonly ExtraContact[];
}

export interface VendorDraftError {
  readonly field: string;
  readonly message: string;
}

export type VendorsAction =
  | { readonly type: "SET_VIEW"; readonly view: VendorsView; readonly vendorId?: string | null }
  | { readonly type: "CREATE_VENDOR"; readonly draft: VendorDraft }
  | {
      readonly type: "UPDATE_VENDOR";
      readonly vendorId: string;
      readonly patch: Partial<VendorDraft>;
    }
  | { readonly type: "DEACTIVATE_VENDOR"; readonly vendorId: string }
  | {
      readonly type: "UPDATE_MSA";
      readonly vendorId: string;
      readonly msaStartDate: string;
      readonly msaEndDate: string;
    }
  | { readonly type: "REPLACE_DATA"; readonly data: VendorsModuleData };

export interface VendorsUiState {
  readonly view: VendorsView;
  readonly detailsVendorId: string | null;
  readonly lastError: string | null;
}

export interface VendorsReducerState {
  readonly data: VendorsModuleData;
  readonly ui: VendorsUiState;
}
