import { workflowHistoryPath } from "@/shared/workflowHistory";
import { mapApiHttpError, type ApiRequest } from "@/shared";
import type {
  AssetCatalog,
  AssetCatalogModelOption,
  AssetCategoryOption,
  AssetRequestRecord,
  AssignedAssetOption,
  AvailableAssetOption,
  DecideAssetRequestInput,
  EmployeeDirectoryHit,
  EmployeePortalGateway,
  ItRequestRecord,
  ManagingOptionResponse,
  ProfileUpdateRequestRecord,
  RequestPartyIdentity,
  SubmitAssetRequestInput,
  SubmitItRequestInput,
  SubmitProfileUpdateRequestInput,
} from "../types";

export interface HttpEmployeePortalGatewayOptions {
  readonly request: ApiRequest;
}

const EMPTY_MANAGING_OPTION: ManagingOptionResponse = {
  hasDirectReports: false,
  canManageTimesheets: false,
  canManageProfileUpdates: false,
  canManageAssetRequests: false,
  canManageItRequests: false,
  canManageLeaves: false,
};

function readBooleanFlag(raw: Record<string, unknown>, key: string): boolean {
  return typeof raw[key] === "boolean" ? (raw[key] as boolean) : false;
}

export function normalizeManagingOption(raw: unknown): ManagingOptionResponse {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_MANAGING_OPTION };
  }
  const row = raw as Record<string, unknown>;
  return {
    hasDirectReports: readBooleanFlag(row, "hasDirectReports"),
    canManageTimesheets: readBooleanFlag(row, "canManageTimesheets"),
    canManageProfileUpdates: readBooleanFlag(row, "canManageProfileUpdates"),
    canManageAssetRequests: readBooleanFlag(row, "canManageAssetRequests"),
    canManageItRequests: readBooleanFlag(row, "canManageItRequests"),
    canManageLeaves: readBooleanFlag(row, "canManageLeaves"),
  };
}

function normalizePartyIdentity(raw: unknown): RequestPartyIdentity | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const row = raw as Record<string, unknown>;
  return {
    firstName: typeof row.firstName === "string" ? row.firstName : "",
    lastName: typeof row.lastName === "string" ? row.lastName : "",
    businessEmployeeId:
      typeof row.businessEmployeeId === "string" ? row.businessEmployeeId : "",
  };
}

function normalizeDecision(row: Record<string, unknown>) {
  return {
    decisionNote:
      typeof row.decisionNote === "string" ? row.decisionNote : null,
    decidedByName:
      typeof row.decidedByName === "string" ? row.decidedByName : null,
    decidedDate: typeof row.decidedDate === "string" ? row.decidedDate : null,
  };
}

function normalizeProfileUpdateRequest(
  raw: unknown,
): ProfileUpdateRequestRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string") {
    return null;
  }
  const fieldChanged =
    typeof row.fieldChanged === "string" ? row.fieldChanged : "general";
  return {
    id: row.id,
    employeeId: typeof row.employeeId === "string" ? row.employeeId : "",
    submittedByEmployeeId:
      typeof row.submittedByEmployeeId === "string"
        ? row.submittedByEmployeeId
        : null,
    fieldChanged,
    oldValue: typeof row.oldValue === "string" ? row.oldValue : null,
    newValue: typeof row.newValue === "string" ? row.newValue : "",
    shortDescription:
      typeof row.shortDescription === "string" ? row.shortDescription : null,
    longDescription:
      typeof row.longDescription === "string" ? row.longDescription : null,
    attachmentFileName:
      typeof row.attachmentFileName === "string"
        ? row.attachmentFileName
        : null,
    hasAttachment: row.hasAttachment === true,
    status: typeof row.status === "string" ? row.status : "Open",
    requestedDate:
      typeof row.requestedDate === "string" ? row.requestedDate : null,
    updatedDate: typeof row.updatedDate === "string" ? row.updatedDate : null,
    requesterName:
      typeof row.requesterName === "string" ? row.requesterName : undefined,
    subjectName:
      typeof row.subjectName === "string" ? row.subjectName : undefined,
    requester: normalizePartyIdentity(row.requester),
    subject: normalizePartyIdentity(row.subject),
    ...normalizeDecision(row),
  };
}

function normalizeDirectoryHit(raw: unknown): EmployeeDirectoryHit | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string") {
    return null;
  }
  return {
    id: row.id,
    firstName: typeof row.firstName === "string" ? row.firstName : "",
    lastName: typeof row.lastName === "string" ? row.lastName : "",
    employeeId: typeof row.employeeId === "string" ? row.employeeId : "",
  };
}

function normalizeAssetRequest(raw: unknown): AssetRequestRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.requestType !== "string") {
    return null;
  }
  return {
    id: row.id,
    employeeId: typeof row.employeeId === "string" ? row.employeeId : "",
    submittedByEmployeeId:
      typeof row.submittedByEmployeeId === "string"
        ? row.submittedByEmployeeId
        : null,
    requestType: row.requestType,
    systemAssetId:
      typeof row.systemAssetId === "string" ? row.systemAssetId : null,
    categoryId: typeof row.categoryId === "string" ? row.categoryId : null,
    categoryName:
      typeof row.categoryName === "string" ? row.categoryName : null,
    newAssetDetails:
      typeof row.newAssetDetails === "string" ? row.newAssetDetails : null,
    status: typeof row.status === "string" ? row.status : "Open",
    requestedDate:
      typeof row.requestedDate === "string" ? row.requestedDate : null,
    updatedDate: typeof row.updatedDate === "string" ? row.updatedDate : null,
    requesterName:
      typeof row.requesterName === "string" ? row.requesterName : undefined,
    subjectName:
      typeof row.subjectName === "string" ? row.subjectName : undefined,
    requester: normalizePartyIdentity(row.requester),
    subject: normalizePartyIdentity(row.subject),
    ...normalizeDecision(row),
  };
}

function normalizeAssignedAsset(raw: unknown): AssignedAssetOption | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.systemAssetId !== "string") {
    return null;
  }
  const assetId =
    typeof row.assetId === "string" && row.assetId.trim()
      ? row.assetId
      : row.systemAssetId;
  return {
    systemAssetId: row.systemAssetId,
    assetId,
    categoryName:
      typeof row.categoryName === "string" ? row.categoryName : null,
  };
}

function normalizeAssetCatalogModel(
  raw: unknown,
): AssetCatalogModelOption | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const model = typeof row.model === "string" ? row.model.trim() : "";
  if (!model) {
    return null;
  }
  const specifications =
    typeof row.specifications === "string" ? row.specifications.trim() : "";
  const osPlatforms = Array.isArray(row.osPlatforms)
    ? row.osPlatforms.filter(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
    : [];
  const id =
    typeof row.id === "string" && row.id.trim()
      ? row.id.trim()
      : `${model}::${specifications}`;
  return { id, model, specifications, osPlatforms };
}

function normalizeAssetCatalog(raw: unknown): AssetCatalog | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const categoryId =
    typeof row.categoryId === "string" ? row.categoryId.trim() : "";
  const categoryName =
    typeof row.categoryName === "string" ? row.categoryName.trim() : "";
  if (!categoryId || !categoryName) {
    return null;
  }
  const models = Array.isArray(row.models)
    ? row.models
        .map(normalizeAssetCatalogModel)
        .filter((item): item is AssetCatalogModelOption => item !== null)
    : [];
  const osPlatforms = Array.isArray(row.osPlatforms)
    ? row.osPlatforms.filter(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
    : [];
  return { categoryId, categoryName, osPlatforms, models };
}

function normalizeAssetCategory(raw: unknown): AssetCategoryOption | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const categoryId =
    typeof row.categoryId === "string" ? row.categoryId.trim() : "";
  const categoryName =
    typeof row.categoryName === "string" ? row.categoryName.trim() : "";
  if (!categoryId || !categoryName) {
    return null;
  }
  return {
    categoryId,
    categoryName,
    ...(typeof row.inStockCount === "number"
      ? { inStockCount: row.inStockCount }
      : {}),
  };
}

function normalizeAvailableAsset(raw: unknown): AvailableAssetOption | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.systemAssetId !== "string") {
    return null;
  }
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  return {
    systemAssetId: row.systemAssetId,
    assetId: typeof row.assetId === "string" ? row.assetId : row.systemAssetId,
    model: text(row.model),
    serialNumber: text(row.serialNumber),
    osPlatform: text(row.osPlatform),
    specifications: text(row.specifications),
    condition: text(row.condition),
  };
}

function normalizeItRequest(raw: unknown): ItRequestRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.category !== "string") {
    return null;
  }
  return {
    id: row.id,
    employeeId: typeof row.employeeId === "string" ? row.employeeId : "",
    category: row.category,
    details: typeof row.details === "string" ? row.details : "",
    status: typeof row.status === "string" ? row.status : "Open",
    requestedDate:
      typeof row.requestedDate === "string" ? row.requestedDate : null,
    updatedDate: typeof row.updatedDate === "string" ? row.updatedDate : null,
    requesterName:
      typeof row.requesterName === "string" ? row.requesterName : undefined,
    ...normalizeDecision(row),
  };
}

export function createHttpEmployeePortalGateway(
  options: HttpEmployeePortalGatewayOptions,
): EmployeePortalGateway {
  const { request } = options;

  return {
    async getRequestHistory(kind, requestId) {
      try {
        return await request<unknown>(
          "GET",
          workflowHistoryPath(kind === "asset" ? "asset_request" : "profile_update", requestId),
        );
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async fetchManageCounts() {
      try {
        const raw = await request<unknown>("GET", "/me/manage/counts");
        const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        const count = (value: unknown) =>
          typeof value === "number" && value > 0 ? Math.floor(value) : 0;
        return {
          timesheets: count(row.timesheets),
          leaves: count(row.leaves),
          requests: count(row.requests),
        };
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async fetchManagingOption() {
      try {
        const raw = await request<unknown>("GET", "/me/managing-option");
        return normalizeManagingOption(raw);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listProfileUpdateRequests() {
      try {
        const raw = await request<unknown>("GET", "/me/profile-update-requests");
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeProfileUpdateRequest)
          .filter((row): row is ProfileUpdateRequestRecord => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async submitProfileUpdateRequest(input: SubmitProfileUpdateRequestInput) {
      try {
        let raw: unknown;
        if (input.shortDescription?.trim()) {
          if (input.attachment) {
            const form = new FormData();
            form.append("shortDescription", input.shortDescription.trim());
            form.append("longDescription", (input.longDescription ?? "").trim());
            if (input.resubmitOfId) {
              form.append("resubmitOfId", input.resubmitOfId);
            }
            if (input.requestedForEmployeeId?.trim()) {
              form.append(
                "requestedForEmployeeId",
                input.requestedForEmployeeId.trim(),
              );
            }
            form.append(
              "attachment",
              input.attachment as Blob,
              input.attachment.name || "attachment",
            );
            raw = await request<unknown>(
              "POST",
              "/me/profile-update-requests",
              form,
            );
          } else {
            const body: Record<string, string> = {
              shortDescription: input.shortDescription.trim(),
              longDescription: (input.longDescription ?? "").trim(),
            };
            if (input.resubmitOfId) {
              body.resubmitOfId = input.resubmitOfId;
            }
            if (input.requestedForEmployeeId?.trim()) {
              body.requestedForEmployeeId = input.requestedForEmployeeId.trim();
            }
            raw = await request<unknown>(
              "POST",
              "/me/profile-update-requests",
              body,
            );
          }
        } else if (input.fieldChanged && input.newValue !== undefined) {
          const fields: Record<string, string> = {
            fieldChanged: input.fieldChanged,
            newValue: input.newValue,
          };
          const reason = (input.longDescription ?? "").trim();
          if (reason) {
            fields.longDescription = reason;
          }
          if (input.requestedForEmployeeId?.trim()) {
            fields.requestedForEmployeeId = input.requestedForEmployeeId.trim();
          }
          if (input.resubmitOfId) {
            fields.resubmitOfId = input.resubmitOfId;
          }
          if (input.attachment) {
            const form = new FormData();
            for (const [key, value] of Object.entries(fields)) {
              form.append(key, value);
            }
            form.append(
              "attachment",
              input.attachment as Blob,
              input.attachment.name || "attachment",
            );
            raw = await request<unknown>("POST", "/me/profile-update-requests", form);
          } else {
            raw = await request<unknown>("POST", "/me/profile-update-requests", fields);
          }
        } else {
          throw new Error("shortDescription is required.");
        }
        const normalized = normalizeProfileUpdateRequest(raw);
        if (!normalized) {
          throw new Error("Unexpected profile update response.");
        }
        return normalized;
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async downloadProfileUpdateAttachment(requestId: string) {
      try {
        const id = requestId.trim();
        if (!id) {
          throw new Error("Request id is required.");
        }
        const blob = await request<Blob>(
          "GET",
          `/me/manage/profile-update-requests/${encodeURIComponent(id)}/attachment`,
          undefined,
          { responseType: "blob" },
        );
        return { blob, fileName: "supporting-document" };
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async downloadOwnProfileUpdateAttachment(requestId: string) {
      try {
        const id = requestId.trim();
        if (!id) {
          throw new Error("Request id is required.");
        }
        const blob = await request<Blob>(
          "GET",
          `/me/profile-update-requests/${encodeURIComponent(id)}/attachment`,
          undefined,
          { responseType: "blob" },
        );
        return { blob, fileName: "supporting-document" };
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listMyAssignedAssets(employeeId) {
      try {
        const query =
          employeeId && employeeId.trim()
            ? `?employeeId=${encodeURIComponent(employeeId.trim())}`
            : "";
        const raw = await request<unknown>(
          "GET",
          `/me/assigned-assets${query}`,
        );
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeAssignedAsset)
          .filter((row): row is AssignedAssetOption => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listAssetCategories() {
      try {
        const raw = await request<unknown>("GET", "/me/asset-categories");
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeAssetCategory)
          .filter((row): row is AssetCategoryOption => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listAssetCatalog(categoryId) {
      try {
        const trimmed = categoryId.trim();
        if (!trimmed) {
          return {
            categoryId: "",
            categoryName: "",
            osPlatforms: [],
            models: [],
          };
        }
        const raw = await request<unknown>(
          "GET",
          `/me/asset-catalog?categoryId=${encodeURIComponent(trimmed)}`,
        );
        const normalized = normalizeAssetCatalog(raw);
        if (!normalized) {
          throw new Error("Unexpected asset catalog response.");
        }
        return normalized;
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listAssetRequests() {
      try {
        const raw = await request<unknown>("GET", "/me/asset-requests");
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeAssetRequest)
          .filter((row): row is AssetRequestRecord => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async submitAssetRequest(input: SubmitAssetRequestInput) {
      try {
        const body: Record<string, string> = {
          requestType: input.requestType,
        };
        if (input.newAssetDetails?.trim()) {
          body.newAssetDetails = input.newAssetDetails.trim();
        }
        if (input.requestType === "new" && input.categoryId?.trim()) {
          body.categoryId = input.categoryId.trim();
        }
        if (input.requestType !== "new" && input.systemAssetId) {
          body.systemAssetId = input.systemAssetId;
        }
        if (input.requestedForEmployeeId?.trim()) {
          body.requestedForEmployeeId = input.requestedForEmployeeId.trim();
        }
        if (input.resubmitOfId) {
          body.resubmitOfId = input.resubmitOfId;
        }
        const raw = await request<unknown>("POST", "/me/asset-requests", body);
        const normalized = normalizeAssetRequest(raw);
        if (!normalized) {
          throw new Error("Unexpected asset request response.");
        }
        return normalized;
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listItRequests() {
      try {
        const raw = await request<unknown>("GET", "/me/it-requests");
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeItRequest)
          .filter((row): row is ItRequestRecord => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async submitItRequest(input: SubmitItRequestInput) {
      try {
        const raw = await request<unknown>("POST", "/me/it-requests", {
          category: input.category,
          details: input.details,
        });
        const normalized = normalizeItRequest(raw);
        if (!normalized) {
          throw new Error("Unexpected IT request response.");
        }
        return normalized;
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listManageProfileUpdateRequests() {
      try {
        const raw = await request<unknown>(
          "GET",
          "/me/manage/profile-update-requests",
        );
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeProfileUpdateRequest)
          .filter((row): row is ProfileUpdateRequestRecord => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listManageAssetRequests() {
      try {
        const raw = await request<unknown>("GET", "/me/manage/asset-requests");
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeAssetRequest)
          .filter((row): row is AssetRequestRecord => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listManageItRequests() {
      try {
        const raw = await request<unknown>("GET", "/me/manage/it-requests");
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeItRequest)
          .filter((row): row is ItRequestRecord => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async searchEmployees(query: string) {
      try {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
          return [];
        }
        const raw = await request<unknown>(
          "GET",
          `/me/employee-directory-search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeDirectoryHit)
          .filter((row): row is EmployeeDirectoryHit => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async completeProfileUpdateRequest(requestId, input = {}) {
      try {
        const body: Record<string, string> = {};
        if (input.changesSummary?.trim()) {
          body.changesSummary = input.changesSummary.trim();
        }
        const raw = await request<unknown>(
          "POST",
          `/me/manage/profile-update-requests/${encodeURIComponent(requestId)}/complete`,
          body,
        );
        const normalized = normalizeProfileUpdateRequest(raw);
        if (!normalized) {
          throw new Error("Unexpected complete profile update response.");
        }
        return normalized;
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async decideProfileUpdateRequest(requestId, input) {
      try {
        const body: Record<string, string> = { action: input.action };
        if (input.notes?.trim()) {
          body.notes = input.notes.trim();
        }
        const raw = await request<unknown>(
          "POST",
          `/me/manage/profile-update-requests/${encodeURIComponent(requestId)}/decide`,
          body,
        );
        const normalized = normalizeProfileUpdateRequest(raw);
        if (!normalized) {
          throw new Error("Unexpected decide profile update response.");
        }
        return normalized;
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async listAvailableAssetsForRequest(requestId) {
      try {
        const raw = await request<unknown>(
          "GET",
          `/me/manage/asset-requests/${encodeURIComponent(requestId)}/available-assets`,
        );
        if (!Array.isArray(raw)) {
          return [];
        }
        return raw
          .map(normalizeAvailableAsset)
          .filter((row): row is AvailableAssetOption => row !== null);
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },

    async decideAssetRequest(requestId, input: DecideAssetRequestInput) {
      try {
        const body: Record<string, string> = { action: input.action };
        if (input.notes?.trim()) {
          body.notes = input.notes.trim();
        }
        for (const key of [
          "assignSystemAssetId",
          "reasonForReturn",
          "conditionAtReturn",
          "reason",
        ] as const) {
          const value = input[key];
          if (value) {
            body[key] = value;
          }
        }
        const raw = await request<unknown>(
          "POST",
          `/me/manage/asset-requests/${encodeURIComponent(requestId)}/decide`,
          body,
        );
        const normalized = normalizeAssetRequest(raw);
        if (!normalized) {
          throw new Error("Unexpected decide asset request response.");
        }
        return normalized;
      } catch (error) {
        throw mapApiHttpError(error);
      }
    },
  };
}
