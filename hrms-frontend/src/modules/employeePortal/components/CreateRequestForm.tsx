"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import { osPlatformOptionsForCategory } from "@/modules/assets/constants";
import { COUNTRY_CODE_OPTIONS } from "@/modules/employees/constants";
import { minEmployeeDateOfBirth } from "@/modules/employees/employeeCatalog";
import { EmployeesSearchCombobox } from "@/modules/employees/components/EmployeesSearchCombobox";
import { formatIsoDateUs, isIsoDate } from "@/shared/isoDates";
import {
  AppButton,
  AppDateField,
  AppDetailPane,
  AppDetailSplit,
  AppFieldMessage,
  AppFileField,
  AppNotice,
  AppSectionCard,
  AppSelect,
  AppTextField,
  ConfirmDialogShell,
  localIsoToday,
} from "@/shared/ui";
import {
  CREATE_REQUEST_TYPE_OPTIONS,
  PROFILE_UPDATE_FIELD_OPTIONS,
  REQUEST_FOR_OPTIONS,
} from "../constants";
import {
  formatNewAssetRequestDetails,
  isNameOnlyCaseOrSpaceChange,
  type MyRequestRow,
} from "../myRequests";
import type {
  AssetCatalog,
  AssetCategoryOption,
  AssetRequestTypeId,
  AssignedAssetOption,
  EmployeeDirectoryHit,
  EmployeePortalGateway,
  EmployeePortalProfileSnapshot,
  ProfileUpdateFieldId,
} from "../types";
import { formatRequestDay } from "./MyRequestCard";

type RequestKind = "profile" | "asset";
type FieldChoice = ProfileUpdateFieldId | "other";

const FIELD_OPTIONS = [
  ...PROFILE_UPDATE_FIELD_OPTIONS,
  { value: "other", label: "Something else" },
];

const ASSET_KIND_OPTIONS: readonly { value: AssetRequestTypeId; label: string }[] = [
  { value: "swap", label: "Swap an asset I have" },
  { value: "reportLostStolen", label: "Report an asset lost or stolen" },
  { value: "new", label: "A new asset" },
];

/** Match the shared AppSelect height and text size. */
const SEARCH_BOX_CLASS = "!h-[2.45rem] !min-h-[2.45rem] !px-[0.6rem] !text-[0.9rem]";

const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.txt,application/pdf,image/*";

function isAssetRequestType(value: string): value is AssetRequestTypeId {
  return value === "new" || value === "swap" || value === "reportLostStolen";
}

function isFieldChoice(value: string): value is FieldChoice {
  return FIELD_OPTIONS.some((option) => option.value === value);
}

function isAssetKind(value: string): value is AssetRequestTypeId {
  return ASSET_KIND_OPTIONS.some((option) => option.value === value);
}

function countryLabel(code: string): string {
  const trimmed = code.trim();
  return COUNTRY_CODE_OPTIONS.find((option) => option.value === trimmed)?.label ?? trimmed;
}

/** Current value of a profile field, as the employee would read it. */
function currentFieldValue(
  profile: EmployeePortalProfileSnapshot | null,
  field: ProfileUpdateFieldId,
): string {
  if (!profile) {
    return "";
  }
  switch (field) {
    case "firstName":
      return profile.firstName.trim();
    case "lastName":
      return profile.lastName.trim();
    case "dateOfBirth":
      return isIsoDate(profile.dateOfBirth) ? formatIsoDateUs(profile.dateOfBirth) : profile.dateOfBirth.trim();
    case "nationality":
      return countryLabel(profile.nationality);
    default:
      return "";
  }
}

function newValueText(field: ProfileUpdateFieldId, value: string): string {
  if (field === "nationality") {
    return countryLabel(value);
  }
  if (field === "dateOfBirth" && isIsoDate(value)) {
    return formatIsoDateUs(value);
  }
  return value.trim();
}

function fieldLabel(field: ProfileUpdateFieldId): string {
  return PROFILE_UPDATE_FIELD_OPTIONS.find((option) => option.value === field)?.label ?? field;
}

function Field({ children }: { readonly children: ReactNode }) {
  return <div className="grid min-w-0 content-start gap-[0.3rem]">{children}</div>;
}

export interface CreateRequestFormProps {
  readonly gateway?: EmployeePortalGateway | null;
  readonly profile?: EmployeePortalProfileSnapshot | null;
  /** Your submitted requests, to warn about duplicates. */
  readonly existingRequests?: readonly MyRequestRow[];
  readonly onCancel: () => void;
  readonly onSubmitted: () => void;
  /** Opens an existing request (from the duplicate warning). */
  readonly onViewRequest?: (request: MyRequestRow) => void;
  /** A rejected request to send again: its details are filled in and the two stay linked. */
  readonly resubmitFrom?: MyRequestRow | null;
}

/** Self → Requests → New request: fill in the details, review, then send to HR. */
export function CreateRequestForm({
  gateway = null,
  profile = null,
  existingRequests = [],
  onCancel,
  onSubmitted,
  onViewRequest,
  resubmitFrom = null,
}: CreateRequestFormProps) {
  const seed = resubmitFrom;
  const seedForOther = Boolean(
    seed?.subjectEmployeeId && seed.subjectEmployeeId !== seed.requesterEmployeeId,
  );
  const [requestType, setRequestType] = useState<RequestKind | "">(
    seed ? (seed.kind === "asset" ? "asset" : "profile") : "",
  );
  const [requestFor, setRequestFor] = useState<"myself" | "someoneElse">(
    seedForOther ? "someoneElse" : "myself",
  );
  const [subjectId, setSubjectId] = useState(seedForOther ? (seed?.subjectEmployeeId ?? "") : "");
  const [directoryHits, setDirectoryHits] = useState<readonly EmployeeDirectoryHit[]>(
    seedForOther && seed?.subjectEmployeeId
      ? [
          {
            id: seed.subjectEmployeeId,
            firstName: seed.subject?.firstName ?? seed.subjectName,
            lastName: seed.subject?.lastName ?? "",
            employeeId: seed.subject?.businessEmployeeId ?? "",
          },
        ]
      : [],
  );
  const [directoryQuery, setDirectoryQuery] = useState("");

  const seedIsProfile = seed?.kind === "profileUpdate";
  const [fieldChoice, setFieldChoice] = useState<FieldChoice | "">(
    seedIsProfile
      ? seed.fieldChanged && seed.fieldChanged !== "general" && isFieldChoice(seed.fieldChanged)
        ? seed.fieldChanged
        : "other"
      : "",
  );
  const [newValue, setNewValue] = useState(seedIsProfile ? (seed.rawNewValue ?? "") : "");
  const [shortDescription, setShortDescription] = useState(
    seedIsProfile && seed.fieldChanged === "general" ? seed.title : "",
  );
  const [reason, setReason] = useState(seedIsProfile ? (seed.longDescription ?? "") : "");
  const [attachment, setAttachment] = useState<File | null>(null);

  const seedIsAsset = seed?.kind === "asset";
  const [assetKind, setAssetKind] = useState<AssetRequestTypeId | "">(
    seedIsAsset && seed.assetRequestType && isAssetRequestType(seed.assetRequestType)
      ? seed.assetRequestType
      : "",
  );
  const [systemAssetId, setSystemAssetId] = useState(seedIsAsset ? (seed.systemAssetId ?? "") : "");
  const [assignedAssets, setAssignedAssets] = useState<readonly AssignedAssetOption[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetReason, setAssetReason] = useState(
    seedIsAsset && seed.assetRequestType !== "new" ? (seed.longDescription ?? "") : "",
  );
  const [assetCategories, setAssetCategories] = useState<readonly AssetCategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [assetCategoryId, setAssetCategoryId] = useState(
    seedIsAsset && seed.assetRequestType === "new" ? (seed.categoryId ?? "") : "",
  );
  const [assetCatalog, setAssetCatalog] = useState<AssetCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [assetModelId, setAssetModelId] = useState("");
  const [assetOsPlatform, setAssetOsPlatform] = useState("");
  const [assetNotes, setAssetNotes] = useState(
    seedIsAsset && seed.assetRequestType === "new" ? seed.summary : "",
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Anything typed or chosen beyond the defaults; Cancel then asks first.
  const hasInput = Boolean(
    requestType ||
      requestFor !== "myself" ||
      subjectId ||
      fieldChoice ||
      newValue.trim() ||
      shortDescription.trim() ||
      reason.trim() ||
      attachment ||
      assetKind ||
      systemAssetId ||
      assetReason.trim() ||
      assetCategoryId ||
      assetModelId ||
      assetOsPlatform ||
      assetNotes.trim(),
  );

  function handleCancel() {
    if (hasInput) {
      setDiscardOpen(true);
      return;
    }
    onCancel();
  }

  const forSomeoneElse = requestFor === "someoneElse";
  const structuredField = fieldChoice && fieldChoice !== "other" ? fieldChoice : null;

  const employeeOptions = useMemo(
    () =>
      directoryHits.map((hit) => {
        const name = `${hit.firstName} ${hit.lastName}`.trim();
        return {
          value: hit.id,
          label: name ? (hit.employeeId ? `${name} · ${hit.employeeId}` : name) : hit.employeeId || hit.id,
        };
      }),
    [directoryHits],
  );
  const subjectLabel = forSomeoneElse
    ? (employeeOptions.find((option) => option.value === subjectId)?.label ?? "")
    : [`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim(), profile?.employeeId?.trim()]
        .filter(Boolean)
        .join(" · ") || "Myself";

  const currentValue =
    structuredField && !forSomeoneElse ? currentFieldValue(profile, structuredField) : "";

  const duplicate = useMemo(() => {
    const pending = existingRequests.filter((row) => row.statusLabel === "Pending");
    const sameSubject = (row: MyRequestRow) =>
      forSomeoneElse
        ? row.subjectEmployeeId === subjectId
        : !row.subjectEmployeeId || row.subjectEmployeeId === row.requesterEmployeeId;
    if (requestType === "profile" && structuredField) {
      return (
        pending.find(
          (row) =>
            row.kind === "profileUpdate" &&
            row.fieldChanged === structuredField &&
            sameSubject(row),
        ) ?? null
      );
    }
    if (requestType === "asset" && assetKind !== "new" && systemAssetId) {
      return (
        pending.find(
          (row) =>
            row.kind === "asset" &&
            row.assetRequestType === assetKind &&
            row.systemAssetId === systemAssetId,
        ) ?? null
      );
    }
    return null;
  }, [assetKind, existingRequests, forSomeoneElse, requestType, structuredField, subjectId, systemAssetId]);

  const duplicateText = duplicate
    ? requestType === "profile" && structuredField
      ? `You already have a pending request to change ${fieldLabel(structuredField).toLowerCase()} (${formatRequestDay(duplicate.requestedDate)}).`
      : `You already have a pending request for this asset (${formatRequestDay(duplicate.requestedDate)}).`
    : null;

  // ---- Asset data (same sources as before) ----
  const outOfStockCategories = useMemo(
    () =>
      new Set(
        assetCategories
          .filter((category) => category.inStockCount === 0)
          .map((category) => category.categoryName),
      ),
    [assetCategories],
  );
  const assetOptions = useMemo(
    () =>
      assignedAssets.map((asset) => {
        // Swapping needs a replacement, so an asset whose category is out of stock waits.
        const noReplacement =
          assetKind === "swap" &&
          asset.categoryName !== null &&
          outOfStockCategories.has(asset.categoryName);
        return {
          value: asset.systemAssetId,
          label: asset.categoryName ? `${asset.assetId} · ${asset.categoryName}` : asset.assetId,
          ...(noReplacement
            ? {
                disabled: true,
                meta: "No replacement in stock",
                hint: "No replacement is in stock right now. Ask the asset team to add stock.",
              }
            : {}),
        };
      }),
    [assetKind, assignedAssets, outOfStockCategories],
  );
  const categoryOptions = useMemo(
    () =>
      assetCategories.map((category) => ({
        value: category.categoryId,
        label: category.categoryName,
        ...(category.inStockCount === 0
          ? {
              disabled: true,
              meta: "Out of stock",
              hint: "None in stock right now. Ask the asset team to add stock.",
            }
          : {}),
      })),
    [assetCategories],
  );
  const selectedCategoryName =
    assetCategories.find((category) => category.categoryId === assetCategoryId)?.categoryName ??
    assetCatalog?.categoryName ??
    "";
  const selectedModel = assetCatalog?.models.find((model) => model.id === assetModelId) ?? null;
  const modelOptions = useMemo(() => {
    const models = assetCatalog?.models ?? [];
    return models
      .filter(
        (model) =>
          !assetOsPlatform || model.osPlatforms.length === 0 || model.osPlatforms.includes(assetOsPlatform),
      )
      .map((model) => ({
        value: model.id,
        label: model.model,
        meta: model.specifications || undefined,
      }));
  }, [assetCatalog?.models, assetOsPlatform]);
  const osOptions = useMemo(() => {
    const fromModel = selectedModel?.osPlatforms ?? [];
    const fromCatalog = assetCatalog?.osPlatforms ?? [];
    const values =
      fromModel.length > 0
        ? fromModel
        : fromCatalog.length > 0
          ? fromCatalog
          : osPlatformOptionsForCategory(selectedCategoryName);
    return values.map((value) => ({ value, label: value }));
  }, [assetCatalog?.osPlatforms, selectedCategoryName, selectedModel?.osPlatforms]);

  const searchDirectory = useCallback(
    async (query: string) => {
      setDirectoryQuery(query);
      if (!gateway || query.trim().length < 2) {
        setDirectoryHits((hits) => hits.filter((hit) => hit.id === subjectId));
        return;
      }
      try {
        setDirectoryHits(await gateway.searchEmployees(query.trim()));
      } catch {
        setDirectoryHits([]);
      }
    },
    [gateway, subjectId],
  );

  useEffect(() => {
    // A swap needs the categories too, to know if a replacement is in stock.
    if (requestType !== "asset" || (assetKind !== "new" && assetKind !== "swap") || !gateway) {
      return;
    }
    let cancelled = false;
    setCategoriesLoading(true);
    gateway
      .listAssetCategories()
      .then((rows) => !cancelled && setAssetCategories(rows))
      .catch(() => !cancelled && setAssetCategories([]))
      .finally(() => !cancelled && setCategoriesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [assetKind, gateway, requestType]);

  useEffect(() => {
    if (requestType !== "asset" || assetKind !== "new" || !assetCategoryId || !gateway) {
      setAssetCatalog(null);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    gateway
      .listAssetCatalog(assetCategoryId)
      .then((catalog) => !cancelled && setAssetCatalog(catalog))
      .catch(() => !cancelled && setAssetCatalog(null))
      .finally(() => !cancelled && setCatalogLoading(false));
    return () => {
      cancelled = true;
    };
  }, [assetCategoryId, assetKind, gateway, requestType]);

  useEffect(() => {
    const needsAssets = requestType === "asset" && (assetKind === "swap" || assetKind === "reportLostStolen");
    if (!needsAssets || !gateway || (forSomeoneElse && !subjectId)) {
      setAssignedAssets([]);
      setAssetsLoading(false);
      return;
    }
    let cancelled = false;
    setAssetsLoading(true);
    gateway
      .listMyAssignedAssets(forSomeoneElse ? subjectId : undefined)
      .then((rows) => !cancelled && setAssignedAssets(rows))
      .catch(() => !cancelled && setAssignedAssets([]))
      .finally(() => !cancelled && setAssetsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [assetKind, forSomeoneElse, gateway, requestType, subjectId]);

  function clearError(key: string) {
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
    setActionError(null);
  }

  function newAssetDetails(): string {
    return formatNewAssetRequestDetails({
      categoryName: selectedCategoryName,
      model: selectedModel?.model ?? "",
      osPlatform: assetOsPlatform,
      specifications: selectedModel?.specifications ?? "",
      notes: assetNotes,
    });
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!requestType) {
      next.requestType = "Select a request type.";
    }
    if (forSomeoneElse && !subjectId) {
      next.subject = "Search for and select the employee.";
    }
    if (requestType === "profile") {
      if (!fieldChoice) {
        next.field = "Select what needs to change.";
      } else if (fieldChoice === "other") {
        if (!shortDescription.trim()) {
          next.shortDescription = "Describe what needs to change.";
        }
      } else if (!newValue.trim()) {
        next.newValue = `Enter the new ${fieldLabel(fieldChoice).toLowerCase()}.`;
      } else if (
        !forSomeoneElse &&
        (fieldChoice === "firstName" || fieldChoice === "lastName"
          ? isNameOnlyCaseOrSpaceChange(currentValue, newValue)
          : newValueText(fieldChoice, newValue) === currentValue)
      ) {
        next.newValue = "This is the same as the current value.";
      }
    }
    if (requestType === "asset") {
      if (!assetKind) {
        next.assetKind = "Select what you need.";
      } else if (assetKind === "new") {
        if (!assetCategoryId) {
          next.assetCategory = "Select a category.";
        }
        if ((assetCatalog?.models.length ?? 0) > 0 && !assetModelId) {
          next.assetModel = "Select a model.";
        }
        if (osOptions.length > 0 && !assetOsPlatform) {
          next.assetOs = "Select an OS type.";
        }
        if (newAssetDetails().length > 255) {
          next.assetNotes = "Model, OS and notes together must be at most 255 characters.";
        }
      } else {
        if (!systemAssetId) {
          next.systemAssetId = "Select the asset.";
        }
        if (!assetReason.trim()) {
          next.assetReason =
            assetKind === "swap"
              ? "Explain why the asset needs swapping."
              : "Describe when and how it was lost or stolen.";
        }
      }
    }
    return next;
  }

  function openReview() {
    const next = validate();
    setErrors(next);
    setActionError(null);
    setReviewOpen(Object.keys(next).length === 0);
  }

  function handleSubmit() {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length === 0) {
      void submit();
    } else {
      setActionError("Something changed. Fix the highlighted fields on the left.");
    }
  }

  async function submit() {
    if (!gateway) {
      setActionError("Requests are unavailable right now.");
      return;
    }
    setBusy(true);
    setActionError(null);
    const requestedForEmployeeId = forSomeoneElse ? subjectId : undefined;
    const resubmitOfId = resubmitFrom?.requestId;
    try {
      if (requestType === "profile") {
        await gateway.submitProfileUpdateRequest(
          structuredField
            ? {
                fieldChanged: structuredField,
                newValue: newValue.trim(),
                longDescription: reason.trim() || undefined,
                requestedForEmployeeId,
                attachment: attachment ?? undefined,
                resubmitOfId,
              }
            : {
                shortDescription: shortDescription.trim(),
                longDescription: reason.trim(),
                requestedForEmployeeId,
                attachment: attachment ?? undefined,
                resubmitOfId,
              },
        );
      } else if (requestType === "asset" && assetKind) {
        await gateway.submitAssetRequest(
          assetKind === "new"
            ? {
                requestType: "new",
                categoryId: assetCategoryId,
                newAssetDetails: newAssetDetails(),
                requestedForEmployeeId,
                resubmitOfId,
              }
            : {
                requestType: assetKind,
                systemAssetId,
                newAssetDetails: assetReason.trim(),
                requestedForEmployeeId,
                resubmitOfId,
              },
        );
      }
      onSubmitted();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Live summary (right column) ----
  const notYet = <span className="font-normal italic text-emp-muted">Not filled in yet</span>;
  const orNotYet = (value: string): ReactNode => (value.trim() ? value.trim() : notYet);
  const summaryRows: { label: string; value: ReactNode }[] = [
    { label: "Type", value: requestType === "asset" ? "Asset request" : "Profile update" },
    { label: "For", value: orNotYet(subjectLabel) },
  ];
  if (requestType === "profile") {
    if (structuredField) {
      summaryRows.push({
        label: "Change",
        value: (
          <>
            {fieldLabel(structuredField)}:{" "}
            {currentValue ? <s className="text-emp-muted">{currentValue}</s> : null}
            {currentValue ? " → " : ""}
            {newValue.trim() ? <b>{newValueText(structuredField, newValue)}</b> : notYet}
          </>
        ),
      });
    } else {
      summaryRows.push({ label: "Summary", value: fieldChoice ? orNotYet(shortDescription) : notYet });
    }
    if (reason.trim()) {
      summaryRows.push({ label: "Reason", value: reason.trim() });
    }
    summaryRows.push({ label: "Document", value: attachment?.name ?? "None" });
  } else if (requestType === "asset") {
    summaryRows.push({
      label: "Need",
      value: orNotYet(ASSET_KIND_OPTIONS.find((option) => option.value === assetKind)?.label ?? ""),
    });
    if (assetKind === "new") {
      summaryRows.push({ label: "Asset", value: orNotYet(newAssetDetails() || selectedCategoryName) });
    } else {
      summaryRows.push({
        label: "Asset",
        value: orNotYet(assetOptions.find((option) => option.value === systemAssetId)?.label ?? ""),
      });
      summaryRows.push({ label: "Reason", value: orNotYet(assetReason) });
    }
  }

  const summaryPane = (
    <AppDetailPane title="Review your request" onClose={() => setReviewOpen(false)}>
      <div className="grid gap-4">
        <dl
          aria-label="Request summary"
          className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-[0.88rem]"
        >
          {summaryRows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-emp-muted">{row.label}</dt>
              <dd className="m-0 font-semibold [overflow-wrap:anywhere]">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="m-0 flex items-start gap-2 border-0 border-t border-solid border-emp-line pt-3 text-[0.85rem] leading-normal text-emp-muted">
          <Info size={15} strokeWidth={1.9} aria-hidden="true" className="mt-[0.1rem] shrink-0" />
          <span>
            {requestType === "asset"
              ? "The asset manager is notified when you send this. Nothing changes until they approve it, and you can follow it on My requests."
              : "HR is notified when you send this. Nothing changes until HR approves it, and you can follow it on My requests."}
          </span>
        </p>
        {actionError ? <AppNotice tone="error">{actionError}</AppNotice> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <AppButton disabled={busy || !gateway} onClick={handleSubmit}>
            {busy ? "Submitting…" : "Submit request"}
          </AppButton>
        </div>
      </div>
    </AppDetailPane>
  );

  return (
    <AppSectionCard
      title="New request"
      description={
        reviewOpen
          ? "Check the summary on the right, then submit. You can still change the form."
          : "Fill in what you need, then review it before you submit."
      }
    >
      <AppDetailSplit open={reviewOpen} pane={summaryPane}>
        <div className="grid gap-4">
          <div className="grid gap-4 min-[48rem]:grid-cols-2">
            <Field>
              <AppSelect
                label="Request type"
                required
                value={requestType}
                placeholder="Select request type"
                options={[...CREATE_REQUEST_TYPE_OPTIONS]}
                onChange={(value) => {
                  if (value === "profile" || value === "asset") {
                    setRequestType(value);
                    clearError("requestType");
                  }
                }}
              />
              {errors.requestType ? <AppFieldMessage tone="error">{errors.requestType}</AppFieldMessage> : null}
            </Field>
            <Field>
              <AppSelect
                label="Request for"
                required
                value={requestFor}
                options={[...REQUEST_FOR_OPTIONS]}
                onChange={(value) => {
                  if (value === "myself" || value === "someoneElse") {
                    setRequestFor(value);
                    setSubjectId("");
                    setSystemAssetId("");
                    clearError("subject");
                  }
                }}
              />
            </Field>
          </div>

          {forSomeoneElse ? (
            <Field>
              <span className="text-[0.85rem] font-semibold text-emp-muted">
                Employee<span className="ml-[0.22em] font-bold text-emp-critical" aria-hidden="true">*</span>
              </span>
              <EmployeesSearchCombobox
                inputClassName={SEARCH_BOX_CLASS}
                value={subjectId}
                options={employeeOptions}
                allowEmpty
                requireQueryToShowResults
                placeholder="Search by name or employee ID"
                aria-label="Employee this request is for"
                onQueryChange={(query) => void searchDirectory(query)}
                onChange={(value) => {
                  setSubjectId(value);
                  setSystemAssetId("");
                  clearError("subject");
                }}
              />
              {errors.subject ? (
                <AppFieldMessage tone="error">{errors.subject}</AppFieldMessage>
              ) : directoryQuery.trim().length === 1 ? (
                <AppFieldMessage>Type at least 2 characters.</AppFieldMessage>
              ) : null}
            </Field>
          ) : null}

          {requestType === "profile" ? (
            <>
              <Field>
                <AppSelect
                  label="What needs to change?"
                  required
                  value={fieldChoice}
                  placeholder="Select what needs to change"
                  options={FIELD_OPTIONS}
                  onChange={(value) => {
                    if (isFieldChoice(value)) {
                      setFieldChoice(value);
                      setNewValue("");
                      clearError("field");
                      clearError("newValue");
                    }
                  }}
                />
                {errors.field ? <AppFieldMessage tone="error">{errors.field}</AppFieldMessage> : null}
                {duplicateText && duplicate ? (
                  <AppFieldMessage tone="warning">
                    {duplicateText}{" "}
                    {onViewRequest ? (
                      <button
                        type="button"
                        className="cursor-pointer border-0 bg-transparent p-0 text-current underline"
                        onClick={() => onViewRequest(duplicate)}
                      >
                        View it
                      </button>
                    ) : null}
                  </AppFieldMessage>
                ) : null}
              </Field>

              {structuredField ? (
                <div className="grid items-start gap-3 min-[40rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <AppTextField
                    label="Current value"
                    value={forSomeoneElse ? "" : currentValue || "Not set"}
                    placeholder="HR sees their current value"
                    disabled
                    onChange={() => undefined}
                  />
                  <span aria-hidden="true" className="hidden pt-[1.9rem] font-bold text-emp-muted min-[40rem]:block">
                    →
                  </span>
                  <Field>
                    {structuredField === "dateOfBirth" ? (
                      <AppDateField
                        label="New date of birth"
                        value={newValue}
                        minDate={minEmployeeDateOfBirth()}
                        maxDate={localIsoToday()}
                        invalid={Boolean(errors.newValue)}
                        onChange={(value) => {
                          setNewValue(value);
                          clearError("newValue");
                        }}
                      />
                    ) : structuredField === "nationality" ? (
                      <>
                        <span className="text-[0.85rem] font-semibold text-emp-muted">
                          New nationality
                          <span className="ml-[0.22em] font-bold text-emp-critical" aria-hidden="true">*</span>
                        </span>
                        <EmployeesSearchCombobox
                inputClassName={SEARCH_BOX_CLASS}
                          value={newValue}
                          options={[...COUNTRY_CODE_OPTIONS]}
                          allowEmpty={false}
                          placeholder="Type to search countries"
                          emptyLabel="Select nationality"
                          noMatchesMessage="No matching countries"
                          aria-label="New nationality"
                          onChange={(value) => {
                            setNewValue(value);
                            clearError("newValue");
                          }}
                        />
                      </>
                    ) : (
                      <AppTextField
                        label={`New ${fieldLabel(structuredField).toLowerCase()}`}
                        required
                        value={newValue}
                        maxLength={255}
                        invalid={Boolean(errors.newValue)}
                        onChange={(value) => {
                          setNewValue(value);
                          clearError("newValue");
                        }}
                      />
                    )}
                    {errors.newValue ? <AppFieldMessage tone="error">{errors.newValue}</AppFieldMessage> : null}
                  </Field>
                </div>
              ) : null}

              {fieldChoice === "other" ? (
                <Field>
                  <AppTextField
                    label="Short description"
                    required
                    value={shortDescription}
                    placeholder="e.g. Update emergency contact"
                    maxLength={255}
                    invalid={Boolean(errors.shortDescription)}
                    onChange={(value) => {
                      setShortDescription(value);
                      clearError("shortDescription");
                    }}
                  />
                  {errors.shortDescription ? (
                    <AppFieldMessage tone="error">{errors.shortDescription}</AppFieldMessage>
                  ) : null}
                </Field>
              ) : null}

              {fieldChoice ? (
                <>
                  <AppTextField
                    label={fieldChoice === "other" ? "Details (optional)" : "Reason (optional)"}
                    multiline
                    rows={3}
                    value={reason}
                    maxLength={1000}
                    placeholder="Anything HR needs to know to review this"
                    onChange={setReason}
                  />
                  <AppFileField
                    label="Supporting document (optional)"
                    accept={DOCUMENT_ACCEPT}
                    fileName={attachment?.name ?? null}
                    hint="PDF, Word, Excel or image, for HR to check with this request."
                    onChange={setAttachment}
                  />
                </>
              ) : null}
            </>
          ) : null}

          {requestType === "asset" ? (
            <>
              <Field>
                <AppSelect
                  label="What do you need?"
                  required
                  value={assetKind}
                  placeholder="Select what you need"
                  options={[...ASSET_KIND_OPTIONS]}
                  onChange={(value) => {
                    if (isAssetKind(value)) {
                      setAssetKind(value);
                      setSystemAssetId("");
                      clearError("assetKind");
                    }
                  }}
                />
                {errors.assetKind ? <AppFieldMessage tone="error">{errors.assetKind}</AppFieldMessage> : null}
              </Field>

              {assetKind === "swap" || assetKind === "reportLostStolen" ? (
                <>
                  <Field>
                    <AppSelect
                      label="Which asset?"
                      required
                      value={systemAssetId}
                      placeholder={
                        assetsLoading
                          ? "Loading assets…"
                          : forSomeoneElse && !subjectId
                            ? "Select the employee first"
                            : "Select the asset"
                      }
                      disabled={assetsLoading || assetOptions.length === 0}
                      options={assetOptions}
                      onChange={(value) => {
                        setSystemAssetId(value);
                        clearError("systemAssetId");
                      }}
                    />
                    {errors.systemAssetId ? (
                      <AppFieldMessage tone="error">{errors.systemAssetId}</AppFieldMessage>
                    ) : !assetsLoading && assetOptions.length === 0 && (!forSomeoneElse || subjectId) ? (
                      <AppFieldMessage>No assets are assigned {forSomeoneElse ? "to this employee" : "to you"}.</AppFieldMessage>
                    ) : (
                      <AppFieldMessage>
                        Only assets assigned {forSomeoneElse ? "to this employee" : "to you"} are listed.
                      </AppFieldMessage>
                    )}
                    {duplicateText && duplicate ? (
                      <AppFieldMessage tone="warning">
                        {duplicateText}{" "}
                        {onViewRequest ? (
                          <button
                            type="button"
                            className="cursor-pointer border-0 bg-transparent p-0 text-current underline"
                            onClick={() => onViewRequest(duplicate)}
                          >
                            View it
                          </button>
                        ) : null}
                      </AppFieldMessage>
                    ) : null}
                  </Field>
                  <Field>
                    <AppTextField
                      label="Reason"
                      required
                      multiline
                      rows={3}
                      maxLength={255}
                      value={assetReason}
                      invalid={Boolean(errors.assetReason)}
                      placeholder={
                        assetKind === "swap"
                          ? "What's wrong with it?"
                          : "When and where was it lost or stolen?"
                      }
                      onChange={(value) => {
                        setAssetReason(value);
                        clearError("assetReason");
                      }}
                    />
                    {errors.assetReason ? <AppFieldMessage tone="error">{errors.assetReason}</AppFieldMessage> : null}
                  </Field>
                </>
              ) : null}

              {assetKind === "new" ? (
                <>
                  <div className="grid gap-4 min-[48rem]:grid-cols-2">
                    <Field>
                      <AppSelect
                        label="Category"
                        required
                        value={assetCategoryId}
                        placeholder={categoriesLoading ? "Loading categories…" : "Select category"}
                        disabled={categoriesLoading || categoryOptions.length === 0}
                        options={categoryOptions}
                        onChange={(value) => {
                          setAssetCategoryId(value);
                          setAssetModelId("");
                          setAssetOsPlatform("");
                          clearError("assetCategory");
                        }}
                      />
                      {errors.assetCategory ? (
                        <AppFieldMessage tone="error">{errors.assetCategory}</AppFieldMessage>
                      ) : !categoriesLoading && categoryOptions.length === 0 ? (
                        <AppFieldMessage>No asset categories yet. Ask HR to set up the asset catalog.</AppFieldMessage>
                      ) : null}
                    </Field>
                    {assetCategoryId && osOptions.length > 0 ? (
                      <Field>
                        <AppSelect
                          label="OS type"
                          required
                          value={assetOsPlatform}
                          placeholder={catalogLoading ? "Loading…" : "Select OS"}
                          disabled={catalogLoading}
                          options={osOptions}
                          onChange={(value) => {
                            setAssetOsPlatform(value);
                            clearError("assetOs");
                          }}
                        />
                        {errors.assetOs ? <AppFieldMessage tone="error">{errors.assetOs}</AppFieldMessage> : null}
                      </Field>
                    ) : null}
                  </div>
                  {assetCategoryId ? (
                    <Field>
                      <AppSelect
                        label="Model"
                        required={(assetCatalog?.models.length ?? 0) > 0}
                        wideMenu
                        value={assetModelId}
                        placeholder={
                          catalogLoading
                            ? "Loading models…"
                            : modelOptions.length === 0
                              ? "No models in inventory for this category"
                              : "Select model"
                        }
                        disabled={catalogLoading || modelOptions.length === 0}
                        options={modelOptions}
                        onChange={(value) => {
                          setAssetModelId(value);
                          const model = assetCatalog?.models.find((row) => row.id === value);
                          if (model?.osPlatforms.length === 1) {
                            setAssetOsPlatform(model.osPlatforms[0] ?? "");
                          }
                          clearError("assetModel");
                        }}
                      />
                      {errors.assetModel ? (
                        <AppFieldMessage tone="error">{errors.assetModel}</AppFieldMessage>
                      ) : selectedModel?.specifications ? (
                        <AppFieldMessage>{selectedModel.specifications}</AppFieldMessage>
                      ) : null}
                    </Field>
                  ) : null}
                  <Field>
                    <AppTextField
                      label="Notes (optional)"
                      multiline
                      rows={3}
                      maxLength={200}
                      value={assetNotes}
                      invalid={Boolean(errors.assetNotes)}
                      placeholder="Why you need it, or anything HR should know"
                      onChange={(value) => {
                        setAssetNotes(value);
                        clearError("assetNotes");
                      }}
                    />
                    {errors.assetNotes ? <AppFieldMessage tone="error">{errors.assetNotes}</AppFieldMessage> : null}
                  </Field>
                </>
              ) : null}
            </>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <AppButton variant="secondary" disabled={busy} onClick={handleCancel}>
              Cancel
            </AppButton>
            {reviewOpen ? null : (
              <AppButton disabled={!gateway} onClick={openReview}>
                Review request
              </AppButton>
            )}
          </div>
        </div>
      </AppDetailSplit>
      <ConfirmDialogShell
        open={discardOpen}
        title="Discard this request?"
        description="It hasn't been submitted, so the details you entered will be lost."
        confirmLabel="Discard request"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          setDiscardOpen(false);
          onCancel();
        }}
        onClose={() => setDiscardOpen(false)}
      />
    </AppSectionCard>
  );
}
