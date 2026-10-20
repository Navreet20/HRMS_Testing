"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";

import { useSearchParams } from "next/navigation";

import { KeepMounted, mutationErrorMessage } from "@/shared";
import { downloadBlob } from "@/shared/export";
import {
  buildProfileUpdateCompletionSummary,
  describeEmployeeProfileChanges,
} from "@/modules/employeePortal/profileUpdateCompletion";
import { readAssetStickerQueryParam } from "@/modules/assets/selectors";
import {
  normalizeEmployeeRecord,
} from "@/shared/live";
import { createDefaultActor, DEFAULT_EMPLOYEES_THEME, EMPTY_EMPLOYEES_DATA, EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED, EMPLOYEE_ONBOARDING_HANDOFF_ENABLED, type WizardStepId } from "./constants";
import { CreateEmployeePanel } from "./components/CreateEmployeePanel";
import { DeactivateEmployeeDialog } from "./components/DeactivateEmployeeDialog";
import { HardDeleteEmployeeDialog } from "./components/HardDeleteEmployeeDialog";
import { EmployeeDirectory } from "./components/EmployeeDirectory";
import { EmployeesInviteSuccessDialog } from "./components/EmployeesInviteSuccessDialog";
import { EmployeesProfileNoticeDialog } from "./components/EmployeesProfileNoticeDialog";
import {
  SkillCertificatePreviewDialog,
  type SkillCertificatePreview,
} from "./components/SkillCertificatePreviewDialog";
import { PendingApprovals } from "./components/PendingApprovals";
import { ReportingManagerSearchContext } from "./components/reportingManagerSearch";
import { useEmployeeSearch } from "./hooks/useEmployeeSearch";
import { CorrectionRequestsPanel } from "./components/CorrectionRequestsPanel";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";
import { SystemAccountPanel } from "./components/SystemAccountPanel";
import type {
  OnboardingPacketItem,
  OnboardingPacketVersion,
} from "./components/OnboardingDocumentsStep";
import { useEmployeeAvatarUrl } from "./hooks/useEmployeeAvatarUrl";
import {
  EMPLOYEE_CATALOG_LOAD_FAILED,
  ORG_CATALOG_LOAD_FAILED,
} from "./orgCatalogHints";
import {
  filterActiveCatalogRows,
  hireProfileWriteFields,
  identityBodyFromCatalog,
  officialEmailFieldsFromWorkEmail,
  persistableSkillEntries,
  resolveCreateCompany,
  yearsExperienceToNumber,
  withSkillEntries,
  mapSkillCertificateFields,
} from "./employeeCatalog";
import { parseEmployeeSkillsResponse } from "./employeeSkills";
import type { EmployeesGateway } from "./gateway";
import { createEmployeesState, employeesReducer } from "./reducer";
import { EMPLOYEES_MODULE_ROOT } from "@/shared/ui/fieldChrome";
import { isAppFilterConstraint, usePersistentState } from "@/shared/ui";
import { ui } from "./uiClasses";
import {
  buildEmployeeUpdateFromDraft,
  buildProfileChangePayload,
  buildProfilePatchFromDraft,
  buildSelfProfileUpdateForSection,
  canListEmployees,
  canSeeApprovalsWorkspace,
  canSeeDraftsWorkspace,
  checkWorkEmailUniqueness,
  createDefaultDirectoryQuery,
  createDraftsDirectoryQuery,
  directoryFiltersActive,
  employeeDraftDiscardedOutcome,
  formatEmployeeCreatedNotice,
  formatEmployeeDraftSavedNotice,
  formatEmployeeName,
  isEmployeeActor,
  isEmployeesTheme,
  selectEmployeeById,
  shouldRequestFocusMode,
  shouldUseDraftSave,
  syncAccessRoleFields,
} from "./selectors";
import type {
  CreateEmployeeInput,
  DirectoryPageResult,
  DirectoryQuery,
  EmployeeActionKind,
  EmployeeDocument,
  EmployeeImportResult,
  EmployeeRecord,
  EmployeesModuleData,
  EmployeesModuleProps,
  EmployeesProfileMode,
  EmployeesView,
  OrgDepartmentOption,
  OrgDesignationOption,
  OrgLocationOption,
  LeavePolicyOption,
  NationalIdDocumentTypeOption,
  ProfileChangeRequest,
  SkillCatalogOption,
  EmployeeSkillEntry,
  TimesheetApprovalHandoff,
} from "./types";

const EmployeeWizard = dynamic(() =>
  import("./components/EmployeeWizard").then((mod) => mod.EmployeeWizard),
);

function parseOnboardingPackets(raw: unknown): OnboardingPacketItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: OnboardingPacketItem[] = [];
  for (const row of raw) {
    const record = asRecord(row);
    const documentType = String(record.documentType ?? "").trim();
    if (!documentType) {
      continue;
    }
    const currentRaw = asRecord(record.current);
    const currentId = String(currentRaw.id ?? "").trim();
    const statusRaw = String(record.status ?? "Pending");
    const status =
      statusRaw === "Uploaded" || currentId ? "Uploaded" : "Pending";
    items.push({
      documentType,
      label: String(record.label ?? documentType),
      status,
      signatureRequired: record.signatureRequired !== false,
      templateAvailable: record.templateAvailable !== false,
      current: currentId
        ? {
            id: currentId,
            versionNumber: Number(currentRaw.versionNumber ?? 1) || 1,
            fileName: String(currentRaw.fileName ?? "document.pdf"),
            uploadDate:
              currentRaw.uploadDate == null
                ? null
                : String(currentRaw.uploadDate),
          }
        : null,
    });
  }
  return items;
}

function parseOnboardingPacketVersions(
  raw: unknown,
): OnboardingPacketVersion[] {
  const root = asRecord(raw);
  const rows = Array.isArray(root.versions)
    ? root.versions
    : Array.isArray(raw)
      ? raw
      : [];
  const versions: OnboardingPacketVersion[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    const id = String(record.id ?? "").trim();
    if (!id) {
      continue;
    }
    versions.push({
      id,
      versionNumber: Number(record.versionNumber ?? 0) || 0,
      fileName: String(record.fileName ?? "document.pdf"),
      uploadDate:
        record.uploadDate == null ? null : String(record.uploadDate),
      uploadedBy:
        record.uploadedBy == null || String(record.uploadedBy).trim() === ""
          ? null
          : String(record.uploadedBy),
      isCurrent: Boolean(record.isCurrent),
      mimeType:
        record.mimeType == null ? undefined : String(record.mimeType),
      sizeBytes:
        typeof record.sizeBytes === "number" ? record.sizeBytes : undefined,
    });
  }
  return versions.sort((left, right) => right.versionNumber - left.versionNumber);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapLeavePolicyOptions(raw: unknown): LeavePolicyOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      const row = asRecord(item);
      return {
        policyId: String(row.policyId ?? ""),
        policyName: String(row.policyName ?? ""),
        status: String(row.status ?? "Active"),
        policyStartYear:
          typeof row.policyStartYear === "number"
            ? row.policyStartYear
            : undefined,
        policyEndYear:
          typeof row.policyEndYear === "number"
            ? row.policyEndYear
            : undefined,
      };
    })
    .filter((row) => row.policyId && row.policyName);
}

function parseDirectoryListResponse(
  raw: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): DirectoryPageResult {
  const envelope =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const items = Array.isArray(envelope?.items)
    ? envelope.items
    : Array.isArray(raw)
      ? raw
      : [];
  const rows = items.map(normalizeEmployeeRecord);
  const total =
    typeof envelope?.total === "number" ? envelope.total : rows.length;
  const page =
    typeof envelope?.page === "number" ? envelope.page : fallbackPage;
  const pageSize =
    typeof envelope?.pageSize === "number"
      ? envelope.pageSize
      : fallbackPageSize;
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
  };
}

async function attachSkillEntry(
  gateway: EmployeesGateway,
  employeeId: string,
  entry: EmployeeSkillEntry,
): Promise<void> {
  if (!entry.skillId) {
    return;
  }
  const years = yearsExperienceToNumber(entry.yearsExperience);
  try {
    await gateway.attachEmployeeSkills(employeeId, {
      skillIds: [entry.skillId],
      ...(entry.proficiency ? { proficiency: entry.proficiency } : {}),
      ...(years != null ? { yearsExperience: years } : {}),
      ...(entry.certificateName
        ? { certificateName: entry.certificateName }
        : {}),
      ...(entry.certificateExpiresOn
        ? { certificateExpiresOn: entry.certificateExpiresOn }
        : {}),
    });
  } catch (error) {
    const message = mutationErrorMessage(error);
    if (/already on the employee/i.test(message)) {
      return;
    }
    throw error;
  }
}

async function attachSelectedSkills(
  gateway: EmployeesGateway,
  employeeId: string,
  skillIds: readonly string[] | undefined,
): Promise<void> {
  const ids = [...new Set((skillIds ?? []).filter(Boolean))];
  if (ids.length === 0) {
    return;
  }
  try {
    await gateway.attachEmployeeSkills(employeeId, { skillIds: ids });
  } catch (error) {
    const message = mutationErrorMessage(error);
    if (/already on the employee/i.test(message)) {
      return;
    }
    throw error;
  }
}

async function syncEmployeeSkills(
  gateway: EmployeesGateway,
  employeeId: string,
  nextEntries: readonly EmployeeSkillEntry[] | undefined,
  previousEntries: readonly EmployeeSkillEntry[] | undefined,
): Promise<void> {
  const nextOnForm = (nextEntries ?? []).filter((row) => row.skillId);
  const nextComplete = persistableSkillEntries(nextOnForm);
  const previous = persistableSkillEntries(previousEntries);
  const previousById = new Map(previous.map((row) => [row.skillId, row]));
  const nextOnFormIds = new Set(nextOnForm.map((row) => row.skillId));

  const toDetach = previous.filter((row) => !nextOnFormIds.has(row.skillId));
  const toAttach = nextComplete.filter((row) => !previousById.has(row.skillId));
  const toUpdate = nextComplete.filter((row) => {
    const prior = previousById.get(row.skillId);
    if (!prior) {
      return false;
    }
    return (
      prior.proficiency !== row.proficiency ||
      prior.yearsExperience !== row.yearsExperience ||
      (prior.certificateName ?? "") !== (row.certificateName ?? "") ||
      (prior.certificateExpiresOn ?? "") !== (row.certificateExpiresOn ?? "")
    );
  });

  for (const row of toDetach) {
    try {
      await gateway.detachEmployeeSkill(employeeId, row.skillId);
    } catch (error) {
      const message = mutationErrorMessage(error);
      if (/not on this employee/i.test(message)) {
        continue;
      }
      throw error;
    }
  }
  for (const row of toUpdate) {
    const years = yearsExperienceToNumber(row.yearsExperience);
    await gateway.updateEmployeeSkill(employeeId, row.skillId, {
      ...(row.proficiency ? { proficiency: row.proficiency } : {}),
      ...(years != null ? { yearsExperience: years } : {}),
      certificateName: row.certificateName?.trim() || null,
      certificateExpiresOn: row.certificateExpiresOn?.trim() || null,
    });
  }
  for (const row of toAttach) {
    await attachSkillEntry(gateway, employeeId, row);
  }
}

async function syncSkillCertificates(
  gateway: EmployeesGateway,
  employeeId: string,
  entries: readonly EmployeeSkillEntry[],
  previousEntries: readonly EmployeeSkillEntry[] | undefined,
): Promise<EmployeeSkillEntry[]> {
  const previousById = new Map(
    persistableSkillEntries(previousEntries).map((row) => [row.skillId, row]),
  );
  const next: EmployeeSkillEntry[] = [];
  for (const row of entries) {
    if (!row.skillId) {
      next.push({ ...row, certificateFile: undefined });
      continue;
    }
    if (row.certificateFile) {
      const uploaded = await gateway.uploadSkillCertificate(
        employeeId,
        row.skillId,
        row.certificateFile,
      );
      next.push({
        ...row,
        ...mapSkillCertificateFields(asRecord(uploaded)),
        certificateFile: undefined,
      });
      continue;
    }
    const prior = previousById.get(row.skillId);
    const nextHasCertificate = Boolean(
      row.certificateObjectKey ||
        row.certificateFileName ||
        row.certificateName ||
        row.hasCertificate,
    );
    const priorHasCertificate = Boolean(
      prior?.certificateObjectKey ||
        prior?.certificateFileName ||
        prior?.certificateName ||
        prior?.hasCertificate,
    );
    if (priorHasCertificate && !nextHasCertificate) {
      await gateway.deleteSkillCertificate(employeeId, row.skillId);
      next.push({
        ...row,
        hasCertificate: false,
        certificateName: undefined,
        certificateExpiresOn: undefined,
        certificateFileName: undefined,
        certificateObjectKey: undefined,
        certificateFile: undefined,
      });
      continue;
    }
    next.push({ ...row, certificateFile: undefined });
  }
  return next;
}

/** True when the save only removes skill(s) and/or certificate(s) — skip the success popup. */
function shouldSkipSkillsSavedNotice(
  previousEntries: readonly EmployeeSkillEntry[] | undefined,
  nextEntries: readonly EmployeeSkillEntry[] | undefined,
): boolean {
  const previous = persistableSkillEntries(previousEntries);
  const next = persistableSkillEntries(nextEntries);
  const nextById = new Map(next.map((row) => [row.skillId, row]));
  const previousById = new Map(previous.map((row) => [row.skillId, row]));

  // Any newly attached skill → show notice.
  for (const row of next) {
    if (!previousById.has(row.skillId)) {
      return false;
    }
  }

  let removedSomething = false;

  for (const prior of previous) {
    const row = nextById.get(prior.skillId);
    if (!row) {
      removedSomething = true;
      continue;
    }
    if (
      prior.proficiency !== row.proficiency ||
      prior.yearsExperience !== row.yearsExperience
    ) {
      return false;
    }
    const priorHasCertificate = Boolean(
      prior.certificateObjectKey ||
        prior.certificateFileName ||
        prior.certificateName ||
        prior.hasCertificate,
    );
    const nextHasCertificate = Boolean(
      row.certificateObjectKey ||
        row.certificateFileName ||
        row.certificateName ||
        row.hasCertificate ||
        row.certificateFile,
    );
    if (priorHasCertificate && !nextHasCertificate) {
      removedSomething = true;
      continue;
    }
    if (
      (prior.certificateName ?? "") !== (row.certificateName ?? "") ||
      (prior.certificateExpiresOn ?? "") !== (row.certificateExpiresOn ?? "") ||
      Boolean(row.certificateFile)
    ) {
      return false;
    }
  }

  return removedSomething;
}

async function persistEmployeeSkillEntries(
  gateway: EmployeesGateway,
  employeeId: string,
  nextEntries: readonly EmployeeSkillEntry[] | undefined,
  previousEntries: readonly EmployeeSkillEntry[] | undefined,
): Promise<EmployeeSkillEntry[]> {
  const persistable = persistableSkillEntries(nextEntries);
  await syncEmployeeSkills(gateway, employeeId, persistable, previousEntries);
  return syncSkillCertificates(
    gateway,
    employeeId,
    persistable,
    previousEntries,
  );
}

function mapApiDocuments(
  raw: unknown,
  employeeId: string,
): EmployeeDocument[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows.map((item, index) => {
    const row = asRecord(item);
    const name = String(
      row.documentName || row.fileName || row.name || `document-${index + 1}`,
    );
    const objectKey =
      typeof row.objectKey === "string"
        ? row.objectKey
        : typeof row.url === "string"
          ? row.url
          : undefined;
    return {
      id: String(row.id || `doc-${employeeId}-${index}`),
      employeeId: String(row.employeeId || employeeId),
      name,
      mimeType: String(row.mimeType || "application/octet-stream"),
      sizeBytes: Number(row.sizeBytes ?? 0),
      uploadedAt: String(
        row.createdDate || row.uploadedAt || new Date().toISOString().slice(0, 10),
      ).slice(0, 10),
      objectKey,
    };
  });
}

function mapProfileChangeRequest(raw: unknown): ProfileChangeRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = asRecord(raw);
  const payloadRaw = asRecord(row.payload);
  const status = String(row.status || "PENDING");
  if (
    status !== "PENDING" &&
    status !== "APPROVED" &&
    status !== "REJECTED"
  ) {
    return null;
  }
  return {
    id: String(row.id || ""),
    employeeId: String(row.employeeId || ""),
    payload: {
      personalEmail:
        payloadRaw.personalEmail != null
          ? String(payloadRaw.personalEmail)
          : undefined,
      phone:
        payloadRaw.phone != null
          ? String(payloadRaw.phone)
          : payloadRaw.phoneNumber != null
            ? String(payloadRaw.phoneNumber)
            : undefined,
      alternatePhone:
        payloadRaw.alternatePhone != null
          ? String(payloadRaw.alternatePhone)
          : undefined,
      gender:
        payloadRaw.gender != null ? String(payloadRaw.gender) : undefined,
      maritalStatus:
        payloadRaw.maritalStatus != null
          ? String(payloadRaw.maritalStatus)
          : undefined,
      nationality:
        payloadRaw.nationality != null
          ? String(payloadRaw.nationality)
          : undefined,
      ethnicity:
        payloadRaw.ethnicity != null ? String(payloadRaw.ethnicity) : undefined,
      addressLine1:
        payloadRaw.addressLine1 != null
          ? String(payloadRaw.addressLine1)
          : undefined,
      addressLine2:
        payloadRaw.addressLine2 != null
          ? String(payloadRaw.addressLine2)
          : undefined,
      city: payloadRaw.city != null ? String(payloadRaw.city) : undefined,
      state: payloadRaw.state != null ? String(payloadRaw.state) : undefined,
      postalCode:
        payloadRaw.postalCode != null
          ? String(payloadRaw.postalCode)
          : undefined,
      country:
        payloadRaw.country != null ? String(payloadRaw.country) : undefined,
      emergencyName:
        payloadRaw.emergencyName != null
          ? String(payloadRaw.emergencyName)
          : undefined,
      emergencyPhone:
        payloadRaw.emergencyPhone != null
          ? String(payloadRaw.emergencyPhone)
          : undefined,
      emergencyRelation:
        payloadRaw.emergencyRelation != null
          ? String(payloadRaw.emergencyRelation)
          : undefined,
      emergencyEmail:
        payloadRaw.emergencyEmail != null
          ? String(payloadRaw.emergencyEmail)
          : undefined,
      emergencyEmployeeId:
        payloadRaw.emergencyEmployeeId == null
          ? null
          : String(payloadRaw.emergencyEmployeeId),
      alternateEmergencyName:
        payloadRaw.alternateEmergencyName != null
          ? String(payloadRaw.alternateEmergencyName)
          : undefined,
      alternateEmergencyPhone:
        payloadRaw.alternateEmergencyPhone != null
          ? String(payloadRaw.alternateEmergencyPhone)
          : undefined,
      alternateEmergencyRelation:
        payloadRaw.alternateEmergencyRelation != null
          ? String(payloadRaw.alternateEmergencyRelation)
          : undefined,
      alternateEmergencyEmail:
        payloadRaw.alternateEmergencyEmail != null
          ? String(payloadRaw.alternateEmergencyEmail)
          : undefined,
    },
    status,
    comments: row.comments == null ? null : String(row.comments),
    createdBy: row.createdBy == null ? null : String(row.createdBy),
    reviewedBy: row.reviewedBy == null ? null : String(row.reviewedBy),
    createdDate: row.createdDate == null ? null : String(row.createdDate),
    updatedDate: row.updatedDate == null ? null : String(row.updatedDate),
  };
}

/** The data without one person (a discarded draft). */
function withoutEmployee(
  data: EmployeesModuleData,
  employeeId: string,
): EmployeesModuleData {
  return {
    ...data,
    employees: data.employees.filter((row) => row.id !== employeeId),
  };
}

/** Prefer GET-by-id / session detail for personal/contact; keep session skills/docs. */
function mergeEmployeeDetail(
  data: EmployeesModuleData,
  record: EmployeeRecord,
): EmployeesModuleData {
  const exists = data.employees.some((row) => row.id === record.id);
  const employees = exists
    ? data.employees.map((row) => {
        if (row.id !== record.id) {
          return row;
        }
        return mergeEmployeeSessionDetail(record, row);
      })
    : [...data.employees, record];
  return { ...data, employees };
}

/**
 * Directory list rows omit skills/docs. When a live search overlay sits on top
 * of session state, keep richer skill/document detail from the session row.
 */
function mergeEmployeeSessionDetail(
  incoming: EmployeeRecord,
  session: EmployeeRecord | undefined,
): EmployeeRecord {
  if (!session) {
    return incoming;
  }
  const sessionHasSkills =
    session.professional.skillEntries.length > 0 ||
    session.professional.skillIds.length > 0;
  const incomingHasSkills =
    incoming.professional.skillEntries.length > 0 ||
    incoming.professional.skillIds.length > 0;
  const keepSessionSkills = sessionHasSkills && !incomingHasSkills;
  return {
    ...incoming,
    isSystemAccount: Boolean(incoming.isSystemAccount || session.isSystemAccount),
    documentIds:
      session.documentIds.length > 0
        ? session.documentIds
        : incoming.documentIds,
    professional: {
      ...incoming.professional,
      skillIds: keepSessionSkills
        ? session.professional.skillIds
        : incoming.professional.skillIds,
      skills: keepSessionSkills
        ? session.professional.skills
        : incoming.professional.skills,
      skillEntries: keepSessionSkills
        ? session.professional.skillEntries
        : incoming.professional.skillEntries,
    },
  };
}
function resolveLandingView(
  actor: ReturnType<typeof createDefaultActor>,
  initialView: EmployeesView,
): "directory" | "drafts" | "approvals" {
  const list = canListEmployees(actor);
  const approvals = canSeeApprovalsWorkspace(actor);

  if (initialView === "approvals" && approvals) {
    return "approvals";
  }

  if (initialView === "drafts") {
    return "directory";
  }

  if (list) {
    return "directory";
  }

  if (approvals) {
    return "approvals";
  }

  return "directory";
}

/**
 * Employees module root.
 * Controlled/uncontrolled actor + data pattern follows
 * `dashbord/DashboardModule.tsx`.
 */
export function EmployeesModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_EMPLOYEES_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_EMPLOYEES_THEME,
  initialView = "directory",
  openSelfProfileOnMount = false,
  onOpenSelfProfileConsumed,
  initialProfileEmployeeId = null,
  onInitialProfileConsumed,
  linkedProfileUpdateRequest = null,
  onCompleteLinkedProfileUpdateRequest,
  onLinkedProfileUpdateRequestFinished,
  onReturnToPortalFromProfile,
  variant = "module",
  onDataChange,
  onNavigate,
  onOpenTimesheetApprovals,
  onFocusModeChange,
  pendingTimesheetCount,
  role,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
  assetsGateway,
}: EmployeesModuleProps) {
  const isMyProfile = variant === "myProfile";
  const searchParams = useSearchParams();
  const stickerAssetId = isMyProfile
    ? (searchParams.get("q") ?? readAssetStickerQueryParam()).trim()
    : "";
  const resolvedDefaultActor = defaultActor ?? createDefaultActor(role);
  const [uncontrolledActor, setUncontrolledActor] =
    useState(resolvedDefaultActor);
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActorEarly =
    actor === undefined ? resolvedDefaultActor : actor;
  const landingActor = isEmployeeActor(requestedActorEarly)
    ? requestedActorEarly
    : resolvedDefaultActor;

  const [state, dispatch] = useReducer(
    employeesReducer,
    createEmployeesState(
      defaultData,
      resolveLandingView(landingActor, initialView),
    ),
  );
  const [query, setQuery] = usePersistentState(
    isMyProfile ? null : "employees.directory",
    createDefaultDirectoryQuery,
  );
  const [livePage, setLivePage] = useState<DirectoryPageResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  // Bumped after a change so the directory page on screen is asked for again.
  const [directoryReload, setDirectoryReload] = useState(0);
  const [liveOverlay, setLiveOverlay] = useState<readonly EmployeeRecord[]>(
    [],
  );
  const [catalogDepartments, setCatalogDepartments] = useState<
    readonly OrgDepartmentOption[]
  >([]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardDraftEmployeeId, setWizardDraftEmployeeId] = useState<
    string | null
  >(null);
  const wizardDraftEmployeeIdRef = useRef<string | null>(null);

  function rememberWizardDraftEmployeeId(id: string | null) {
    wizardDraftEmployeeIdRef.current = id;
    setWizardDraftEmployeeId(id);
  }
  const [createWizardSessionKey, setCreateWizardSessionKey] = useState<
    string | null
  >(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<EmployeeImportResult | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [returnToPortalAfterNotice, setReturnToPortalAfterNotice] =
    useState(false);
  const [certificatePreview, setCertificatePreview] =
    useState<SkillCertificatePreview | null>(null);
  const [outcomeDialog, setOutcomeDialog] = useState<{
    readonly title?: string;
    readonly message: string;
  } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedTick, setProfileSavedTick] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingHardDeleteId, setPendingHardDeleteId] = useState<string | null>(
    null,
  );
  const [pendingProfileChange, setPendingProfileChange] =
    useState<ProfileChangeRequest | null>(null);
  const [onboardingPackets, setOnboardingPackets] = useState<
    readonly OnboardingPacketItem[]
  >([]);
  const [onboardingPacketsLoading, setOnboardingPacketsLoading] =
    useState(false);
  const [onboardingPacketsError, setOnboardingPacketsError] = useState<
    string | null
  >(null);
  const [onboardingPacketBusyType, setOnboardingPacketBusyType] = useState<
    string | null
  >(null);
  const [orgDepartments, setOrgDepartments] = useState<
    readonly OrgDepartmentOption[]
  >([]);
  const [orgLocations, setOrgLocations] = useState<readonly OrgLocationOption[]>(
    [],
  );
  const [orgDesignations, setOrgDesignations] = useState<
    readonly OrgDesignationOption[]
  >([]);
  const [leavePolicyOptions, setLeavePolicyOptions] = useState<
    readonly LeavePolicyOption[]
  >([]);
  const [orgCatalogError, setOrgCatalogError] = useState<string | null>(null);
  const [skillCatalog, setSkillCatalog] = useState<readonly SkillCatalogOption[]>(
    [],
  );
  const [nationalIdTypes, setNationalIdTypes] = useState<
    readonly NationalIdDocumentTypeOption[]
  >([]);
  const [employeeCatalogError, setEmployeeCatalogError] = useState<string | null>(null);
  const [selfLookupStatus, setSelfLookupStatus] = useState<
    "idle" | "pending" | "found" | "missing"
  >("idle");

  const requestedActor = actor === undefined ? uncontrolledActor : actor;
  const activeActor = isEmployeeActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;

  useEffect(() => {
    if (actor !== undefined || role === undefined) {
      return;
    }

    setUncontrolledActor((current) =>
      current.role === role ? current : createDefaultActor(role),
    );
  }, [actor, role]);

  useEffect(() => {
    if (!gateway) {
      setOrgDepartments([]);
      setCatalogDepartments([]);
      setOrgLocations([]);
      setOrgDesignations([]);
      setOrgCatalogError(null);
      setSkillCatalog([]);
      setNationalIdTypes([]);
      setEmployeeCatalogError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const departmentsRaw = await gateway.listDepartments();
        if (cancelled) {
          return;
        }
        const departments = Array.isArray(departmentsRaw)
          ? departmentsRaw.map((item) => {
              const row = asRecord(item);
              return {
                departmentId: String(row.departmentId ?? ""),
                departmentName: String(row.departmentName ?? ""),
                parentDepartmentId: row.parentDepartmentId
                  ? String(row.parentDepartmentId)
                  : null,
                status: String(row.status ?? "Active"),
              };
            })
          : [];
        setCatalogDepartments(
          departments.filter((d) => d.departmentId),
        );
        setOrgDepartments(
          filterActiveCatalogRows(departments).filter((d) => d.departmentId),
        );
        setOrgCatalogError(null);
      } catch {
        if (!cancelled) {
          setOrgDepartments([]);
          setCatalogDepartments([]);
          setOrgCatalogError(ORG_CATALOG_LOAD_FAILED);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway]);

  useEffect(() => {
    if (initialView === "drafts" && canSeeDraftsWorkspace(activeActor)) {
      setQuery((current) =>
        createDraftsDirectoryQuery({ ...current, page: 1 }),
      );
    }
  }, [activeActor.isLead, activeActor.role, initialView]);

  useEffect(() => {
    // Opening a profile (My Profile or directory View / Edit) must not be
    // snapped back to directory/approvals landing.
    if (isMyProfile || state.ui.view === "profile") {
      return;
    }
    const nextView = resolveLandingView(activeActor, initialView);
    if (state.ui.view === nextView) {
      return;
    }
    dispatch({
      type: "setView",
      view: nextView,
    });
  }, [
    activeActor.isLead,
    activeActor.role,
    initialView,
    isMyProfile,
    state.ui.view,
  ]);

  useEffect(() => {
    if (
      state.ui.view === "approvals" &&
      !canSeeApprovalsWorkspace(activeActor)
    ) {
      dispatch({ type: "setView", view: "directory" });
    }
  }, [activeActor.isLead, activeActor.role, state.ui.view]);

  useEffect(() => {
    if (state.ui.view === "drafts" && !canSeeDraftsWorkspace(activeActor)) {
      dispatch({ type: "setView", view: "directory" });
    }
  }, [activeActor.isLead, activeActor.role, state.ui.view]);

  useEffect(() => {
    if (createOpen) {
      setCreateWizardSessionKey(
        (current) => current ?? wizardDraftEmployeeId ?? `new-${Date.now()}`,
      );
      return;
    }
    setCreateWizardSessionKey(null);
  }, [createOpen, wizardDraftEmployeeId]);

  const isDataControlled = data !== undefined;
  const baseData = data ?? state.data;
  const activeData = useMemo(
    () =>
      pendingTimesheetCount === undefined
        ? baseData
        : { ...baseData, pendingTimesheetCount },
    [baseData, pendingTimesheetCount],
  );
  const resolvedData = useMemo(() => {
    if (liveOverlay.length === 0) {
      return activeData;
    }
    const sessionById = new Map(
      activeData.employees.map((row) => [row.id, row] as const),
    );
    const seen = new Set<string>();
    const employees: EmployeeRecord[] = [];
    for (const row of liveOverlay) {
      employees.push(mergeEmployeeSessionDetail(row, sessionById.get(row.id)));
      seen.add(row.id);
    }
    for (const row of activeData.employees) {
      if (seen.has(row.id)) {
        continue;
      }
      employees.push(row);
      seen.add(row.id);
    }
    return {
      ...activeData,
      employees,
    };
  }, [activeData, liveOverlay]);
  const dataRef = useRef(resolvedData);
  dataRef.current = resolvedData;
  const defaultDataRef = useRef(defaultData);
  defaultDataRef.current = defaultData;
  const stateDataRef = useRef(state.data);
  stateDataRef.current = state.data;

  function bumpDirectory() {
    setDirectoryReload((tick) => tick + 1);
  }

  /**
   * After a change: ask for the directory page again and re-read the one person
   * it touched. The whole directory is never downloaded.
   */
  async function refreshEmployees(
    employeeId?: string | null,
  ): Promise<EmployeesModuleData> {
    bumpDirectory();
    // Empty documents tell the reducer to keep the documents and skills it
    // already holds, as a refreshed list always did.
    const current = { ...stateDataRef.current, documents: [] };
    if (!gateway || !employeeId) {
      return current;
    }
    try {
      const raw = await gateway.getEmployeeById(employeeId);
      return mergeEmployeeDetail(current, normalizeEmployeeRecord(raw));
    } catch {
      return current;
    }
  }
  const lastPublishedDataRef = useRef<EmployeesModuleData | null>(null);
  const lastPublishedFingerprintRef = useRef<string | null>(null);
  const requestedTheme: unknown =
    theme === undefined ? uncontrolledTheme : theme;
  const activeTheme = isEmployeesTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_EMPLOYEES_THEME;

  useEffect(() => {
    if (isDataControlled || !onDataChange) {
      return;
    }
    if (lastPublishedDataRef.current === state.data) {
      return;
    }
    // Avoid publishing an empty directory during mount before host/live data
    // arrives — that used to clobber the shell snapshot and re-trigger seeds.
    if (
      state.data.employees.length === 0 &&
      defaultDataRef.current.employees.length > 0
    ) {
      return;
    }
    const fingerprint = state.data.employees
      .map(
        (row) =>
          `${row.id}:${row.status}:${row.workEmail}:${row.firstName}:${row.lastName}:${row.avatarObjectKey ?? ""}:${row.updatedDate ?? ""}`,
      )
      .join("|");
    if (lastPublishedFingerprintRef.current === fingerprint) {
      lastPublishedDataRef.current = state.data;
      return;
    }
    lastPublishedDataRef.current = state.data;
    lastPublishedFingerprintRef.current = fingerprint;
    onDataChange(state.data);
  }, [isDataControlled, onDataChange, state.data]);

  useEffect(() => {
    if (isDataControlled) {
      return;
    }
    const hostData = defaultDataRef.current;
    if (state.data.employees.length > 0 || hostData.employees.length === 0) {
      return;
    }
    // Host snapshot often arrives after mount (live refresh on /profile).
    dispatch({ type: "replaceData", data: hostData });
  }, [
    defaultData.employees.length,
    isDataControlled,
    state.data.employees.length,
  ]);

  const profileEmployee =
    state.ui.profileEmployeeId != null
      ? selectEmployeeById(resolvedData, state.ui.profileEmployeeId)
      : null;
  const hasSelf = Boolean(
    activeActor.employeeId &&
      selectEmployeeById(resolvedData, activeActor.employeeId),
  );
  const profileMode = state.ui.profileMode;
  const showSystemAccount =
    state.ui.view === "profile" && Boolean(profileEmployee?.isSystemAccount);
  const showWizard =
    state.ui.view === "profile" &&
    profileEmployee != null &&
    profileMode != null &&
    !profileEmployee.isSystemAccount;
  const showProfileSurface = showWizard || showSystemAccount;

  // The directory only needs departments (its filter). Everything the create
  // and profile forms pick from loads the first time one of them opens.
  const needsFormCatalogs =
    createOpen || chooserOpen || showProfileSurface || isMyProfile;
  const [formCatalogsWanted, setFormCatalogsWanted] = useState(false);
  useEffect(() => {
    if (needsFormCatalogs) {
      setFormCatalogsWanted(true);
    }
  }, [needsFormCatalogs]);

  useEffect(() => {
    if (!gateway || !formCatalogsWanted) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [locationsRaw, designationsRaw] = await Promise.all([
          gateway.listLocations(),
          gateway.listDesignations(),
        ]);
        if (cancelled) {
          return;
        }
        const locations = Array.isArray(locationsRaw)
          ? locationsRaw.map((item) => {
              const row = asRecord(item);
              return {
                locationId: String(row.locationId ?? ""),
                locationName: String(row.locationName ?? ""),
                city: row.city ? String(row.city) : null,
                country: row.country ? String(row.country) : null,
                timezone: row.timezone ? String(row.timezone) : null,
                status: String(row.status ?? "Active"),
              };
            })
          : [];
        const designations = Array.isArray(designationsRaw)
          ? designationsRaw.map((item) => {
              const row = asRecord(item);
              return {
                designationId: String(row.designationId ?? ""),
                title: String(row.title ?? ""),
                jobFamily: row.jobFamily ? String(row.jobFamily) : null,
                status: String(row.status ?? "Active"),
              };
            })
          : [];
        setOrgLocations(
          filterActiveCatalogRows(locations).filter((l) => l.locationId),
        );
        setOrgDesignations(
          filterActiveCatalogRows(designations).filter((d) => d.designationId),
        );
        setOrgCatalogError(null);
      } catch {
        if (!cancelled) {
          setOrgLocations([]);
          setOrgDesignations([]);
          setOrgCatalogError(ORG_CATALOG_LOAD_FAILED);
        }
      }
      if (cancelled) {
        return;
      }
      try {
        const [skillsRaw, typesRaw] = await Promise.all([
          gateway.listSkills(),
          gateway.listNationalIdDocumentTypes(),
        ]);
        if (cancelled) {
          return;
        }
        const skills = Array.isArray(skillsRaw)
          ? skillsRaw
              .map((item) => {
                const row = asRecord(item);
                return {
                  skillId: String(row.skillId ?? ""),
                  skillName: String(row.skillName ?? ""),
                  status: String(row.status ?? "Active"),
                };
              })
              .filter((row) => row.skillId && row.skillName)
          : [];
        const types = Array.isArray(typesRaw)
          ? typesRaw
              .map((item) => {
                const row = asRecord(item);
                return {
                  documentTypeId: String(row.documentTypeId ?? ""),
                  documentTypeCode: String(row.documentTypeCode ?? ""),
                  documentTypeLabel: String(row.documentTypeLabel ?? ""),
                  countryCode: row.countryCode
                    ? String(row.countryCode)
                    : null,
                  format: row.format ? String(row.format) : null,
                  status: String(row.status ?? "Active"),
                };
              })
              .filter((row) => row.documentTypeId)
          : [];
        setSkillCatalog(skills);
        setNationalIdTypes(types);
        setEmployeeCatalogError(null);
      } catch {
        if (!cancelled) {
          setSkillCatalog([]);
          setNationalIdTypes([]);
          setEmployeeCatalogError(EMPLOYEE_CATALOG_LOAD_FAILED);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway, formCatalogsWanted]);

  const leavePolicyIncludeId = useMemo(() => {
    if (profileEmployee?.leavePolicyId) {
      return profileEmployee.leavePolicyId;
    }
    if (createOpen && wizardDraftEmployeeId) {
      return (
        selectEmployeeById(resolvedData, wizardDraftEmployeeId)?.leavePolicyId ??
        null
      );
    }
    return null;
  }, [
    createOpen,
    profileEmployee?.leavePolicyId,
    resolvedData,
    wizardDraftEmployeeId,
  ]);

  useEffect(() => {
    if (!gateway) {
      setLeavePolicyOptions([]);
      return;
    }
    if (!formCatalogsWanted) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await gateway.listLeavePolicyOptions(leavePolicyIncludeId);
        if (cancelled) {
          return;
        }
        setLeavePolicyOptions(mapLeavePolicyOptions(raw));
      } catch {
        if (!cancelled) {
          setLeavePolicyOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateway, formCatalogsWanted, leavePolicyIncludeId]);

  // Reporting managers are found by the server as the picker is used.
  const [managerQuery, setManagerQuery] = useState<string | null>(null);
  const managerSearch = useEmployeeSearch(
    gateway,
    managerQuery ?? "",
    managerQuery !== null && (createOpen || showWizard),
  );
  const reportingManagerEmployees = useMemo(
    () =>
      createOpen || showWizard
        ? managerSearch.rows.map(normalizeEmployeeRecord)
        : null,
    [createOpen, managerSearch.rows, showWizard],
  );
  const reportingManagerSearch = useMemo(
    () => ({ search: setManagerQuery, loading: managerSearch.loading }),
    [managerSearch.loading],
  );

  const awaitingLinkedEmployee =
    isMyProfile &&
    Boolean(activeActor.employeeId) &&
    !profileEmployee &&
    (hasSelf ||
      selfLookupStatus === "pending" ||
      (Boolean(gateway) && selfLookupStatus === "idle"));
  const workspaceView: "directory" | "drafts" | "approvals" =
    state.ui.view === "approvals"
      ? "approvals"
      : state.ui.view === "drafts"
        ? "drafts"
        : "directory";

  useEffect(() => {
    if (!gateway || isMyProfile || showProfileSurface) {
      return;
    }
    if (
      workspaceView === "approvals" ||
      (activeActor.role === "EMPLOYEE" &&
        !(
          activeActor.accessFlags.viewAccess ||
          activeActor.accessFlags.fullAccess
        ))
    ) {
      return;
    }
    if (!directoryFiltersActive(query)) {
      setLivePage(null);
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    const delayMs = query.search.trim() ? 300 : 0;
    const handle = window.setTimeout(() => {
      void (async () => {
        setLiveLoading(true);
        try {
          const raw = await gateway.listEmployees({
            q: query.search.trim() || undefined,
            departmentId: isAppFilterConstraint(query.departmentId)
              ? query.departmentId
              : undefined,
            status: isAppFilterConstraint(query.status)
              ? query.status
              : undefined,
            sort: query.sortKey,
            sortDir: query.sortDirection,
            page: query.page,
            pageSize: query.pageSize,
          });
          if (cancelled) {
            return;
          }
          const page = parseDirectoryListResponse(
            raw,
            query.page,
            query.pageSize,
          );
          setLivePage(page);
          setLiveOverlay(page.rows);
        } catch {
          if (!cancelled) {
            setLivePage(null);
          }
        } finally {
          if (!cancelled) {
            setLiveLoading(false);
          }
        }
      })();
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    directoryReload,
    gateway,
    isMyProfile,
    query.departmentId,
    query.departmentFilterEngaged,
    query.page,
    query.pageSize,
    query.search,
    query.sortDirection,
    query.sortKey,
    query.status,
    query.statusFilterEngaged,
    showProfileSurface,
    workspaceView,
    activeActor.role,
  ]);

  const requestFocusMode = useMemo(
    () =>
      shouldRequestFocusMode(activeActor, profileEmployee, profileMode),
    [
      activeActor.employeeId,
      activeActor.role,
      profileEmployee?.id,
      profileEmployee?.status,
      profileMode,
    ],
  );

  useEffect(() => {
    if (!onFocusModeChange) {
      return;
    }
    onFocusModeChange(requestFocusMode);
    return () => {
      onFocusModeChange(false);
    };
  }, [onFocusModeChange, requestFocusMode]);

  const pendingDeleteEmployee = useMemo(
    () =>
      pendingDeleteId
        ? (resolvedData.employees.find((row) => row.id === pendingDeleteId) ??
          null)
        : null,
    [resolvedData.employees, pendingDeleteId],
  );

  const pendingHardDeleteEmployee = useMemo(
    () =>
      pendingHardDeleteId
        ? (resolvedData.employees.find(
            (row) => row.id === pendingHardDeleteId,
          ) ?? null)
        : null,
    [resolvedData.employees, pendingHardDeleteId],
  );

  const fetchAvatarBlob = useCallback(
    (employeeId: string) => {
      if (!gateway) {
        return Promise.reject(new Error("Live API gateway is required."));
      }
      return gateway.fetchAvatarBlob(employeeId);
    },
    [gateway],
  );

  const photoSrc = useEmployeeAvatarUrl(
    profileEmployee?.id,
    profileEmployee?.avatarObjectKey,
    gateway ? fetchAvatarBlob : undefined,
    (message) => setProfileNotice(message),
  );

  function handleUploadPhoto(employeeId: string, file: File) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        await gateway.uploadAvatar(employeeId, file);
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice("Profile photo updated.");
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleRemovePhoto(employeeId: string) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        await gateway.removeAvatar(employeeId);
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice("Profile photo removed.");
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function patchQuery(patch: Partial<DirectoryQuery>) {
    setQuery((current) => {
      const next = { ...current, ...patch };
      if (patch.status === "NEW" && current.status !== "NEW") {
        return {
          ...next,
          sortKey: "lastUpdated",
          sortDirection: "desc",
        };
      }
      if (
        patch.status === "" &&
        current.status === "NEW" &&
        current.sortKey === "lastUpdated" &&
        current.sortDirection === "desc"
      ) {
        return {
          ...next,
          sortKey: "name",
          sortDirection: "asc",
        };
      }
      return next;
    });
  }

  function openProfile(
    employeeId: string,
    mode: EmployeesProfileMode,
    returnView?: "directory" | "drafts" | "approvals",
  ) {
    if (isDataControlled) {
      setProfileNotice(
        "Host-controlled data mode cannot open the session wizard yet.",
      );
      return;
    }

    const target = selectEmployeeById(resolvedData, employeeId);
    if (
      target?.isSystemAccount &&
      activeActor.employeeId !== employeeId
    ) {
      setProfileNotice(
        "System accounts cannot be viewed or edited as employee profiles.",
      );
      return;
    }

    dispatch({
      type: "openProfile",
      employeeId,
      mode,
      returnView,
    });
    setProfileNotice(null);
    setPendingProfileChange(null);
    setOnboardingPackets([]);
    setOnboardingPacketsError(null);
    setOnboardingPacketBusyType(null);

    if (target?.isSystemAccount) {
      return;
    }

    if (gateway) {
      void (async () => {
        try {
          const [rawDocs, rawPending, rawSkills] = await Promise.all([
            gateway.listDocuments(employeeId),
            gateway.getPendingProfileChange(employeeId),
            gateway.listEmployeeSkills(employeeId),
          ]);
          const documents = mapApiDocuments(rawDocs, employeeId);
          dispatch({
            type: "setEmployeeDocuments",
            employeeId,
            documents,
          });
          setPendingProfileChange(mapProfileChangeRequest(rawPending));
          if (Array.isArray(rawSkills)) {
            const parsed = parseEmployeeSkillsResponse(rawSkills);
            dispatch({
              type: "setEmployeeSkills",
              employeeId,
              skillIds: parsed.skillIds,
              skillNames: parsed.skillNames,
              skillEntries: parsed.skillEntries,
            });
          }
        } catch (error) {
          setProfileNotice(mutationErrorMessage(error));
        }
      })();
      void (async () => {
        setOnboardingPacketsLoading(true);
        setOnboardingPacketsError(null);
        try {
          const rawPackets = await gateway.listOnboardingPackets(employeeId);
          setOnboardingPackets(parseOnboardingPackets(rawPackets));
        } catch (error) {
          setOnboardingPacketsError(mutationErrorMessage(error));
        } finally {
          setOnboardingPacketsLoading(false);
        }
      })();
    }
  }

  function handleCreate(input: CreateEmployeeInput): Promise<boolean> {
    if (isDataControlled) {
      return Promise.reject(
        new Error(
          "Host-controlled data mode cannot mutate session employees yet.",
        ),
      );
    }

    const uniqueness = checkWorkEmailUniqueness(
      state.data,
      input.workEmail,
      input.id,
    );
    if (!uniqueness.unique) {
      return Promise.reject(
        new Error(
          uniqueness.conflict?.kind === "INACTIVE"
            ? "Inactive email conflict — use Rehire from the invite panel."
            : "Work email must be unique.",
        ),
      );
    }

    if (!gateway) {
      return Promise.reject(new Error("Live API gateway is required."));
    }

    return (async () => {
      try {
        const access = syncAccessRoleFields(input.department, input.role);
        const inviteBody = {
          firstName: input.firstName,
          lastName: input.lastName,
          ...officialEmailFieldsFromWorkEmail(input.workEmail),
          personalEmail: input.personalEmail || undefined,
          dateOfBirth: input.dateOfBirth || undefined,
          department: access.department,
          departmentId: input.departmentId || undefined,
          locationId: input.locationId || undefined,
          designationId: input.designationId || undefined,
          company: resolveCreateCompany({
            company: input.company,
            actorCompany: activeActor.company,
          }),
          ...(input.employmentType
            ? { employmentType: input.employmentType }
            : {}),
          ...(input.workerType ? { workerType: input.workerType } : {}),
          ...(input.workSchedule !== undefined
            ? { workSchedule: input.workSchedule }
            : {}),
          ...(input.employmentCategory
            ? { employmentCategory: input.employmentCategory }
            : {}),
          employmentStartDate: input.startDate,
          dateOfJoining: input.startDate,
          status: "PENDING",
          role: access.role,
          jobRank: input.jobRank ?? "RANK_7",
          jobDescription: input.jobDescription || input.title,
          ...identityBodyFromCatalog({
            workMode: input.workMode ?? null,
            nationalIdDocumentTypeId: input.nationalIdDocumentTypeId ?? null,
            nationalIdNumber: input.nationalIdNumber ?? null,
            nationalIdTypes,
          }),
          ...hireProfileWriteFields(input),
          ...(input.supervisorId
            ? { reportingManagerId: input.supervisorId }
            : {}),
          ...(input.vendorId ? { vendor: input.vendorId } : {}),
        };

        let created: unknown;
        const draftId = input.id ?? wizardDraftEmployeeIdRef.current;
        if (draftId) {
          created = await gateway.inviteDraftEmployee(draftId, inviteBody);
        } else {
          created = await gateway.createEmployee(inviteBody);
        }
        const row = created as {
          employeeId?: string;
          id?: string;
          onboardingId?: string;
          firstName?: string;
          lastName?: string;
          employeeCode?: string;
          businessEmployeeId?: string | null;
        };
        const id = row.employeeId ?? row.id;
        let skillsNotice = "";
        if (id) {
          try {
            await attachSelectedSkills(gateway, id, input.skillIds);
          } catch (error) {
            skillsNotice = ` Skills could not be saved. ${mutationErrorMessage(error)}`;
          }
        }
        const next = await refreshEmployees(id);
        dispatch({ type: "replaceData", data: next });
        onDataChange?.(next);
        setCreateOpen(false);
        rememberWizardDraftEmployeeId(null);
        if (EMPLOYEE_ONBOARDING_HANDOFF_ENABLED) {
          if (row.onboardingId) {
            onNavigate?.(`/onboarding/${row.onboardingId}`);
          } else if (id) {
            onNavigate?.(`/onboarding/start/${id}`);
          }
        }
        const createdNotice = formatEmployeeCreatedNotice(row, skillsNotice);
        const inviteMessage =
          createdNotice ??
          `Invited ${String(row.firstName ?? input.firstName).trim()} ${String(row.lastName ?? input.lastName).trim()} as Pending.${skillsNotice}`;
        setOutcomeDialog({ message: inviteMessage });
        return true;
      } catch (error) {
        throw new Error(mutationErrorMessage(error));
      }
    })();
  }

  function handleCreateDraft(
    input: CreateEmployeeInput,
    options?: { readonly close?: boolean; readonly announce?: boolean },
  ): Promise<boolean | string> {
    if (isDataControlled) {
      return Promise.reject(
        new Error(
          "Host-controlled data mode cannot mutate session employees yet.",
        ),
      );
    }
    if (!gateway) {
      return Promise.reject(new Error("Live API gateway is required."));
    }

    const closeWizard = options?.close === true;

    return (async () => {
      try {
        const body = {
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth,
          personalEmail: input.personalEmail || undefined,
          ...officialEmailFieldsFromWorkEmail(input.workEmail),
          department: input.department || "EMPLOYEE",
          departmentId: input.departmentId || undefined,
          locationId: input.locationId || undefined,
          designationId: input.designationId || undefined,
          company: resolveCreateCompany({
            company: input.company,
            actorCompany: activeActor.company,
          }),
          ...(input.employmentType
            ? { employmentType: input.employmentType }
            : {}),
          ...(input.workerType ? { workerType: input.workerType } : {}),
          ...(input.workSchedule !== undefined
            ? { workSchedule: input.workSchedule }
            : {}),
          ...(input.employmentCategory
            ? { employmentCategory: input.employmentCategory }
            : {}),
          ...(input.startDate
            ? {
                employmentStartDate: input.startDate,
                dateOfJoining: input.startDate,
              }
            : {}),
          role: input.role,
          jobRank: input.jobRank ?? "RANK_7",
          jobDescription: input.jobDescription || input.title,
          ...identityBodyFromCatalog({
            workMode: input.workMode ?? null,
            nationalIdDocumentTypeId: input.nationalIdDocumentTypeId ?? null,
            nationalIdNumber: input.nationalIdNumber ?? null,
            nationalIdTypes,
          }),
          ...hireProfileWriteFields(input),
          ...(input.supervisorId
            ? { reportingManagerId: input.supervisorId }
            : {}),
          ...(input.vendorId ? { vendor: input.vendorId } : {}),
        };

        let saved: {
          employeeCode?: string;
          employeeId?: string;
          id?: string;
        };
        const draftId = input.id ?? wizardDraftEmployeeIdRef.current;
        if (draftId) {
          saved = (await gateway.draftEmployee(draftId, body)) as typeof saved;
        } else {
          saved = (await gateway.createEmployeeDraft(body)) as typeof saved;
        }
        const savedId = saved.employeeId ?? saved.id ?? draftId ?? null;
        if (savedId) {
          rememberWizardDraftEmployeeId(savedId);
        }
        const next = await refreshEmployees(savedId);
        dispatch({ type: "replaceData", data: next });
        onDataChange?.(next);
        if (options?.announce) {
          setOutcomeDialog({
            message: formatEmployeeDraftSavedNotice({
              firstName: input.firstName,
              lastName: input.lastName,
              employeeCode: saved.employeeCode,
            }),
          });
        }
        if (closeWizard) {
          setCreateOpen(false);
          rememberWizardDraftEmployeeId(null);
          return true;
        }
        return savedId ?? true;
      } catch (error) {
        throw new Error(mutationErrorMessage(error));
      }
    })();
  }

  async function handleExportEmployees() {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    setExportBusy(true);
    try {
      const blob = await gateway.exportEmployees();
      downloadBlob(blob, `employees-export-${Date.now()}.csv`);
    } catch (error) {
      setProfileNotice(mutationErrorMessage(error));
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDownloadImportTemplate() {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    try {
      const blob = await gateway.downloadImportTemplate();
      downloadBlob(blob, "employees-import-template.csv");
    } catch (error) {
      setImportError(mutationErrorMessage(error));
    }
  }

  async function handleImportFile(file: File) {
    if (!gateway) {
      setImportError("Import requires a live API connection.");
      return;
    }
    if (isDataControlled) {
      setImportError(
        "Host-controlled data mode cannot mutate session employees yet.",
      );
      return;
    }
    setImportBusy(true);
    setImportError(null);
    try {
      const result = await gateway.importEmployees(file);
      setImportResult(result);
      const next = await refreshEmployees();
      dispatch({ type: "replaceData", data: next });
      setProfileNotice(
        `Import finished: ${result.createdCount} created, ${result.skippedCount} skipped, ${result.errorCount} errors.`,
      );
    } catch (error) {
      setImportError(mutationErrorMessage(error));
    } finally {
      setImportBusy(false);
    }
  }

  function handleReactivateFromInvite(employeeId: string) {
    if (isDataControlled) {
      setProfileNotice(
        "Host-controlled data mode cannot mutate session employees yet.",
      );
      return;
    }
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    const employee = selectEmployeeById(resolvedData, employeeId);
    if (!employee) {
      setProfileNotice("Employee not found.");
      return;
    }
    void (async () => {
      try {
        await gateway.rehireEmployee(employee.workEmail, {});
        const next = await refreshEmployees(employee.id);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice(`${formatEmployeeName(employee)} was rehired.`);
        setCreateOpen(false);
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleAction(kind: EmployeeActionKind, employee: EmployeeRecord) {
    const listReturnView: "directory" | "drafts" | "approvals" =
      workspaceView === "approvals" ? "approvals" : "directory";
    if (kind === "view") {
      openProfile(employee.id, "view", listReturnView);
      setProfileNotice(null);
      return;
    }

    if (kind === "resumeDraft") {
      rememberWizardDraftEmployeeId(employee.id);
      setCreateOpen(true);
      setProfileNotice(null);
      return;
    }

    if (kind === "inviteDraft") {
      rememberWizardDraftEmployeeId(employee.id);
      setCreateOpen(true);
      setProfileNotice(
        "Complete required fields and click Invite.",
      );
      return;
    }

    if (kind === "resendInvite") {
      if (!gateway) {
        setProfileNotice("Live API gateway is required.");
        return;
      }
      void (async () => {
        try {
          await gateway.resendInviteEmployee(employee.id);
          const next = await refreshEmployees(employee.id);
          dispatch({ type: "replaceData", data: next });
          setProfileNotice(
            `Resent invite to ${formatEmployeeName(employee)} (${employee.workEmail}).`,
          );
        } catch (error) {
          setProfileNotice(mutationErrorMessage(error));
        }
      })();
      return;
    }

    if (kind === "viewOnboarding") {
      if (EMPLOYEE_ONBOARDING_HANDOFF_ENABLED) {
        onNavigate?.(`/onboarding`);
      }
      return;
    }

    if (kind === "startOnboarding") {
      if (EMPLOYEE_ONBOARDING_HANDOFF_ENABLED) {
        onNavigate?.(`/onboarding/start/${employee.id}`);
      }
      return;
    }

    if (kind === "edit") {
      // Edit row action removed — View opens the editable profile wizard.
      openProfile(employee.id, "view", listReturnView);
      setProfileNotice(null);
      return;
    }

    if (isDataControlled) {
      setProfileNotice(
        "Host-controlled data mode cannot mutate session employees yet.",
      );
      return;
    }

    if (kind === "softDelete") {
      setPendingDeleteId(employee.id);
      return;
    }

    if (kind === "hardDelete") {
      if (employee.status !== "NEW") {
        setProfileNotice(
          "Hired employees cannot be permanently deleted. Offboard instead.",
        );
        return;
      }
      setPendingHardDeleteId(employee.id);
      return;
    }

    if (kind === "reactivate") {
      if (!gateway) {
        setProfileNotice("Live API gateway is required.");
        return;
      }
      void (async () => {
        try {
          await gateway.rehireEmployee(employee.workEmail, {});
          const next = await refreshEmployees(employee.id);
          dispatch({ type: "replaceData", data: next });
          setProfileNotice(`${formatEmployeeName(employee)} was rehired.`);
        } catch (error) {
          setProfileNotice(mutationErrorMessage(error));
        }
      })();
    }
  }

  function confirmSoftDelete(endDate: string) {
    if (!pendingDeleteId || isDataControlled) {
      setPendingDeleteId(null);
      return;
    }

    const employee = resolvedData.employees.find(
      (row) => row.id === pendingDeleteId,
    );
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      setPendingDeleteId(null);
      return;
    }
    void (async () => {
      try {
        await gateway.deleteEmployee(pendingDeleteId, endDate);
        const next = await refreshEmployees(pendingDeleteId);
        dispatch({ type: "replaceData", data: next });
        setPendingDeleteId(null);
        if (employee) {
          setProfileNotice(
            `${formatEmployeeName(employee)} was offboarded.`,
          );
        }
      } catch (error) {
        setPendingDeleteId(null);
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function confirmHardDelete() {
    if (!pendingHardDeleteId || isDataControlled) {
      setPendingHardDeleteId(null);
      return;
    }

    const employee = resolvedData.employees.find(
      (row) => row.id === pendingHardDeleteId,
    );
    if (!employee || employee.status !== "NEW") {
      setPendingHardDeleteId(null);
      setProfileNotice(
        "Hired employees cannot be permanently deleted. Offboard instead.",
      );
      return;
    }
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      setPendingHardDeleteId(null);
      return;
    }
    void (async () => {
      try {
        await gateway.hardDeleteEmployee(pendingHardDeleteId);
        bumpDirectory();
        const next = {
          ...withoutEmployee(stateDataRef.current, pendingHardDeleteId),
          documents: [],
        };
        dispatch({ type: "replaceData", data: next });
        setPendingHardDeleteId(null);
        if (state.ui.profileEmployeeId === employee.id) {
          dispatch({ type: "closeProfile" });
          onFocusModeChange?.(false);
        }
        setOutcomeDialog(employeeDraftDiscardedOutcome(employee));
      } catch (error) {
        setPendingHardDeleteId(null);
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleOpenSelfProfile() {
    if (!activeActor.employeeId) {
      setProfileNotice("No session employee is linked to this actor.");
      return;
    }

    const self = selectEmployeeById(resolvedData, activeActor.employeeId);
    if (!self) {
      setProfileNotice("No session employee is linked to this actor.");
      return;
    }

    openProfile(
      self.id,
      self.status === "PENDING" ? "add" : "profileView",
      canListEmployees(activeActor) || !canSeeApprovalsWorkspace(activeActor)
        ? "directory"
        : "approvals",
    );
  }

  useEffect(() => {
    if (!isMyProfile) {
      return;
    }
    const selfId = activeActor.employeeId;
    if (!selfId) {
      setSelfLookupStatus("missing");
      return;
    }
    if (!gateway) {
      setSelfLookupStatus(hasSelf ? "found" : "missing");
      return;
    }
    let cancelled = false;
    if (!hasSelf) {
      setSelfLookupStatus("pending");
    }
    void (async () => {
      try {
        const raw = await gateway.getEmployeeById(selfId);
        if (cancelled) {
          return;
        }
        const record = normalizeEmployeeRecord(raw);
        if (!record.id) {
          if (!hasSelf) {
            setSelfLookupStatus("missing");
          }
          return;
        }
        dispatch({
          type: "replaceData",
          data: mergeEmployeeDetail(dataRef.current, record),
        });
        setSelfLookupStatus("found");
      } catch {
        if (!cancelled && !hasSelf) {
          setSelfLookupStatus("missing");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMyProfile, gateway, activeActor.employeeId, hasSelf]);

  useEffect(() => {
    if (!isMyProfile && !openSelfProfileOnMount) {
      return;
    }

    const selfId = activeActor.employeeId;
    if (!selfId || !hasSelf) {
      // Wait until the session employee is present in module data.
      return;
    }

    // openProfile → listDocuments → setEmployeeDocuments rewrites `employees`.
    // Without this guard the effect would re-fire forever.
    if (
      state.ui.profileEmployeeId === selfId &&
      state.ui.profileMode != null
    ) {
      if (openSelfProfileOnMount) {
        onOpenSelfProfileConsumed?.();
      }
      return;
    }

    handleOpenSelfProfile();
    if (openSelfProfileOnMount) {
      onOpenSelfProfileConsumed?.();
    }
    // Host-driven once per My Profile / legacy me navigation; re-run when
    // employees first load so self can be resolved.
  }, [
    isMyProfile,
    openSelfProfileOnMount,
    hasSelf,
    activeActor.employeeId,
    state.ui.profileEmployeeId,
    state.ui.profileMode,
  ]);

  useEffect(() => {
    if (isMyProfile) {
      return;
    }
    const targetId = initialProfileEmployeeId?.trim() ?? "";
    if (!targetId) {
      return;
    }

    if (
      state.ui.profileEmployeeId === targetId &&
      state.ui.profileMode != null
    ) {
      onInitialProfileConsumed?.();
      return;
    }

    let cancelled = false;

    void (async () => {
      if (gateway) {
        try {
          const raw = await gateway.getEmployeeById(targetId);
          if (cancelled) {
            return;
          }
          const record = normalizeEmployeeRecord(raw);
          if (record.id) {
            dispatch({
              type: "replaceData",
              data: mergeEmployeeDetail(dataRef.current, record),
            });
          }
        } catch {
          // Still attempt openProfile; list data may already include the row.
        }
      }
      if (cancelled) {
        return;
      }
      openProfile(targetId, "view", "directory");
      onInitialProfileConsumed?.();
    })();

    return () => {
      cancelled = true;
    };
    // Host deep-link: open once per pending id; openProfile is stable enough.
  }, [isMyProfile, initialProfileEmployeeId, gateway]);

  function handleCloseWizard() {
    if (isMyProfile) {
      return;
    }
    if (onReturnToPortalFromProfile) {
      dispatch({ type: "closeProfile" });
      setPendingProfileChange(null);
      onFocusModeChange?.(false);
      onReturnToPortalFromProfile();
      return;
    }
    const mode = profileMode;
    const returnView = state.ui.returnView;
    dispatch({ type: "closeProfile" });
    setPendingProfileChange(null);
    onFocusModeChange?.(false);

    if (mode === "profileView") {
      onNavigate?.("/employees");
      return;
    }

    if (returnView === "approvals") {
      onNavigate?.("/PendingApprovals");
      return;
    }

    if (returnView === "drafts") {
      onNavigate?.("/employees/drafts");
      return;
    }

    onNavigate?.("/employees");
  }

  function handleSaveDraft(employeeId: string, draft: EmployeeRecord) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    if (profileSaving) {
      return;
    }
    const employee =
      selectEmployeeById(resolvedData, employeeId) ?? profileEmployee;
    const useDraft =
      employee != null && shouldUseDraftSave(profileMode, employee);

    setProfileSaving(true);
    setProfileNotice(null);
    void (async () => {
      try {
        if (useDraft) {
          const patch = buildProfilePatchFromDraft(draft);
          await gateway.draftEmployee(employeeId, {
            ...patch,
            ...buildEmployeeUpdateFromDraft(draft),
            ...identityBodyFromCatalog({
              workMode: draft.workMode,
              nationalIdDocumentTypeId: draft.personal.nationalIdDocumentTypeId,
              nationalIdNumber: draft.personal.nationalIdNumber ?? null,
              nationalIdTypes,
            }),
          });
          const savedSkills = await persistEmployeeSkillEntries(
            gateway,
            employeeId,
            draft.professional.skillEntries,
            employee?.professional.skillEntries,
          );
          const professional = withSkillEntries(
            draft.professional,
            savedSkills,
          );
          dispatch({
            type: "setEmployeeSkills",
            employeeId,
            skillIds: professional.skillIds,
            skillNames: professional.skills,
            skillEntries: savedSkills,
          });
          const next = await refreshEmployees(employeeId);
          dispatch({ type: "replaceData", data: next });
          setProfileNotice(
            formatEmployeeDraftSavedNotice({
              firstName: draft.firstName,
              lastName: draft.lastName,
              employeeCode: draft.employeeCode,
            }),
          );
          setProfileSavedTick((tick) => tick + 1);
          return;
        }

        await gateway.updateEmployee(
          employeeId,
          buildEmployeeUpdateFromDraft(draft),
        );
        const savedSkills = await persistEmployeeSkillEntries(
          gateway,
          employeeId,
          draft.professional.skillEntries,
          employee?.professional.skillEntries,
        );
        const professional = withSkillEntries(draft.professional, savedSkills);
        dispatch({
          type: "setEmployeeSkills",
          employeeId,
          skillIds: professional.skillIds,
          skillNames: professional.skills,
          skillEntries: savedSkills,
        });
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });

        const linkedRequestId = linkedProfileUpdateRequest?.id?.trim() ?? "";
        if (linkedRequestId && onCompleteLinkedProfileUpdateRequest) {
          const changesSummary = buildProfileUpdateCompletionSummary({
            shortDescription:
              linkedProfileUpdateRequest?.shortDescription ?? "",
            longDescription:
              linkedProfileUpdateRequest?.longDescription ?? null,
            changedLines: describeEmployeeProfileChanges(employee, draft),
          });
          try {
            await onCompleteLinkedProfileUpdateRequest({
              requestId: linkedRequestId,
              changesSummary,
            });
          } catch (completeError) {
            setProfileNotice(
              completeError instanceof Error
                ? `Employee saved, but the request could not be marked completed: ${completeError.message}`
                : "Employee saved, but the request could not be marked completed.",
            );
            if (!isMyProfile) {
              dispatch({ type: "closeProfile" });
              onFocusModeChange?.(false);
            }
            return;
          }
          setReturnToPortalAfterNotice(true);
          setProfileNotice("Employee update is completed.");
          if (!isMyProfile) {
            dispatch({ type: "closeProfile" });
            onFocusModeChange?.(false);
          }
          return;
        }

        const roleOrAccessChanged =
          employee != null &&
          (employee.role !== draft.role ||
            employee.accessFlags.createAccess !== draft.accessFlags.createAccess ||
            employee.accessFlags.editAccess !== draft.accessFlags.editAccess ||
            employee.accessFlags.viewAccess !== draft.accessFlags.viewAccess ||
            employee.accessFlags.fullAccess !== draft.accessFlags.fullAccess);
        const successMessage = roleOrAccessChanged
          ? `Role updated. ${formatEmployeeName(draft)} will need to sign out and back in for the new permissions to take effect.`
          : "Employee updated.";
        setProfileNotice(successMessage);
        // Stay on the open profile tab after save (corporate HRMS pattern).
        // Success is shown via EmployeesProfileNoticeDialog over the wizard.
        setProfileSavedTick((tick) => tick + 1);
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      } finally {
        setProfileSaving(false);
      }
    })();
  }

  function handleSubmitWizard(employeeId: string, draft: EmployeeRecord) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        const patch = buildProfilePatchFromDraft(draft);
        await gateway.draftEmployee(employeeId, {
          ...patch,
          ...buildEmployeeUpdateFromDraft(draft),
          ...identityBodyFromCatalog({
            workMode: draft.workMode,
            nationalIdDocumentTypeId: draft.personal.nationalIdDocumentTypeId,
            nationalIdNumber: draft.personal.nationalIdNumber ?? null,
            nationalIdTypes,
          }),
        });
        const savedSkills = await persistEmployeeSkillEntries(
          gateway,
          employeeId,
          draft.professional.skillEntries,
          (
            selectEmployeeById(resolvedData, employeeId) ?? profileEmployee
          )?.professional.skillEntries,
        );
        const professional = withSkillEntries(draft.professional, savedSkills);
        dispatch({
          type: "setEmployeeSkills",
          employeeId,
          skillIds: professional.skillIds,
          skillNames: professional.skills,
          skillEntries: savedSkills,
        });
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice("Profile submitted for review.");
        setProfileSavedTick((tick) => tick + 1);
        // Stay on the open profile tab after submit (same as Save).
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleSaveSkills(employeeId: string, draft: EmployeeRecord) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    if (profileSaving) {
      return;
    }
    setProfileSaving(true);
    setProfileNotice(null);
    void (async () => {
      try {
        const employee =
          selectEmployeeById(resolvedData, employeeId) ?? profileEmployee;
        const previousEntries = employee?.professional.skillEntries;
        const skipSuccessNotice = shouldSkipSkillsSavedNotice(
          previousEntries,
          draft.professional.skillEntries,
        );
        const savedSkills = await persistEmployeeSkillEntries(
          gateway,
          employeeId,
          draft.professional.skillEntries,
          previousEntries,
        );
        const professional = withSkillEntries(
          draft.professional,
          savedSkills,
        );
        dispatch({
          type: "setEmployeeSkills",
          employeeId,
          skillIds: professional.skillIds,
          skillNames: professional.skills,
          skillEntries: savedSkills,
        });
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        if (!skipSuccessNotice) {
          setProfileNotice("Skills saved.");
        }
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      } finally {
        setProfileSaving(false);
      }
    })();
  }

  function handleSubmitProfileChange(
    employeeId: string,
    draft: EmployeeRecord,
  ) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        const employee =
          selectEmployeeById(resolvedData, employeeId) ?? profileEmployee;
        const previousEntries = persistableSkillEntries(
          employee?.professional.skillEntries,
        );
        const savedSkills = await persistEmployeeSkillEntries(
          gateway,
          employeeId,
          draft.professional.skillEntries,
          previousEntries,
        );
        const professional = withSkillEntries(draft.professional, savedSkills);
        dispatch({
          type: "setEmployeeSkills",
          employeeId,
          skillIds: professional.skillIds,
          skillNames: professional.skills,
          skillEntries: savedSkills,
        });

        const raw = await gateway.submitProfileChange(
          employeeId,
          buildProfileChangePayload(draft.contact, draft.personal),
        );
        setPendingProfileChange(mapProfileChangeRequest(raw));

        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice("Profile change submitted for HR review.");
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleSaveSelfProfile(
    employeeId: string,
    draft: EmployeeRecord,
    section: WizardStepId,
  ) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    if (profileSaving) {
      return;
    }
    setProfileSaving(true);
    setProfileNotice(null);
    void (async () => {
      try {
        await gateway.updateEmployee(
          employeeId,
          buildSelfProfileUpdateForSection(section, draft),
        );
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice("Profile saved.");
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      } finally {
        setProfileSaving(false);
      }
    })();
  }

  function handleRequestCorrection(
    employeeId: string,
    field: "firstName" | "lastName" | "middleName" | "dateOfBirth",
    requestedValue: string,
    note?: string,
  ) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        await gateway.createCorrectionRequest(employeeId, {
          fieldName: field,
          requestedValue,
          note,
        });
        setProfileNotice("Correction request submitted.");
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleApproveProfileChange(employeeId: string, changeId: string) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        await gateway.approveProfileChange(employeeId, changeId);
        setPendingProfileChange(null);
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice("Profile change approved.");
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleRejectProfileChange(
    employeeId: string,
    changeId: string,
    comments: string,
  ) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        await gateway.rejectProfileChange(employeeId, changeId, comments);
        setPendingProfileChange(null);
        const next = await refreshEmployees(employeeId);
        dispatch({ type: "replaceData", data: next });
        setProfileNotice("Profile change rejected.");
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleAddDocument(document: EmployeeDocument) {
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    if (!document.file) {
      setProfileNotice("Upload requires a file.");
      return;
    }
    void (async () => {
      try {
        const rows = await gateway.uploadDocuments(
          document.employeeId,
          [document.file!],
          [
            {
              documentTab: "general",
              documentType: "other",
              documentName: document.name,
              fileName: document.name,
            },
          ],
        );
        const mapped = mapApiDocuments(rows, document.employeeId);
        const uploaded = mapped[0];
        if (!uploaded) {
          setProfileNotice("Upload succeeded but no document was returned.");
          return;
        }
        dispatch({
          type: "addEmployeeDocument",
          employeeId: document.employeeId,
          document: {
            ...uploaded,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            file: document.file,
          },
        });
        setProfileNotice(`Uploaded ${uploaded.name}.`);
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleRemoveDocument(documentId: string) {
    if (!profileEmployee) {
      return;
    }
    if (!gateway) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        await gateway.deleteDocument(documentId);
        dispatch({
          type: "removeEmployeeDocument",
          employeeId: profileEmployee.id,
          documentId,
        });
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleDownloadDocument(document: EmployeeDocument) {
    if (document.file) {
      const url = URL.createObjectURL(document.file);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.name;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (gateway && document.objectKey) {
      void (async () => {
        try {
          const blob = await gateway.downloadDocument(
            document.objectKey!,
            document.name,
          );
          const url = URL.createObjectURL(blob);
          const anchor = window.document.createElement("a");
          anchor.href = url;
          anchor.download = document.name;
          anchor.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          setProfileNotice(mutationErrorMessage(error));
        }
      })();
      return;
    }

    setProfileNotice("Document is not available for download.");
  }

  function refreshOnboardingPackets(employeeId: string) {
    if (!gateway) {
      return;
    }
    void (async () => {
      setOnboardingPacketsLoading(true);
      setOnboardingPacketsError(null);
      try {
        const raw = await gateway.listOnboardingPackets(employeeId);
        setOnboardingPackets(parseOnboardingPackets(raw));
      } catch (error) {
        setOnboardingPacketsError(mutationErrorMessage(error));
      } finally {
        setOnboardingPacketsLoading(false);
      }
    })();
  }

  function handleDownloadOnboardingPacketTemplate(documentType: string) {
    if (!gateway || !profileEmployee) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        const blob = await gateway.downloadOnboardingPacketTemplate(
          profileEmployee.id,
          documentType,
        );
        downloadBlob(blob, `${documentType}.pdf`);
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handleDownloadOnboardingPacketCurrent(documentType: string) {
    if (!gateway || !profileEmployee) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        const blob = await gateway.downloadOnboardingPacketCurrent(
          profileEmployee.id,
          documentType,
        );
        const match = onboardingPackets.find(
          (row) => row.documentType === documentType,
        );
        downloadBlob(
          blob,
          match?.current?.fileName || `${documentType}-submitted.pdf`,
        );
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  function handlePreviewOnboardingPacketCurrent(documentType: string) {
    if (!gateway || !profileEmployee) {
      setProfileNotice("Live API gateway is required.");
      return;
    }
    void (async () => {
      try {
        const blob = await gateway.downloadOnboardingPacketCurrent(
          profileEmployee.id,
          documentType,
        );
        const match = onboardingPackets.find(
          (row) => row.documentType === documentType,
        );
        const fileName =
          match?.current?.fileName || `${documentType}-submitted.pdf`;
        setCertificatePreview({
          url: URL.createObjectURL(blob),
          fileName,
          contentType: blob.type || "application/pdf",
          blob,
        });
      } catch (error) {
        setProfileNotice(mutationErrorMessage(error));
      }
    })();
  }

  async function handleListOnboardingPacketVersions(
    documentType: string,
  ): Promise<readonly OnboardingPacketVersion[]> {
    if (!gateway || !profileEmployee) {
      throw new Error("Live API gateway is required.");
    }
    const raw = await gateway.listOnboardingPacketVersions(
      profileEmployee.id,
      documentType,
    );
    return parseOnboardingPacketVersions(raw);
  }

  async function handlePreviewOnboardingPacketVersion(
    documentType: string,
    version: OnboardingPacketVersion,
  ): Promise<void> {
    if (!gateway || !profileEmployee) {
      throw new Error("Live API gateway is required.");
    }
    const blob = await gateway.downloadOnboardingPacketVersion(
      profileEmployee.id,
      documentType,
      version.id,
    );
    setCertificatePreview({
      url: URL.createObjectURL(blob),
      fileName: version.fileName || `${documentType}-v${version.versionNumber}.pdf`,
      contentType: blob.type || version.mimeType || "application/pdf",
      blob,
    });
  }

  async function handleDownloadOnboardingPacketVersion(
    documentType: string,
    version: OnboardingPacketVersion,
  ): Promise<void> {
    if (!gateway || !profileEmployee) {
      throw new Error("Live API gateway is required.");
    }
    const blob = await gateway.downloadOnboardingPacketVersion(
      profileEmployee.id,
      documentType,
      version.id,
    );
    downloadBlob(
      blob,
      version.fileName || `${documentType}-v${version.versionNumber}.pdf`,
    );
  }

  function handleUploadOnboardingPacket(
    documentType: string,
    file: File,
  ): Promise<void> {
    if (!gateway || !profileEmployee) {
      const message = "Live API gateway is required.";
      setProfileNotice(message);
      return Promise.reject(new Error(message));
    }
    return (async () => {
      setOnboardingPacketBusyType(documentType);
      setOnboardingPacketsError(null);
      try {
        const raw = await gateway.uploadOnboardingPacket(
          profileEmployee.id,
          documentType,
          file,
        );
        const updated = parseOnboardingPackets([raw])[0];
        if (updated) {
          setOnboardingPackets((current) =>
            current.map((row) =>
              row.documentType === documentType ? updated : row,
            ),
          );
        } else {
          refreshOnboardingPackets(profileEmployee.id);
        }
        setProfileNotice(`${updated?.label ?? documentType} uploaded.`);
      } catch (error) {
        const message = mutationErrorMessage(error);
        setOnboardingPacketsError(message);
        setProfileNotice(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setOnboardingPacketBusyType(null);
      }
    })();
  }

  function handleDownloadSkillCertificate(
    employeeId: string,
    entry: EmployeeSkillEntry,
  ) {
    if (entry.certificateFile) {
      downloadBlob(entry.certificateFile, entry.certificateFile.name);
      return;
    }
    if (gateway && entry.skillId) {
      void (async () => {
        try {
          const blob = await gateway.downloadSkillCertificate(
            employeeId,
            entry.skillId,
          );
          downloadBlob(blob, entry.certificateFileName || "certificate");
        } catch (error) {
          setProfileNotice(mutationErrorMessage(error));
        }
      })();
      return;
    }
    setProfileNotice("Certificate is not available for download.");
  }

  function handleViewSkillCertificate(
    employeeId: string,
    entry: EmployeeSkillEntry,
  ) {
    function openPreview(blob: Blob, fileName: string) {
      setCertificatePreview({
        url: URL.createObjectURL(blob),
        fileName,
        contentType: blob.type || "",
        blob,
      });
    }

    if (entry.certificateFile) {
      openPreview(
        entry.certificateFile,
        entry.certificateFile.name ||
          entry.certificateFileName ||
          entry.certificateName ||
          "certificate",
      );
      return;
    }
    if (gateway && entry.skillId) {
      void (async () => {
        try {
          const blob = await gateway.downloadSkillCertificate(
            employeeId,
            entry.skillId,
          );
          openPreview(
            blob,
            entry.certificateFileName ||
              entry.certificateName ||
              "certificate",
          );
        } catch (error) {
          setProfileNotice(mutationErrorMessage(error));
        }
      })();
      return;
    }
    setProfileNotice("Certificate is not available to view.");
  }

  function handleTimesheetHandoff(handoff: TimesheetApprovalHandoff) {
    onOpenTimesheetApprovals?.(handoff);
    setProfileNotice(
      `Timesheet approvals handoff sent (${handoff.pendingCount} pending).`,
    );
  }

  function handleWorkspaceChange(view: "directory" | "drafts" | "approvals") {
    if (view === "drafts") {
      dispatch({ type: "setView", view: "directory" });
      setQuery((current) => createDraftsDirectoryQuery({ ...current, page: 1 }));
      onNavigate?.("/employees");
      return;
    }
    dispatch({ type: "setView", view });
    setQuery((current) =>
      createDefaultDirectoryQuery({
        ...current,
        status: "",
        departmentFilterEngaged: false,
        statusFilterEngaged: false,
        sortKey: "name",
        sortDirection: "asc",
        page: 1,
      }),
    );
    onNavigate?.(
      view === "approvals" ? "/PendingApprovals" : "/employees",
    );
  }

  return (
    <ReportingManagerSearchContext.Provider
      value={gateway ? reportingManagerSearch : null}
    >
    <section
      className={
        showSystemAccount
          ? `${EMPLOYEES_MODULE_ROOT} ${ui.moduleAccount}`
          : `${EMPLOYEES_MODULE_ROOT} ${ui.module}`
      }
      data-theme={activeTheme}
      aria-label={isMyProfile ? "My profile" : "Employees module"}
    >
      {!isMyProfile && !showProfileSurface ? (
        <div inert={createOpen ? true : undefined}>
          <WorkspaceSwitcher
            actor={activeActor}
            activeView={workspaceView}
            onChange={handleWorkspaceChange}
          />
        </div>
      ) : null}

      {state.ui.lastError ? (
        <p className={ui.error} role="alert">
          {state.ui.lastError}
        </p>
      ) : null}

      {outcomeDialog ? (
        <EmployeesInviteSuccessDialog
          message={outcomeDialog.message}
          title={outcomeDialog.title}
          onClose={() => setOutcomeDialog(null)}
        />
      ) : null}

      {profileNotice ? (
        <EmployeesProfileNoticeDialog
          message={profileNotice}
          onClose={() => {
            setProfileNotice(null);
            if (returnToPortalAfterNotice) {
              setReturnToPortalAfterNotice(false);
              onLinkedProfileUpdateRequestFinished?.();
            }
          }}
        />
      ) : null}

      <SkillCertificatePreviewDialog
        preview={certificatePreview}
        onClose={() => setCertificatePreview(null)}
        onDownload={() => {
          if (!certificatePreview) {
            return;
          }
          downloadBlob(certificatePreview.blob, certificatePreview.fileName);
        }}
      />

      {showSystemAccount && profileEmployee ? (
        <SystemAccountPanel employee={profileEmployee} />
      ) : null}
      {showWizard && profileEmployee && profileMode ? (
        <EmployeeWizard
          employee={profileEmployee}
          mode={profileMode}
          actor={activeActor}
          data={activeData}
          error={state.ui.lastError}
          saving={profileSaving}
          savedTick={profileSavedTick}
          notice={null}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmitWizard}
          onClose={handleCloseWizard}
          backLabel={
            onReturnToPortalFromProfile ? "Queue" : "Employees"
          }
          showClose={!isMyProfile}
          initialSection={stickerAssetId ? "myAssets" : undefined}
          highlightAssetId={stickerAssetId || undefined}
          assetsGateway={assetsGateway}
          onApprove={(employeeId) => {
            dispatch({ type: "closeProfile" });
            if (EMPLOYEE_ONBOARDING_HANDOFF_ENABLED) {
              onNavigate?.(`/onboarding/start/${employeeId}`);
              setProfileNotice(
                "Complete onboarding checklist, then Activate — employees stay Pending until then.",
              );
              return;
            }
            setProfileNotice(
              `${formatEmployeeName(profileEmployee)} remains Pending.`,
            );
          }}
          onReject={(employeeId, comments) => {
            if (!gateway) {
              setProfileNotice("Live API gateway is required.");
              return;
            }
            void (async () => {
              try {
                await gateway.rejectEmployee(employeeId, comments);
                const next = await refreshEmployees(employeeId);
                dispatch({ type: "replaceData", data: next });
                dispatch({ type: "closeProfile" });
                setProfileNotice("Employee rejected.");
              } catch (error) {
                setProfileNotice(mutationErrorMessage(error));
              }
            })();
          }}
          onAddDocument={handleAddDocument}
          onRemoveDocument={handleRemoveDocument}
          onDownloadDocument={handleDownloadDocument}
          onboardingPackets={onboardingPackets}
          onboardingPacketsLoading={onboardingPacketsLoading}
          onboardingPacketsError={onboardingPacketsError}
          onboardingPacketBusyType={onboardingPacketBusyType}
          onDownloadOnboardingPacketTemplate={
            handleDownloadOnboardingPacketTemplate
          }
          onListOnboardingPacketVersions={handleListOnboardingPacketVersions}
          onPreviewOnboardingPacketVersion={
            handlePreviewOnboardingPacketVersion
          }
          onDownloadOnboardingPacketVersion={
            handleDownloadOnboardingPacketVersion
          }
          onDownloadOnboardingPacketCurrent={
            handleDownloadOnboardingPacketCurrent
          }
          onPreviewOnboardingPacketCurrent={
            handlePreviewOnboardingPacketCurrent
          }
          onUploadOnboardingPacket={handleUploadOnboardingPacket}
          photoSrc={photoSrc}
          onUploadPhoto={(file) => handleUploadPhoto(profileEmployee.id, file)}
          onRemovePhoto={() => handleRemovePhoto(profileEmployee.id)}
          onPhotoError={setProfileNotice}
          pendingProfileChange={pendingProfileChange}
          onSubmitProfileChange={handleSubmitProfileChange}
          onSaveSelfProfile={handleSaveSelfProfile}
          onRequestCorrection={handleRequestCorrection}
          onSaveSkills={handleSaveSkills}
          onDownloadSkillCertificate={handleDownloadSkillCertificate}
          onViewSkillCertificate={handleViewSkillCertificate}
          onApproveProfileChange={handleApproveProfileChange}
          onRejectProfileChange={handleRejectProfileChange}
          orgDepartments={orgDepartments}
          orgLocations={orgLocations}
          orgDesignations={orgDesignations}
          leavePolicyOptions={leavePolicyOptions}
          orgCatalogError={orgCatalogError}
          skillCatalog={skillCatalog}
          nationalIdTypes={nationalIdTypes}
          employeeCatalogError={employeeCatalogError}
          reportingManagerEmployees={reportingManagerEmployees}
          onResendInvite={(employeeId) => {
            const target = selectEmployeeById(resolvedData, employeeId);
            if (!target) {
              return;
            }
            handleAction("resendInvite", target);
          }}
        />
      ) : null}
      {isMyProfile && !showProfileSurface ? (
        <p className={ui.muted} role="status">
          {awaitingLinkedEmployee
            ? "Loading profile…"
            : "No employee record is linked to this account."}
        </p>
      ) : null}
      {!isMyProfile ? (
        <KeepMounted show={!showProfileSurface}>
        <div inert={createOpen ? true : undefined}>
      {workspaceView === "approvals" ? (
        <>
          <PendingApprovals
            actor={activeActor}
            data={activeData}
            onReviewEmployee={(employee) =>
              openProfile(employee.id, "pendingview", "approvals")
            }
            onOpenTimesheetApprovals={handleTimesheetHandoff}
          />
          {gateway ? (
            <CorrectionRequestsPanel
              load={async () => {
                const raw = await gateway.listCorrectionRequests("PENDING");
                if (!Array.isArray(raw)) {
                  return [];
                }
                return raw.map((row) => {
                  const r = row as Record<string, unknown>;
                  return {
                    id: String(r.id ?? ""),
                    employeeId: String(r.employeeId ?? ""),
                    fieldName: String(r.fieldName ?? ""),
                    requestedValue: String(r.requestedValue ?? ""),
                    note: r.note == null ? null : String(r.note),
                    status: String(r.status ?? ""),
                    reviewedBy:
                      r.reviewedBy == null ? null : String(r.reviewedBy),
                    createdAt:
                      r.createdAt == null ? null : String(r.createdAt),
                  };
                });
              }}
              onApprove={async (requestId) => {
                await gateway.approveCorrectionRequest(requestId);
                setProfileNotice("Correction approved and applied.");
              }}
              onReject={async (requestId) => {
                await gateway.rejectCorrectionRequest(requestId);
                setProfileNotice("Correction rejected.");
              }}
            />
          ) : null}
        </>
      ) : (
        <EmployeeDirectory
          actor={activeActor}
          data={resolvedData}
          query={query}
          catalogDepartments={catalogDepartments}
          livePage={gateway && livePage ? livePage : null}
          liveLoading={Boolean(gateway && liveLoading)}
          chooserOpen={chooserOpen}
          importOpen={importOpen}
          importBusy={importBusy}
          importResult={importResult}
          importError={importError}
          exportBusy={exportBusy}
          profileNotice={null}
          onQueryChange={patchQuery}
          onOpenChooser={() => {
            if (!EMPLOYEE_CREATE_ENTRY_CHOOSER_UI_ENABLED) {
              setChooserOpen(false);
              rememberWizardDraftEmployeeId(null);
              setCreateOpen(true);
              return;
            }
            setChooserOpen(true);
          }}
          onCloseChooser={() => setChooserOpen(false)}
          onChooseManual={() => {
            setChooserOpen(false);
            rememberWizardDraftEmployeeId(null);
            setCreateOpen(true);
          }}
          onChooseImport={() => {
            setChooserOpen(false);
            setImportResult(null);
            setImportError(null);
            setImportOpen(true);
          }}
          onCloseImport={() => {
            if (!importBusy) {
              setImportOpen(false);
            }
          }}
          onDownloadTemplate={() => {
            void handleDownloadImportTemplate();
          }}
          onImportFile={(file) => {
            void handleImportFile(file);
          }}
          onExport={() => {
            void handleExportEmployees();
          }}
          onAction={handleAction}
          onDismissProfileNotice={() => setProfileNotice(null)}
          onOpenSelfProfile={handleOpenSelfProfile}
          fetchAvatarBlob={gateway ? fetchAvatarBlob : undefined}
        />
      )}
        </div>
        </KeepMounted>
      ) : null}

      {createOpen && !showProfileSurface && !isMyProfile ? (
        <CreateEmployeePanel
          key={createWizardSessionKey ?? "create-open"}
          open
          actor={activeActor}
          data={activeData}
          reportingManagerEmployees={reportingManagerEmployees}
          employee={
            wizardDraftEmployeeId
              ? selectEmployeeById(resolvedData, wizardDraftEmployeeId) ??
                undefined
              : undefined
          }
          onClose={() => {
            setCreateOpen(false);
            rememberWizardDraftEmployeeId(null);
          }}
          onSubmit={handleCreate}
          onSaveDraft={handleCreateDraft}
          previewEmployeeCode={
            gateway
              ? (input) => gateway.previewEmployeeCode(input)
              : undefined
          }
          onReactivate={handleReactivateFromInvite}
          orgDepartments={orgDepartments}
          orgLocations={orgLocations}
          orgDesignations={orgDesignations}
          leavePolicyOptions={leavePolicyOptions}
          orgCatalogError={orgCatalogError}
          skillCatalog={skillCatalog}
          nationalIdTypes={nationalIdTypes}
          employeeCatalogError={employeeCatalogError}
        />
      ) : null}

      {pendingDeleteEmployee ? (
        <DeactivateEmployeeDialog
          employee={pendingDeleteEmployee}
          data={activeData}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={confirmSoftDelete}
        />
      ) : null}

      {pendingHardDeleteEmployee ? (
        <HardDeleteEmployeeDialog
          employee={pendingHardDeleteEmployee}
          onCancel={() => setPendingHardDeleteId(null)}
          onConfirm={confirmHardDelete}
        />
      ) : null}
    </section>
    </ReportingManagerSearchContext.Provider>
  );
}
