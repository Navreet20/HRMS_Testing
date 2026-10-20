import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type {
  AssetActivityLogRecord,
  AssetAllocationRecord,
  AssetSwapResult,
  AssetUpdateBody,
} from "../types";
import type { AssetsGateway, AssetsListParams } from "./assetsGateway";

export type AssetsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  options?: { readonly responseType?: "json" | "blob" },
) => Promise<T>;

export interface HttpAssetsGatewayOptions {
  readonly request: AssetsRequest;
}

async function runRequest<T>(
  request: AssetsRequest,
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  options?: { readonly responseType?: "json" | "blob" },
): Promise<T> {
  try {
    return await request<T>(method, path, body, options);
  } catch (error) {
    throw mapApiHttpError(error);
  }
}

function receiptPath(systemAssetId: string): string {
  return `/assets/${encodeURIComponent(systemAssetId)}/purchase-receipt`;
}

/** Live Assets gateway targeting FastAPI REST `/api/v1/assets`. */
export function createHttpAssetsGateway(
  options: HttpAssetsGatewayOptions,
): AssetsGateway {
  const { request } = options;

  return {
    listAssets: (params: AssetsListParams = {}) => {
      const qs = new URLSearchParams();
      if (params.categoryId) qs.set("categoryId", params.categoryId);
      if (params.status) qs.set("status", params.status);
      if (params.condition) qs.set("condition", params.condition);
      if (params.q) qs.set("q", params.q);
      if (params.employeeName) qs.set("employeeName", params.employeeName);
      if (params.osPlatform) qs.set("osPlatform", params.osPlatform);
      if (params.purchaseDateFrom) qs.set("purchaseDateFrom", params.purchaseDateFrom);
      if (params.purchaseDateTo) qs.set("purchaseDateTo", params.purchaseDateTo);
      if (params.warrantyExpired) {
        qs.set("warrantyExpired", "true");
      } else if (params.warrantyExpiringSoon) {
        qs.set("warrantyExpiringSoon", "true");
      }
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return runRequest(request, "GET", `/assets${suffix}`);
    },
    listCategories: () =>
      runRequest(request, "GET", "/assets/categories"),
    createAsset: (body) => runRequest(request, "POST", "/assets", body),
    updateAsset: (systemAssetId, body: AssetUpdateBody) =>
      runRequest(
        request,
        "PATCH",
        `/assets/${encodeURIComponent(systemAssetId)}`,
        body,
      ),
    retireAsset: (systemAssetId) =>
      runRequest(
        request,
        "POST",
        `/assets/${encodeURIComponent(systemAssetId)}/retire`,
      ),
    returnAssetToStock: (systemAssetId) =>
      runRequest(
        request,
        "POST",
        `/assets/${encodeURIComponent(systemAssetId)}/return-to-stock`,
      ),
    reportAssetLost: (systemAssetId, body) =>
      runRequest(
        request,
        "POST",
        `/assets/${encodeURIComponent(systemAssetId)}/report-lost`,
        body,
      ),
    markAssetFound: (systemAssetId, body) =>
      runRequest(
        request,
        "POST",
        `/assets/${encodeURIComponent(systemAssetId)}/mark-found`,
        body,
      ),
    listActivity: (systemAssetId) =>
      runRequest<AssetActivityLogRecord[]>(
        request,
        "GET",
        `/assets/${encodeURIComponent(systemAssetId)}/activity`,
      ),
    allocateAsset: (systemAssetId, body) =>
      runRequest<AssetAllocationRecord>(
        request,
        "POST",
        `/assets/${encodeURIComponent(systemAssetId)}/allocate`,
        body,
      ),
    returnAllocation: (allocationId, body) =>
      runRequest<AssetAllocationRecord>(
        request,
        "POST",
        `/assets/allocations/${encodeURIComponent(allocationId)}/return`,
        body,
      ),
    swapAsset: (allocationId, body) =>
      runRequest<AssetSwapResult>(
        request,
        "POST",
        `/assets/allocations/${encodeURIComponent(allocationId)}/swap`,
        body,
      ),
    listEmployeeAssets: (employeeId) =>
      runRequest<AssetAllocationRecord[]>(
        request,
        "GET",
        `/assets/employees/${encodeURIComponent(employeeId)}`,
      ),
    listMyAssets: () =>
      runRequest<AssetAllocationRecord[]>(request, "GET", "/assets/mine"),
    uploadPurchaseReceipt: (systemAssetId, file) => {
      const form = new FormData();
      form.append("file", file);
      return runRequest(request, "POST", receiptPath(systemAssetId), form);
    },
    deletePurchaseReceipt: (systemAssetId) =>
      runRequest(request, "DELETE", receiptPath(systemAssetId)),
    downloadPurchaseReceipt: (systemAssetId) =>
      runRequest(request, "GET", receiptPath(systemAssetId), undefined, {
        responseType: "blob",
      }),
  };
}
