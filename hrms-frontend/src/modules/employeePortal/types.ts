export type EmployeePortalMode = "self" | "manage";

export type SelfCategoryId =
  | "timesheets"
  | "expenses"
  | "leaves"
  | "requests";

/** Nested under the Self Requests tab (sidebar Self/Manage pattern). */

export type ManageCategoryId =
  | "timesheets"
  | "expenses"
  | "leaves"
  | "requests";

export type ManageFunctionalCategoryId =
  | "profileUpdates"
  | "assetRequests"
  | "itRequests";

export type CreateRequestTypeId = "profile" | "asset";

export type RequestForId = "myself" | "someoneElse";

export type ProfileUpdateFieldId =
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "nationality"
  | "general";

export type AssetRequestTypeId = "new" | "swap" | "reportLostStolen";

export type ItRequestCategoryId = "firewall" | "ram" | "softwareLicense";

export interface ManagingOptionResponse {
  readonly hasDirectReports: boolean;
  readonly canManageTimesheets: boolean;
  readonly canManageProfileUpdates: boolean;
  readonly canManageAssetRequests: boolean;
  readonly canManageItRequests: boolean;
  /** HR / Admin: Manage → Leaves for everyone (timesheet-style org approvers). */
  readonly canManageLeaves: boolean;
}

export interface RequestPartyIdentity {
  readonly firstName: string;
  readonly lastName: string;
  readonly businessEmployeeId: string;
}

/** How a manager decided a request: their comment, who, and when. */
export interface RequestDecisionFields {
  readonly decisionNote?: string | null;
  readonly decidedByName?: string | null;
  readonly decidedDate?: string | null;
}

export interface ProfileUpdateRequestRecord extends RequestDecisionFields {
  readonly id: string;
  readonly employeeId: string;
  readonly submittedByEmployeeId?: string | null;
  readonly fieldChanged: ProfileUpdateFieldId | string;
  readonly oldValue: string | null;
  readonly newValue: string;
  readonly shortDescription?: string | null;
  readonly longDescription?: string | null;
  readonly attachmentFileName?: string | null;
  readonly hasAttachment?: boolean;
  readonly status: string;
  readonly requestedDate: string | null;
  /** When the status last changed (the decision date once decided). */
  readonly updatedDate?: string | null;
  readonly requesterName?: string;
  readonly subjectName?: string;
  readonly requester?: RequestPartyIdentity;
  readonly subject?: RequestPartyIdentity;
}

export interface SubmitProfileUpdateRequestInput {
  readonly shortDescription?: string;
  readonly longDescription?: string;
  readonly requestedForEmployeeId?: string;
  readonly attachment?: File;
  /** Structured change (old → new); `longDescription` is then the reason. */
  readonly fieldChanged?: ProfileUpdateFieldId;
  readonly newValue?: string;
  /** The rejected request this one replaces, so their history stays linked. */
  readonly resubmitOfId?: string;
}

export interface AssignedAssetOption {
  readonly systemAssetId: string;
  readonly assetId: string;
  readonly categoryName: string | null;
}

export interface AssetCategoryOption {
  readonly categoryId: string;
  readonly categoryName: string;
  /** How many are In Stock; 0 means the category cannot be requested right now. */
  readonly inStockCount?: number;
}

/** An In Stock asset a manager can hand out to fulfil a request. */
export interface AvailableAssetOption {
  readonly systemAssetId: string;
  readonly assetId: string;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly osPlatform: string | null;
  readonly specifications: string | null;
  readonly condition: string | null;
}

export interface AssetCatalogModelOption {
  readonly id: string;
  readonly model: string;
  readonly specifications: string;
  readonly osPlatforms: readonly string[];
}

export interface AssetCatalog {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly osPlatforms: readonly string[];
  readonly models: readonly AssetCatalogModelOption[];
}

export interface AssetRequestRecord extends RequestDecisionFields {
  readonly id: string;
  readonly employeeId: string;
  readonly submittedByEmployeeId?: string | null;
  readonly requestType: AssetRequestTypeId | string;
  readonly systemAssetId: string | null;
  readonly categoryId?: string | null;
  readonly categoryName?: string | null;
  readonly newAssetDetails: string | null;
  readonly status: string;
  readonly requestedDate: string | null;
  readonly updatedDate?: string | null;
  readonly requesterName?: string;
  readonly subjectName?: string;
  readonly requester?: RequestPartyIdentity;
  readonly subject?: RequestPartyIdentity;
}

export interface SubmitAssetRequestInput {
  readonly requestType: AssetRequestTypeId;
  readonly systemAssetId?: string;
  readonly categoryId?: string;
  readonly newAssetDetails?: string;
  readonly requestedForEmployeeId?: string;
  /** The rejected request this one replaces, so their history stays linked. */
  readonly resubmitOfId?: string;
}

export interface ItRequestRecord extends RequestDecisionFields {
  readonly id: string;
  readonly updatedDate?: string | null;
  readonly employeeId: string;
  readonly category: ItRequestCategoryId | string;
  readonly details: string;
  readonly status: string;
  readonly requestedDate: string | null;
  readonly requesterName?: string;
}

export interface SubmitItRequestInput {
  readonly category: ItRequestCategoryId;
  readonly details: string;
}

export interface EmployeeDirectoryHit {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly employeeId: string;
}

/** Approving an asset request also does the work in Assets. */
export interface DecideAssetRequestInput {
  readonly action: "approve" | "reject";
  /** Required to reject. */
  readonly notes?: string;
  /** New or swap: the In Stock asset to hand out. */
  readonly assignSystemAssetId?: string;
  /** Swap: why the old asset comes back, and its condition. */
  readonly reasonForReturn?: string;
  readonly conditionAtReturn?: string;
  /** Lost or stolen report: which one. */
  readonly reason?: string;
}

/** How many things wait for you in each Manage tab. */
export interface ManageCounts {
  readonly timesheets: number;
  readonly leaves: number;
  readonly requests: number;
}

export interface EmployeePortalGateway {
  fetchManagingOption(): Promise<ManagingOptionResponse>;
  /** Waiting counts for the Manage tab badges. */
  fetchManageCounts?(): Promise<ManageCounts>;
  listProfileUpdateRequests(): Promise<readonly ProfileUpdateRequestRecord[]>;
  submitProfileUpdateRequest(
    input: SubmitProfileUpdateRequestInput,
  ): Promise<ProfileUpdateRequestRecord>;
  downloadProfileUpdateAttachment(
    requestId: string,
  ): Promise<{ readonly blob: Blob; readonly fileName: string }>;
  /** Document on a request you raised or that is about you. */
  downloadOwnProfileUpdateAttachment?(
    requestId: string,
  ): Promise<{ readonly blob: Blob; readonly fileName: string }>;
  listMyAssignedAssets(
    employeeId?: string,
  ): Promise<readonly AssignedAssetOption[]>;
  listAssetCategories(): Promise<readonly AssetCategoryOption[]>;
  listAssetCatalog(categoryId: string): Promise<AssetCatalog>;
  listAssetRequests(): Promise<readonly AssetRequestRecord[]>;
  /** Timeline of one of your requests: submitted, rejected, resubmitted, approved. */
  getRequestHistory?(
    kind: "profileUpdate" | "asset",
    requestId: string,
  ): Promise<unknown>;
  submitAssetRequest(
    input: SubmitAssetRequestInput,
  ): Promise<AssetRequestRecord>;
  listItRequests(): Promise<readonly ItRequestRecord[]>;
  submitItRequest(input: SubmitItRequestInput): Promise<ItRequestRecord>;
  listManageProfileUpdateRequests(): Promise<
    readonly ProfileUpdateRequestRecord[]
  >;
  listManageAssetRequests(): Promise<readonly AssetRequestRecord[]>;
  /** In Stock assets that could fulfil a new or swap request. */
  listAvailableAssetsForRequest(
    requestId: string,
  ): Promise<readonly AvailableAssetOption[]>;
  listManageItRequests(): Promise<readonly ItRequestRecord[]>;
  searchEmployees(query: string): Promise<readonly EmployeeDirectoryHit[]>;
  completeProfileUpdateRequest(
    requestId: string,
    input?: { readonly changesSummary?: string },
  ): Promise<ProfileUpdateRequestRecord>;
  decideProfileUpdateRequest(
    requestId: string,
    input: {
      readonly action: "approve" | "reject";
      readonly notes?: string;
    },
  ): Promise<ProfileUpdateRequestRecord>;
  decideAssetRequest(
    requestId: string,
    input: DecideAssetRequestInput,
  ): Promise<AssetRequestRecord>;
}

export function hasEmployeePortalManageAccess(
  option: ManagingOptionResponse,
): boolean {
  return (
    option.hasDirectReports ||
    option.canManageTimesheets ||
    option.canManageProfileUpdates ||
    option.canManageAssetRequests ||
    option.canManageItRequests ||
    option.canManageLeaves
  );
}

export interface EmployeePortalProfileSnapshot {
  readonly firstName: string;
  readonly lastName: string;
  readonly employeeId: string;
  readonly dateOfBirth: string;
  readonly nationality: string;
}
