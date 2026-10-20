import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Building2, Check, Hash, Mail, MapPin, UserRound } from "lucide-react";

import {
  ApprovalDialogShell,
  ConfirmDialogShell,
  StatusBadge,
  apiRequest,
} from "@/shared";
import { AppBackLink, AppSectionCard, type AppSectionEditProps } from "@/shared/ui";
import { MyAssetsPanel } from "@/modules/assets/AssetsModule";
import {
  createHttpAssetsGateway,
  type AssetsGateway,
} from "@/modules/assets/gateway";
import {
  EMPLOYEE_ONBOARDING_HANDOFF_ENABLED,
  WIZARD_STEP_LABELS,
  WIZARD_STEPS,
  isVendorRequired,
  type WizardStepId,
} from "../constants";
import {
  canApproveEmployees,
  canCreateEmployee,
  canEditEmployee,
  canShowWizardApproveReject,
  canViewEmployeeAudit,
  dateOfBirthFieldError,
  employeeStatusDisplayLabel,
  employeeStatusDisplayTone,
  formatEmployeeName,
  isProfileReadOnly,
  canUnlockProfileSections,
  isSelfRestrictedProfileEdit,
  profileSectionHasContent,
  resolveSupervisorName,
  shouldUseDraftSave,
  validateEmployeePersonNames,
  validateImmigrationDates,
  validateSelfProfileUpdate,
  isSelfProfileSectionDirty,
  validateSelfProfileSection,
} from "../selectors";
import { contactPhoneError, nationalIdCatalogError, persistableSkillEntries, withSkillEntries } from "../employeeCatalog";
import type {
  EmployeeActor,
  EmployeeDocument,
  EmployeeRecord,
  EmployeeSkillEntry,
  EmployeesModuleData,
  EmployeesProfileMode,
  OrgDepartmentOption,
  OrgDesignationOption,
  OrgLocationOption,
  LeavePolicyOption,
  NationalIdDocumentTypeOption,
  ProfileChangeRequest,
  SkillCatalogOption,
} from "../types";
import { PhotoControls } from "./PhotoControls";
import {
  ContactStep,
  GovernmentWorkAuthView,
  OrganizationStep,
  PersonalStep,
  SkillsStep,
} from "./WizardSteps";
import {
  OnboardingDocumentsStep,
  type OnboardingPacketItem,
  type OnboardingPacketVersion,
} from "./OnboardingDocumentsStep";
import { cx, ui } from "../uiClasses";

function profileSectionId(stepId: WizardStepId): string {
  return `profile-section-${stepId}`;
}

/** Employment, Government/Work Auth, and Assets are view-only on My Profile. */
function isSelfProfileReadOnlySection(stepId: WizardStepId): boolean {
  return (
    stepId === "employment" ||
    stepId === "documents" ||
    stepId === "myAssets"
  );
}

/** Saved HR data for read-only tabs; draft while a staff section is being edited. */
function profileSectionRecord(
  stepId: WizardStepId,
  draft: EmployeeRecord,
  employee: EmployeeRecord,
  selfRestricted: boolean,
  staffSectionEdit: boolean,
  editingSections: ReadonlySet<WizardStepId>,
  readOnly: boolean,
): EmployeeRecord {
  if (selfRestricted && isSelfProfileReadOnlySection(stepId)) {
    return employee;
  }
  if (staffSectionEdit) {
    return editingSections.has(stepId) ? draft : employee;
  }
  if (readOnly) {
    return employee;
  }
  return draft;
}

function skillEntriesSnapshot(
  entries: readonly EmployeeSkillEntry[],
): string {
  return JSON.stringify(
    persistableSkillEntries(entries).map((row) => ({
      skillId: row.skillId,
      proficiency: row.proficiency,
      yearsExperience: row.yearsExperience,
      certificateFileName: row.certificateFileName ?? "",
      certificateName: row.certificateName ?? "",
      certificateExpiresOn: row.certificateExpiresOn ?? "",
      certificateObjectKey: row.certificateObjectKey ?? "",
      pendingCertificate: row.certificateFile
        ? `${row.certificateFile.name}:${row.certificateFile.size}:${row.certificateFile.lastModified}`
        : "",
    })),
  );
}

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "?";
}

/** Hide technical seed/system placeholders from audit attribution. */
function auditPersonName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  const lower = trimmed.toLowerCase();
  if (lower === "seed" || lower === "system") return "—";
  return trimmed;
}

interface EmployeeWizardProps {
  readonly employee: EmployeeRecord;
  readonly mode: EmployeesProfileMode;
  readonly actor: EmployeeActor;
  readonly data: EmployeesModuleData;
  readonly error: string | null;
  /** Async save in flight — disables Save and shows progress on the button. */
  readonly saving?: boolean;
  /**
   * Increments after a successful staff profile save so the wizard can exit
   * section edit mode while staying on the current tab.
   */
  readonly savedTick?: number;
  /** Non-error status shown in the wizard (success / progress). */
  readonly notice?: string | null;
  readonly onSaveDraft: (employeeId: string, draft: EmployeeRecord) => void;
  readonly onSubmit: (employeeId: string, draft: EmployeeRecord) => void;
  readonly onClose: () => void;
  /** Parent view name for the top-left back link (e.g. "Employees"). */
  readonly backLabel?: string;
  readonly onApprove: (employeeId: string) => void;
  readonly onReject: (employeeId: string, comments: string) => void;
  readonly onAddDocument: (document: EmployeeDocument) => void;
  readonly onRemoveDocument: (documentId: string) => void;
  readonly onDownloadDocument?: (document: EmployeeDocument) => void | Promise<void>;
  readonly onboardingPackets?: readonly OnboardingPacketItem[];
  readonly onboardingPacketsLoading?: boolean;
  readonly onboardingPacketsError?: string | null;
  readonly onboardingPacketBusyType?: string | null;
  readonly onDownloadOnboardingPacketTemplate?: (
    documentType: string,
  ) => void | Promise<void>;
  readonly onListOnboardingPacketVersions?: (
    documentType: string,
  ) => Promise<readonly OnboardingPacketVersion[]>;
  readonly onPreviewOnboardingPacketVersion?: (
    documentType: string,
    version: OnboardingPacketVersion,
  ) => void | Promise<void>;
  readonly onDownloadOnboardingPacketVersion?: (
    documentType: string,
    version: OnboardingPacketVersion,
  ) => void | Promise<void>;
  readonly onDownloadOnboardingPacketCurrent?: (
    documentType: string,
  ) => void | Promise<void>;
  readonly onPreviewOnboardingPacketCurrent?: (
    documentType: string,
  ) => void | Promise<void>;
  readonly onUploadOnboardingPacket?: (
    documentType: string,
    file: File,
  ) => void | Promise<void>;
  readonly photoSrc?: string | null;
  readonly onUploadPhoto?: (file: File) => void;
  readonly onRemovePhoto?: () => void;
  readonly onPhotoError?: (message: string) => void;
  /** When false, hide Back and footer Close (e.g. My Profile host). */
  readonly showClose?: boolean;
  readonly pendingProfileChange?: ProfileChangeRequest | null;
  readonly onSubmitProfileChange?: (employeeId: string, draft: EmployeeRecord) => void;
  readonly onSaveSelfProfile?: (
    employeeId: string,
    draft: EmployeeRecord,
    section: WizardStepId,
  ) => void;
  readonly onRequestCorrection?: (
    employeeId: string,
    field: "firstName" | "lastName" | "middleName" | "dateOfBirth",
    requestedValue: string,
    note?: string,
  ) => void;
  readonly onSaveSkills?: (employeeId: string, draft: EmployeeRecord) => void;
  readonly onDownloadSkillCertificate?: (
    employeeId: string,
    entry: EmployeeSkillEntry,
  ) => void;
  readonly onViewSkillCertificate?: (
    employeeId: string,
    entry: EmployeeSkillEntry,
  ) => void;
  readonly onApproveProfileChange?: (employeeId: string, changeId: string) => void;
  readonly onRejectProfileChange?: (
    employeeId: string,
    changeId: string,
    comments: string,
  ) => void;
  readonly onResendInvite?: (employeeId: string) => void;
  readonly orgDepartments?: readonly OrgDepartmentOption[];
  readonly orgLocations?: readonly OrgLocationOption[];
  readonly orgDesignations?: readonly OrgDesignationOption[];
  readonly leavePolicyOptions?: readonly LeavePolicyOption[];
  readonly orgCatalogError?: string | null;
  readonly skillCatalog?: readonly SkillCatalogOption[];
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
  readonly employeeCatalogError?: string | null;
  readonly reportingManagerEmployees?: readonly EmployeeRecord[] | null;
  /** Open this profile tab first (sticker scan → Assets). */
  readonly initialSection?: WizardStepId;
  /** Sticker QR Asset ID — highlight the matching row; deny is a modal, not tab copy. */
  readonly highlightAssetId?: string;
  /** Injected in tests; live Profile uses the HTTP Assets gateway. */
  readonly assetsGateway?: AssetsGateway;
}

export function EmployeeWizard({
  employee,
  mode,
  actor,
  data,
  error,
  saving = false,
  savedTick = 0,
  notice = null,
  onSaveDraft,
  onSubmit,
  onClose,
  backLabel = "Employees",
  onApprove,
  onReject,
  onAddDocument: _onAddDocument,
  onRemoveDocument: _onRemoveDocument,
  onDownloadDocument: _onDownloadDocument,
  onboardingPackets = [],
  onboardingPacketsLoading = false,
  onboardingPacketsError = null,
  onboardingPacketBusyType = null,
  onDownloadOnboardingPacketTemplate,
  onListOnboardingPacketVersions,
  onPreviewOnboardingPacketVersion,
  onDownloadOnboardingPacketVersion,
  onDownloadOnboardingPacketCurrent,
  onPreviewOnboardingPacketCurrent,
  onUploadOnboardingPacket,
  photoSrc,
  onUploadPhoto,
  onRemovePhoto,
  onPhotoError,
  showClose = true,
  pendingProfileChange = null,
  onSubmitProfileChange,
  onSaveSelfProfile,
  onRequestCorrection: _onRequestCorrection,
  onSaveSkills,
  onDownloadSkillCertificate,
  onViewSkillCertificate,
  onApproveProfileChange,
  onRejectProfileChange,
  onResendInvite,
  orgDepartments = [],
  orgLocations = [],
  orgDesignations = [],
  leavePolicyOptions = [],
  orgCatalogError = null,
  skillCatalog = [],
  nationalIdTypes = [],
  employeeCatalogError = null,
  reportingManagerEmployees = null,
  initialSection,
  highlightAssetId = "",
  assetsGateway: assetsGatewayOverride,
}: EmployeeWizardProps) {
  const [draft, setDraft] = useState<EmployeeRecord>(employee);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComments, setRejectComments] = useState("");
  const [profileRejectOpen, setProfileRejectOpen] = useState(false);
  const [profileRejectComments, setProfileRejectComments] = useState("");
  const [activeSection, setActiveSection] = useState<WizardStepId>(() =>
    initialSection === "myAssets" ? "myAssets" : "personal",
  );
  const [pendingSection, setPendingSection] = useState<WizardStepId | null>(
    null,
  );
  const [personalEditing, setPersonalEditing] = useState(false);
  const [contactEditing, setContactEditing] = useState(false);
  const [editingSections, setEditingSections] = useState<
    ReadonlySet<WizardStepId>
  >(() => new Set());
  const tabsId = useId();
  const tabRefs = useRef<Partial<Record<WizardStepId, HTMLButtonElement | null>>>(
    {},
  );

  const canEdit = canEditEmployee(actor, employee, data.hierarchy);
  const selfRestricted = isSelfRestrictedProfileEdit(actor, employee);
  const completeProfileSave = selfRestricted && Boolean(onSaveSelfProfile);
  const readOnly = selfRestricted
    ? false
    : isProfileReadOnly(mode, canEdit);
  const staffSectionEdit = canUnlockProfileSections(mode, canEdit);
  const stepUnlocked = (step: WizardStepId) =>
    staffSectionEdit && editingSections.has(step);
  const anyStaffSectionEditing =
    staffSectionEdit && editingSections.size > 0;
  const stepReadOnly = selfRestricted
    ? true
    : staffSectionEdit
      ? !stepUnlocked(activeSection)
      : readOnly;
  const useDraftSave = !selfRestricted && shouldUseDraftSave(mode, employee);
  const canEditPhoto =
    (selfRestricted ||
      stepUnlocked("personal") ||
      (!readOnly && !staffSectionEdit)) &&
    Boolean(onUploadPhoto && onRemovePhoto);
  const showApproveReject = canShowWizardApproveReject(actor, employee, mode);
  const showResendInvite =
    Boolean(employee.inviteOutstanding) &&
    Boolean(onResendInvite) &&
    canCreateEmployee(actor) &&
    !selfRestricted;
  const showAudit = mode === "view" && canViewEmployeeAudit(actor);
  const showProfileChangeReview =
    Boolean(pendingProfileChange) &&
    canApproveEmployees(actor) &&
    Boolean(onApproveProfileChange && onRejectProfileChange);
  const visibleSteps: readonly WizardStepId[] = useMemo(
    () => WIZARD_STEPS.filter((candidate) => candidate !== "access"),
    [],
  );
  const assetsGateway = useMemo(
    () =>
      assetsGatewayOverride ?? createHttpAssetsGateway({ request: apiRequest }),
    [assetsGatewayOverride],
  );
  const [hasAssignedAssets, setHasAssignedAssets] = useState(false);
  useEffect(() => {
    if (!assetsGateway || !employee.id) {
      setHasAssignedAssets(false);
      return;
    }
    let cancelled = false;
    void assetsGateway
      .listEmployeeAssets(employee.id)
      .then((rows) => {
        if (!cancelled) {
          setHasAssignedAssets(rows.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasAssignedAssets(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetsGateway, employee.id]);
  const tabSteps: readonly WizardStepId[] = useMemo(
    () =>
      visibleSteps.filter(
        (stepId) =>
          stepId !== "organization" && stepId !== "professional",
      ),
    [visibleSteps],
  );
  const displayName = draft.personal.preferredName || formatEmployeeName(draft);
  const roleLine = [draft.title, draft.department].filter(Boolean).join(" • ");
  const orgDepartment = draft.departmentName?.trim() ?? "";
  const orgLocation = draft.locationName?.trim() ?? "";
  const managerName = resolveSupervisorName(
    data,
    draft.supervisorId,
    draft.supervisorName,
  );
  const showManager =
    Boolean(draft.supervisorId) && managerName.trim() !== "" && managerName !== "—";
  const skillsDirty =
    skillEntriesSnapshot(draft.professional.skillEntries) !==
    skillEntriesSnapshot(employee.professional.skillEntries);
  const selfUpdateIssue = selfRestricted
    ? (() => {
        if (activeSection === "skills") {
          return skillsDirty
            ? null
            : {
                message: "Add or update a skill to save.",
                step: "skills" as const,
              };
        }
        if (activeSection === "onboardingDocs") {
          return null;
        }
        if (isSelfProfileReadOnlySection(activeSection)) {
          return {
            message: "This section is read-only.",
            step: activeSection,
          };
        }
        if (!isSelfProfileSectionDirty(activeSection, draft, employee)) {
          return {
            message: "Make a change before saving.",
            step: activeSection,
          };
        }
        return validateSelfProfileSection(activeSection, draft);
      })()
    : null;

  useEffect(() => {
    setDraft(employee);
    setLocalError(null);
  }, [employee]);

  useEffect(() => {
    if (initialSection === "myAssets") {
      setActiveSection("myAssets");
    }
  }, [initialSection]);

  useEffect(() => {
    setPersonalEditing(false);
    setContactEditing(false);
    setEditingSections(new Set());
  }, [employee.id]);

  useEffect(() => {
    if (savedTick <= 0) {
      return;
    }
    setPersonalEditing(false);
    setContactEditing(false);
    setEditingSections(new Set());
  }, [savedTick]);

  function toggleStaffSectionEdit(step: WizardStepId) {
    setEditingSections((current) => {
      const next = new Set(current);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  }

  function stopAllEditing() {
    setPersonalEditing(false);
    setContactEditing(false);
    setEditingSections(new Set());
    setLocalError(null);
  }

  const profileEditing =
    personalEditing || contactEditing || anyStaffSectionEditing;

  function staffSectionEditProps(
    step: WizardStepId,
    label: string,
  ): AppSectionEditProps {
    if (!staffSectionEdit) {
      return {};
    }
    return {
      editing: editingSections.has(step),
      onEdit: () => toggleStaffSectionEdit(step),
      editLabel: `Edit ${label}`,
      stopEditLabel: `Stop editing ${label}`,
    };
  }

  function patchDraft(patch: Partial<EmployeeRecord>) {
    setDraft((current) => ({ ...current, ...patch }));
    setLocalError(null);
  }

  /** Returns failing step id, or null when valid. */
  function validateAll(): WizardStepId | null {
    if (readOnly && !selfRestricted && !anyStaffSectionEditing) {
      return null;
    }

    if (selfRestricted) {
      const result = validateSelfProfileUpdate(draft);
      if (result) {
        setLocalError(result.message);
        return result.step;
      }
      return null;
    }

    const nameError = validateEmployeePersonNames({
      firstName: draft.firstName,
      lastName: draft.lastName,
    });
    if (nameError) {
      setLocalError(nameError);
      return "personal";
    }
    const dobError = dateOfBirthFieldError(draft.personal.dateOfBirth, {
      required: false,
    });
    if (dobError) {
      setLocalError(dobError);
      return "personal";
    }

    const phoneError = contactPhoneError(draft.contact.phone);
    if (phoneError) {
      setLocalError(phoneError);
      return "personal";
    }
    const alternatePhoneError = contactPhoneError(draft.contact.alternatePhone);
    if (alternatePhoneError) {
      setLocalError(`Alternate phone: ${alternatePhoneError}`);
      return "personal";
    }

    if (!draft.firstName.trim()) {
      setLocalError("First name is required.");
      return "personal";
    }

    if (visibleSteps.includes("documents")) {
      const message = validateImmigrationDates(
        draft.immigration.workAuthStart,
        draft.immigration.workAuthEnd,
        draft.immigration.subtype,
      );
      if (message) {
        setLocalError(message);
        return "documents";
      }
      if (staffSectionEdit && editingSections.has("documents")) {
        const idError = nationalIdCatalogError({
          nationality: draft.personal.nationality || null,
          documentTypeId: draft.personal.nationalIdDocumentTypeId || null,
          nationalIdLast4: draft.personal.nationalIdLast4 || null,
          nationalIdNumber: draft.personal.nationalIdNumber ?? null,
        });
        if (idError) {
          setLocalError(idError);
          return "documents";
        }
      }
    }

    if (visibleSteps.includes("organization")) {
      if (isVendorRequired(draft.employmentType) && !draft.vendorId) {
        setLocalError("Vendor is required for contractor employment.");
        return "organization";
      }
      const idError = nationalIdCatalogError({
        nationality: draft.personal.nationality || null,
        documentTypeId: draft.personal.nationalIdDocumentTypeId || null,
        nationalIdLast4: draft.personal.nationalIdLast4 || null,
        nationalIdNumber: draft.personal.nationalIdNumber ?? null,
      });
      if (idError) {
        setLocalError(idError);
        return "organization";
      }
    }

    return null;
  }

  function normalizeSection(stepId: WizardStepId): WizardStepId {
    return stepId === "organization" || stepId === "professional"
      ? "employment"
      : stepId;
  }

  function goToSection(stepId: WizardStepId) {
    setActiveSection(normalizeSection(stepId));
    setPendingSection(null);
    setLocalError(null);
  }

  function requestGoToSection(stepId: WizardStepId) {
    const target = normalizeSection(stepId);
    if (target === activeSection) {
      return;
    }
    if (
      selfRestricted &&
      Boolean(onSaveSelfProfile) &&
      isSelfProfileSectionDirty(activeSection, draft, employee)
    ) {
      setPendingSection(target);
      return;
    }
    goToSection(target);
  }

  function handleSaveAndSwitchSection() {
    if (!onSaveSelfProfile || pendingSection == null) {
      return;
    }
    const issue = validateSelfProfileSection(activeSection, draft);
    if (issue) {
      // Emergency email errors render under the Email field while typing.
      if (!/^Enter a valid email\.?$/i.test(issue.message)) {
        setLocalError(issue.message);
      } else {
        setLocalError(null);
      }
      setPendingSection(null);
      return;
    }
    const next = pendingSection;
    onSaveSelfProfile(employee.id, draft, activeSection);
    goToSection(next);
  }

  function handleTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const currentIndex = tabSteps.indexOf(activeSection);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabSteps.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabSteps.length) % tabSteps.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else {
      nextIndex = tabSteps.length - 1;
    }

    const next = tabSteps[nextIndex];
    if (!next) {
      return;
    }
    requestGoToSection(next);
    // Focus moves after switch (or stays if blocked by unsaved dialog).
    if (
      !(
        selfRestricted &&
        Boolean(onSaveSelfProfile) &&
        isSelfProfileSectionDirty(activeSection, draft, employee)
      )
    ) {
      tabRefs.current[next]?.focus();
    }
  }

  function handleSaveDraft() {
    if (saving) {
      return;
    }
    const failedStep = validateAll();
    if (failedStep) {
      goToSection(failedStep);
      return;
    }
    onSaveDraft(employee.id, draft);
  }

  function handleSubmit() {
    if (saving) {
      return;
    }
    const failedStep = validateAll();
    if (failedStep) {
      goToSection(failedStep);
      return;
    }
    onSubmit(employee.id, draft);
  }

  function handleSubmitProfileChange() {
    if (!onSubmitProfileChange) {
      return;
    }
    const failedStep = validateAll();
    if (failedStep) {
      goToSection(failedStep);
      return;
    }
    onSubmitProfileChange(employee.id, draft);
  }

  return (
    <section
      className={ui.wizard}
      aria-label={`${formatEmployeeName(draft)} profile`}
    >
      {showClose ? (
        <AppBackLink onClick={onClose} disabled={saving}>
          {backLabel}
        </AppBackLink>
      ) : null}
      <header className={ui.profileHero} aria-label={`${displayName} identity`}>
        <div className={ui.profileHeroRow}>
          <div className={ui.profileHeroAvatarCol}>
            <div className={ui.profileHeroAvatarWrap}>
              <span className={ui.profileHeroAvatar} aria-hidden="true">
                {photoSrc ? (
                  <img className={ui.profileHeroPhoto} src={photoSrc} alt="" />
                ) : (
                  initialsFor(displayName)
                )}
              </span>
              {canEditPhoto ? (
                <PhotoControls
                  variant="overlay"
                  canEdit
                  hasPhoto={Boolean(photoSrc || draft.avatarObjectKey)}
                  currentPhotoSrc={photoSrc}
                  onUpload={onUploadPhoto!}
                  onRemove={onRemovePhoto!}
                  onError={(message) => {
                    setLocalError(message);
                    onPhotoError?.(message);
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className={ui.profileHeroBody}>
            <h1 className={ui.profileHeroName}>{displayName}</h1>
            {roleLine ? <p className={ui.profileHeroRole}>{roleLine}</p> : null}
            {orgDepartment || orgLocation || showManager ? (
              <p className={ui.profileHeroMeta}>
                {orgDepartment ? (
                  <span className={ui.profileHeroMetaItem}>
                    <Building2 size={13} className={ui.profileHeroMetaIcon} />
                    {orgDepartment}
                  </span>
                ) : null}
                {orgLocation ? (
                  <span className={ui.profileHeroMetaItem}>
                    <MapPin size={13} className={ui.profileHeroMetaIcon} />
                    {orgLocation}
                  </span>
                ) : null}
                {showManager ? (
                  <span className={ui.profileHeroMetaItem}>
                    <UserRound size={13} className={ui.profileHeroMetaIcon} />
                    Reports to {managerName}
                  </span>
                ) : null}
              </p>
            ) : null}
            <div className={ui.profileHeroPills}>
              {draft.isSystemAccount ? (
                <span className={ui.profileHeroPill}>System account</span>
              ) : null}
              <StatusBadge
                label={employeeStatusDisplayLabel(draft)}
                tone={employeeStatusDisplayTone(draft)}
              />
              {draft.businessEmployeeId ? (
                <span className={ui.profileHeroPill}>
                  <Hash size={13} className={ui.profileHeroPillIcon} />
                  ID: {draft.businessEmployeeId}
                </span>
              ) : null}
              {draft.employeeCode ? (
                <span className={ui.profileHeroPill}>
                  <Hash size={13} className={ui.profileHeroPillIcon} />
                  Code: {draft.employeeCode}
                </span>
              ) : null}
              {draft.workEmail ? (
                <span className={ui.profileHeroPill}>
                  <Mail size={13} className={ui.profileHeroPillIcon} />
                  {draft.workEmail}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      {showAudit ? (
        <dl className={ui.wizardAudit}>
          <div>
            <dt>Approved by</dt>
            <dd>
              {draft.status === "ACTIVE"
                ? auditPersonName(draft.updatedBy)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Created by</dt>
            <dd>{auditPersonName(draft.createdBy)}</dd>
          </div>
        </dl>
      ) : null}

      {selfRestricted && pendingProfileChange ? (
        <p className={ui.notice} role="status">
          Residential address and emergency contact changes are pending HR review.
          You can update the request below.
        </p>
      ) : null}

      {showProfileChangeReview && pendingProfileChange ? (
        <section
          className={ui.profileReview}
          aria-label="Pending profile change review"
        >
          <h3 className={ui.profileReviewTitle}>
            Pending profile change
          </h3>
          <div className={ui.profileReviewGrid}>
            <div>
              <p className={ui.muted}>Current</p>
              <pre className={ui.profileReviewBlock}>
                {formatContactSummary(draft.contact)}
              </pre>
            </div>
            <div>
              <p className={ui.muted}>Proposed</p>
              <pre className={ui.profileReviewBlock}>
                {formatProposedSummary(pendingProfileChange.payload)}
              </pre>
            </div>
          </div>
          <div className={ui.wizardActions}>
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={() =>
                onApproveProfileChange?.(employee.id, pendingProfileChange.id)
              }
            >
              Approve profile change
            </button>
            <button
              type="button"
              className={ui.btnDanger}
              onClick={() => setProfileRejectOpen(true)}
            >
              Reject profile change
            </button>
          </div>
        </section>
      ) : null}

      <div className={ui.profileTabsRow}>
        <div
          className={ui.profileTabs}
          role="tablist"
          aria-label="Profile sections"
          onKeyDown={handleTabListKeyDown}
        >
          {tabSteps.map((stepId) => {
            const selected = activeSection === stepId;
            const hasContent =
              stepId === "onboardingDocs"
                ? onboardingPackets.length > 0 &&
                  onboardingPackets.every((row) => row.status === "Uploaded")
                : stepId === "myAssets"
                  ? hasAssignedAssets
                  : profileSectionHasContent(
                      stepId,
                      profileSectionRecord(
                        stepId,
                        draft,
                        employee,
                        selfRestricted,
                        staffSectionEdit,
                        editingSections,
                        readOnly,
                      ),
                    );
            return (
              <button
                key={stepId}
                type="button"
                role="tab"
                id={`${tabsId}-${stepId}-tab`}
                ref={(node) => {
                  tabRefs.current[stepId] = node;
                }}
                className={selected ? ui.profileTabActive : ui.profileTab}
                aria-label={WIZARD_STEP_LABELS[stepId]}
                aria-selected={selected}
                aria-controls={profileSectionId(stepId)}
                tabIndex={selected ? 0 : -1}
                onClick={() => requestGoToSection(stepId)}
              >
                {WIZARD_STEP_LABELS[stepId]}
                {hasContent ? (
                  <span className={ui.profileTabStatus} aria-hidden="true">
                    <Check
                      size={14}
                      className={ui.profileTabCheck}
                      aria-hidden="true"
                    />
                  </span>
                ) : (
                  <span className={ui.profileTabStatus} aria-hidden="true">
                    <span className={ui.profileTabDot} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          className={ui.profileTabsLegend}
          aria-hidden="true"
        >
          <span
            className={cx(
              ui.profileTabsLegendItem,
              ui.profileTabsLegendIncomplete,
            )}
          >
            <span className={ui.profileTabDot} />
            Not completed
          </span>
          <span
            className={cx(
              ui.profileTabsLegendItem,
              ui.profileTabsLegendComplete,
            )}
          >
            <Check size={14} className={ui.profileTabCheck} />
            Completed
          </span>
        </div>
      </div>

      <div className={ui.wizardSections}>
        {activeSection === "personal" ? (
          <section
            id={profileSectionId("personal")}
            className={cx(ui.wizardSectionStack, "gap-5")}
            role="tabpanel"
            aria-labelledby={`${tabsId}-personal-tab`}
          >
            <PersonalStep
              draft={draft}
              readOnly={
                selfRestricted
                  ? !personalEditing
                  : staffSectionEdit
                    ? !stepUnlocked("personal")
                    : stepReadOnly
              }
              selfRestricted={
                selfRestricted && !personalEditing ? false : selfRestricted
              }
              requireSelfFields={selfRestricted}
              onChange={patchDraft}
              {...(selfRestricted
                ? {
                    editing: personalEditing,
                    onEdit: () =>
                      setPersonalEditing((current) => !current),
                    editLabel: "Edit personal information",
                    stopEditLabel: "Stop editing personal information",
                  }
                : staffSectionEditProps("personal", "personal information"))}
            />
          </section>
        ) : null}

        {activeSection === "employment" ? (
          <section
            id={profileSectionId("employment")}
            className={ui.wizardSectionStack}
            role="tabpanel"
            aria-labelledby={`${tabsId}-employment-tab`}
          >
            <OrganizationStep
              draft={draft}
              readOnly={
                staffSectionEdit
                  ? !stepUnlocked("employment")
                  : stepReadOnly
              }
              onChange={patchDraft}
              dataSupervisors={data.supervisors}
              dataEmployees={data.employees}
              dataVendors={data.vendors}
              orgDepartments={orgDepartments}
              orgLocations={orgLocations}
              orgDesignations={orgDesignations}
              leavePolicyOptions={leavePolicyOptions}
              orgCatalogError={orgCatalogError}
              selfRestricted={selfRestricted}
              reportingManagerEmployees={reportingManagerEmployees}
              {...staffSectionEditProps(
                "employment",
                "employment information",
              )}
            />
          </section>
        ) : null}

        {activeSection === "contact" ? (
          <AppSectionCard
            id={profileSectionId("contact")}
            title="Emergency Contacts"
            titleId={`${profileSectionId("contact")}-heading`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-contact-tab`}
            {...(selfRestricted
              ? {
                  editing: contactEditing,
                  onEdit: () =>
                    setContactEditing((current) => !current),
                  editLabel: "Edit emergency contacts",
                  stopEditLabel: "Stop editing emergency contacts",
                }
              : {})}
          >
            <ContactStep
              draft={draft}
              readOnly={selfRestricted ? !contactEditing : true}
              selfRestricted={
                selfRestricted && !contactEditing ? false : selfRestricted
              }
              requireSelfFields={selfRestricted}
              onChange={patchDraft}
            />
          </AppSectionCard>
        ) : null}

        {activeSection === "documents" ? (
          <section
            id={profileSectionId("documents")}
            className={ui.wizardSectionStack}
            role="tabpanel"
            aria-labelledby={`${tabsId}-documents-tab`}
          >
            <GovernmentWorkAuthView
              draft={draft}
              savedEmployee={employee}
              readOnly={
                staffSectionEdit
                  ? !stepUnlocked("documents")
                  : stepReadOnly
              }
              onChange={patchDraft}
              nationalIdTypes={nationalIdTypes}
              employeeCatalogError={employeeCatalogError}
              {...(actor.role !== "EMPLOYEE"
                ? staffSectionEditProps(
                    "documents",
                    "government and work auth",
                  )
                : {})}
            />
          </section>
        ) : null}

        {activeSection === "onboardingDocs" ? (
          <section
            id={profileSectionId("onboardingDocs")}
            className={ui.wizardSectionStack}
            role="tabpanel"
            aria-labelledby={`${tabsId}-onboardingDocs-tab`}
          >
            <OnboardingDocumentsStep
              items={onboardingPackets}
              loading={onboardingPacketsLoading}
              error={onboardingPacketsError}
              busyType={onboardingPacketBusyType}
              canUpload={
                Boolean(onUploadOnboardingPacket) && selfRestricted
              }
              canDownloadTemplate={
                Boolean(onDownloadOnboardingPacketTemplate) && selfRestricted
              }
              onDownloadTemplate={(documentType) =>
                void onDownloadOnboardingPacketTemplate?.(documentType)
              }
              onListVersions={onListOnboardingPacketVersions}
              onPreviewVersion={onPreviewOnboardingPacketVersion}
              onDownloadVersion={onDownloadOnboardingPacketVersion}
              onDownloadCurrent={
                onDownloadOnboardingPacketCurrent
                  ? (documentType) =>
                      void onDownloadOnboardingPacketCurrent(documentType)
                  : undefined
              }
              onPreviewCurrent={
                onPreviewOnboardingPacketCurrent
                  ? (documentType) =>
                      void onPreviewOnboardingPacketCurrent(documentType)
                  : undefined
              }
              onUpload={async (documentType, file) => {
                if (!onUploadOnboardingPacket) {
                  throw new Error("Upload is not available.");
                }
                await onUploadOnboardingPacket(documentType, file);
              }}
            />
          </section>
        ) : null}

        {activeSection === "skills" ? (
          <section
            id={profileSectionId("skills")}
            className={ui.profileCard}
            role="tabpanel"
            aria-labelledby={`${tabsId}-skills-tab`}
          >
            <div className={ui.wizardSectionStack}>
              <SkillsStep
                headingId={`${profileSectionId("skills")}-heading`}
                draft={draft}
                readOnly={!selfRestricted}
                onChange={patchDraft}
                skillCatalog={skillCatalog}
                employeeCatalogError={employeeCatalogError}
                onPersistEntries={
                  selfRestricted && onSaveSkills
                    ? (entries) => {
                        const nextDraft: EmployeeRecord = {
                          ...draft,
                          professional: withSkillEntries(
                            draft.professional,
                            entries,
                          ),
                        };
                        setDraft(nextDraft);
                        onSaveSkills(employee.id, nextDraft);
                      }
                    : undefined
                }
                onDownloadCertificate={
                  onDownloadSkillCertificate
                    ? (entry) =>
                        onDownloadSkillCertificate(employee.id, entry)
                    : undefined
                }
                onViewCertificate={
                  onViewSkillCertificate
                    ? (entry) => onViewSkillCertificate(employee.id, entry)
                    : undefined
                }
              />
            </div>
          </section>
        ) : null}

        {activeSection === "myAssets" ? (
          <section
            id={profileSectionId("myAssets")}
            className={ui.profileCard}
            role="tabpanel"
            aria-labelledby={`${tabsId}-myAssets-tab`}
          >
            <div className={ui.wizardSectionStack}>
              <div className={ui.skillsHeader}>
                <div className={ui.skillsHeaderCopy}>
                  <h2
                    id={`${tabsId}-myAssets-heading`}
                    className={ui.sectionHeaderTitle}
                  >
                    {WIZARD_STEP_LABELS.myAssets}
                  </h2>
                  <p className={ui.sectionHeaderLede}>
                    Hardware currently assigned to this employee (read-only).
                  </p>
                </div>
              </div>
              <MyAssetsPanel
                gateway={assetsGateway}
                employeeId={employee.id}
                highlightAssetId={highlightAssetId}
              />
            </div>
          </section>
        ) : null}

      <footer className={ui.profileFooter}>
        {(localError || error) &&
        !(localError && /^Enter a valid email\.?$/i.test(localError)) ? (
          <p className={ui.error} role="alert">
            {localError ?? error}
          </p>
        ) : null}
        {notice && !localError && !error ? (
          <p className={ui.notice} role="status">
            {notice}
          </p>
        ) : null}
        <div className={ui.wizardActions}>
          {showClose && profileEditing ? (
            <button
              type="button"
              className={ui.btnGhost}
              onClick={stopAllEditing}
              disabled={saving}
            >
              Close
            </button>
          ) : null}

          {showResendInvite ? (
            <button
              type="button"
              className={ui.btnGhost}
              disabled={saving}
              onClick={() => onResendInvite?.(employee.id)}
            >
              Resend invite
            </button>
          ) : null}

          {selfRestricted &&
          activeSection !== "skills" &&
          activeSection !== "onboardingDocs" &&
          !isSelfProfileReadOnlySection(activeSection) &&
          (completeProfileSave || onSubmitProfileChange) ? (
            <button
              type="button"
              className={ui.btnPrimary}
              disabled={saving || Boolean(selfUpdateIssue)}
              title={selfUpdateIssue?.message}
              onClick={() => {
                if (completeProfileSave && onSaveSelfProfile) {
                  onSaveSelfProfile(employee.id, draft, activeSection);
                  return;
                }
                handleSubmitProfileChange();
              }}
            >
              {completeProfileSave
                ? "Save profile"
                : pendingProfileChange
                  ? "Update request"
                  : "Submit for HR review"}
            </button>
          ) : null}

          {!selfRestricted && (!readOnly || anyStaffSectionEditing) && useDraftSave ? (
            <>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={saving}
                onClick={handleSaveDraft}
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={saving}
                onClick={handleSubmit}
              >
                {saving ? "Submitting…" : "Submit"}
              </button>
            </>
          ) : null}

          {!selfRestricted &&
          (!readOnly || anyStaffSectionEditing) &&
          !useDraftSave ? (
            <button
              type="button"
              className={ui.btnPrimary}
              disabled={saving}
              onClick={handleSaveDraft}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          ) : null}

          {showApproveReject ? (
            <>
              {EMPLOYEE_ONBOARDING_HANDOFF_ENABLED ? (
                <button
                  type="button"
                  className={ui.btnPrimary}
                  disabled={saving}
                  onClick={() => onApprove(employee.id)}
                >
                  Continue onboarding
                </button>
              ) : null}
              <button
                type="button"
                className={ui.btnDanger}
                disabled={saving}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </button>
            </>
          ) : null}
        </div>
      </footer>
      </div>

      <ConfirmDialogShell
        open={pendingSection != null}
        title="Save profile before switching?"
        description="You have unsaved changes on this tab. Save your profile before switching tabs, or cancel to stay here."
        confirmLabel="Save profile"
        cancelLabel="Cancel"
        busy={saving}
        onConfirm={handleSaveAndSwitchSection}
        onClose={() => setPendingSection(null)}
      />

      <ApprovalDialogShell
        open={rejectOpen}
        mode="reject"
        title="Reject employee?"
        description="Rejection comments are required before this employee can be rejected."
        rejectLabel="Confirm reject"
        actionError={
          localError && rejectOpen ? localError : null
        }
        onApprove={() => undefined}
        onReject={() => {
          if (!rejectComments.trim()) {
            setLocalError("Rejection comments are required.");
            return;
          }
          onReject(employee.id, rejectComments.trim());
          setRejectOpen(false);
          setRejectComments("");
          setLocalError(null);
        }}
        onClose={() => {
          setRejectOpen(false);
          setRejectComments("");
          setLocalError(null);
        }}
      >
        <label className={ui.field}>
          <span className={ui.fieldLabel}>
            Comments (required)
          </span>
          <textarea
            rows={3}
            value={rejectComments}
            onChange={(event) => setRejectComments(event.target.value)}
          />
        </label>
      </ApprovalDialogShell>

      <ApprovalDialogShell
        open={profileRejectOpen}
        mode="reject"
        title="Reject profile change?"
        description="Optional comments are shared with the employee."
        rejectLabel="Confirm reject"
        actionError={
          localError && profileRejectOpen ? localError : null
        }
        onApprove={() => undefined}
        onReject={() => {
          if (!pendingProfileChange || !onRejectProfileChange) {
            return;
          }
          onRejectProfileChange(
            employee.id,
            pendingProfileChange.id,
            profileRejectComments.trim(),
          );
          setProfileRejectOpen(false);
          setProfileRejectComments("");
          setLocalError(null);
        }}
        onClose={() => {
          setProfileRejectOpen(false);
          setProfileRejectComments("");
          setLocalError(null);
        }}
      >
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Comments</span>
          <textarea
            rows={3}
            value={profileRejectComments}
            onChange={(event) => setProfileRejectComments(event.target.value)}
          />
        </label>
      </ApprovalDialogShell>
    </section>
  );
}

function formatContactSummary(contact: EmployeeRecord["contact"]): string {
  return [
    contact.personalEmail || null,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.alternatePhone ? `Alt phone: ${contact.alternatePhone}` : null,
    [contact.addressLine1, contact.addressLine2].filter(Boolean).join(", "),
    [contact.city, contact.state, contact.postalCode].filter(Boolean).join(", "),
    contact.country,
    `Emergency: ${contact.emergencyName || "—"} (${contact.emergencyRelation || "—"})`,
    contact.emergencyPhone || "—",
    contact.alternateEmergencyName ||
      contact.alternateEmergencyPhone ||
      contact.alternateEmergencyRelation
      ? `Alternate: ${contact.alternateEmergencyName || "—"} (${contact.alternateEmergencyRelation || "—"})`
      : null,
    contact.alternateEmergencyName ||
      contact.alternateEmergencyPhone ||
      contact.alternateEmergencyRelation
      ? contact.alternateEmergencyPhone || "—"
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatProposedSummary(
  payload: ProfileChangeRequest["payload"],
): string {
  return [
    payload.gender ? `Gender: ${payload.gender}` : null,
    payload.maritalStatus ? `Marital status: ${payload.maritalStatus}` : null,
    payload.nationality ? `Nationality: ${payload.nationality}` : null,
    payload.ethnicity ? `Ethnicity: ${payload.ethnicity}` : null,
    formatContactSummary({
      personalEmail: payload.personalEmail ?? "",
      phone: payload.phone ?? "",
      alternatePhone: payload.alternatePhone ?? "",
      addressLine1: payload.addressLine1 ?? "",
      addressLine2: payload.addressLine2 ?? "",
      city: payload.city ?? "",
      state: payload.state ?? "",
      postalCode: payload.postalCode ?? "",
      country: payload.country ?? "",
      emergencyName: payload.emergencyName ?? "",
      emergencyPhone: payload.emergencyPhone ?? "",
      emergencyRelation: payload.emergencyRelation ?? "",
      emergencyEmail: payload.emergencyEmail ?? "",
      emergencyEmployeeId: payload.emergencyEmployeeId ?? null,
      alternateEmergencyName: payload.alternateEmergencyName ?? "",
      alternateEmergencyPhone: payload.alternateEmergencyPhone ?? "",
      alternateEmergencyRelation: payload.alternateEmergencyRelation ?? "",
      alternateEmergencyEmail: payload.alternateEmergencyEmail ?? "",
    }),
  ]
    .filter(Boolean)
    .join("\n");
}
