import type {
  AssetActivityLogRecord,
  AssetAllocationRecord,
  AssetSwapResult,
  AssetUpdateBody,
} from "../types";

export interface AssetsListParams {
  categoryId?: string;
  status?: string;
  condition?: string;
  q?: string;
  /** Current or historical allocation employee display-name match. */
  employeeName?: string;
  osPlatform?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  /** When true, only assets whose warranty expires within 30 days. */
  warrantyExpiringSoon?: boolean;
  /** When true, only assets whose warranty ended before today. */
  warrantyExpired?: boolean;
}

export interface AssetsGateway {
  listAssets(params?: AssetsListParams): Promise<unknown>;
  listCategories(): Promise<unknown>;
  createAsset(body: unknown): Promise<unknown>;
  updateAsset(systemAssetId: string, body: AssetUpdateBody): Promise<unknown>;
  retireAsset(systemAssetId: string): Promise<unknown>;
  returnAssetToStock(systemAssetId: string): Promise<unknown>;
  /** Record an asset as lost or stolen; closes any open assignment. */
  reportAssetLost(
    systemAssetId: string,
    body: { reason: string; lostDate?: string; notes?: string },
  ): Promise<unknown>;
  /** A lost asset turned up; its condition decides the next status. */
  markAssetFound(
    systemAssetId: string,
    body: { condition: string; notes?: string },
  ): Promise<unknown>;
  listActivity(systemAssetId: string): Promise<AssetActivityLogRecord[]>;
  allocateAsset(
    systemAssetId: string,
    body: {
      employeeId: string;
      allocatedDate?: string;
    },
  ): Promise<AssetAllocationRecord>;
  returnAllocation(
    allocationId: string,
    body: {
      reasonForReturn: string;
      reasonForReturnOther?: string;
      conditionAtReturn: string;
      returnedDate?: string;
      returnNotes?: string;
    },
  ): Promise<AssetAllocationRecord>;
  /** Atomic return of current assignment + assign a different In Stock asset. */
  swapAsset(
    allocationId: string,
    body: {
      systemAssetId: string;
      reasonForReturn: string;
      reasonForReturnOther?: string;
      conditionAtReturn: string;
      returnedDate?: string;
      returnNotes?: string;
      allocatedDate?: string;
    },
  ): Promise<AssetSwapResult>;
  listEmployeeAssets(employeeId: string): Promise<AssetAllocationRecord[]>;
  listMyAssets(): Promise<AssetAllocationRecord[]>;
  uploadPurchaseReceipt(systemAssetId: string, file: File): Promise<unknown>;
  deletePurchaseReceipt(systemAssetId: string): Promise<unknown>;
  downloadPurchaseReceipt(systemAssetId: string): Promise<Blob>;
}
