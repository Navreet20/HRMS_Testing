import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import {
  ConfirmDialogShell,
  HRMS_ROLE_LABELS,
  IdentityBlock,
  StatusBadge,
  useBodyScrollLock,
  type HrmsRole,
} from "@/shared";
import {
  AppCheckbox,
  AppDateField,
  AppSectionEditButton,
  localIsoToday,
} from "@/shared/ui";
import {
  COUNTRY_CODE_OPTIONS,
  EMERGENCY_RELATION_OPTIONS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  FULL_ACCESS_FLAGS,
  HIRE_EMPLOYMENT_TYPES,
  isVendorRequired,
  VIEW_ONLY_ACCESS_FLAGS,
} from "../constants";
import {
  parseEmploymentTypeToUi,
  patchEmploymentType,
} from "../employmentClassification";
import {
  checkWorkEmailUniqueness,
  canSaveEmployeeDraft,
  dateOfBirthFieldError,
  formatEmployeeName,
  getAllowedTargetRoles,
  needsProfileCompletion,
  personNameFieldError,
  buildReportingManagerComboboxOptions,
  selectReportingManagerOptions,
  syncAccessRoleFields,
  validateEmployeePersonNames,
} from "../selectors";
import { emptyOrgCatalogHint } from "../orgCatalogHints";
import {
  buildCreateEmployeeInput,
  filterRealCompanies,
  govIdFormFromEmployee,
  hireDraftSaveError,
  hireEmploymentStepError,
  hireGovIdStepError,
  hirePersonalStepError,
  initialCreateWizardStep,
  isMaskedNationalIdNumber,
  maskedNationalIdFromLast4,
  nationalIdLast4ForSelectedType,
  isPayrollStartApplicable,
  isUsableCompanyName,
  isValidPersonalEmail,
  minEmployeeDateOfBirth,
  personalEmailFieldError,
  resolveCreateCompany,
  resolvePayrollStartDate,
  shouldShowCompanyPicker,
  todayIsoDate,
} from "../employeeCatalog";
import type {
  CreateEmployeeInput,
  EmployeeAccessFlags,
  EmployeeActor,
  EmployeeRecord,
  EmployeesModuleData,
  EmploymentCategory,
  EmploymentType,
  WorkerType,
  WorkSchedule,
  JobRank,
  NationalIdDocumentTypeOption,
  OrgDepartmentOption,
  OrgDesignationOption,
  OrgLocationOption,
  LeavePolicyOption,
  SkillCatalogOption,
} from "../types";
import { EmployeeNationalIdFields } from "./employeeCatalogFields";
import { EmployeesPhoneInput } from "./EmployeesPhoneInput";
import { EmployeesSearchCombobox } from "./EmployeesSearchCombobox";
import { useReportingManagerSearch } from "./reportingManagerSearch";
import { DepartmentCascadeFields } from "./DepartmentCascadeFields";
import { EmployeesSelect } from "./EmployeesSelect";
import { CloseIcon } from "./icons";
import { PhotoControls } from "./PhotoControls";
import { canViewFullNationalId } from "../fieldPermissions";
import { cx, ui } from "../uiClasses";
import { CREATE_OVERLAY_CHROME } from "@/shared/ui/fieldChrome";

export interface EmployeeAccessSavePayload {
  readonly role: HrmsRole;
  readonly department: string;
  readonly accessFlags: EmployeeAccessFlags;
  readonly supervisorId: string | null;
  readonly projectIds: readonly string[];
  readonly company: string;
  readonly employmentType: EmploymentType;
  readonly workerType?: WorkerType;
  readonly workSchedule?: WorkSchedule | null;
  readonly employmentCategory?: EmploymentCategory;
  readonly vendorId: string | null;
  readonly jobRank: JobRank;
  readonly jobDescription: string;
  readonly startDate: string;
  /** LEAVE-DATA-5 — required on Access edit / mid-year policy change. */
  readonly timesheetRequired: boolean;
  readonly leavePolicyId: string | null;
}

interface EmployeeAccessPanelProps {
  readonly mode: "create" | "view" | "edit";
  readonly actor: EmployeeActor;
  readonly data: EmployeesModuleData;
  readonly reportingManagerEmployees?: readonly EmployeeRecord[] | null;
  readonly employee?: EmployeeRecord;
  readonly onClose: () => void;
  readonly onCreate?: (
    input: CreateEmployeeInput,
  ) => boolean | Promise<boolean>;
  readonly onSaveDraft?: (
    input: CreateEmployeeInput,
    options?: { readonly close?: boolean; readonly announce?: boolean },
  ) => boolean | Promise<boolean | string>;
  readonly previewEmployeeCode?: (input: {
    readonly firstName: string;
    readonly lastName: string;
  }) => Promise<{ employeeCode: string }>;
  readonly onSave?: (
    employeeId: string,
    payload: EmployeeAccessSavePayload,
  ) => void;
  readonly onReactivate?: (employeeId: string) => void;
  readonly onOpenFullProfile?: (mode: "view" | "edit") => void;
  readonly photoSrc?: string | null;
  readonly onUploadPhoto?: (file: File) => void;
  readonly onRemovePhoto?: () => void;
  readonly onPhotoError?: (message: string) => void;
  readonly orgDepartments?: readonly OrgDepartmentOption[];
  readonly orgLocations?: readonly OrgLocationOption[];
  readonly orgDesignations?: readonly OrgDesignationOption[];
  readonly leavePolicyOptions?: readonly LeavePolicyOption[];
  readonly orgCatalogError?: string | null;
  readonly skillCatalog?: readonly SkillCatalogOption[];
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
  readonly employeeCatalogError?: string | null;
}

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  workEmail: string;
  department: string;
  departmentId: string;
  locationId: string;
  designationId: string;
  personalEmail: string;
  gender: string;
  nationality: string;
  ethnicity: string;
  maritalStatus: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  title: string;
  company: string;
  employmentType: EmploymentType | "";
  workerType: WorkerType;
  workSchedule: WorkSchedule | "";
  employmentCategory: EmploymentCategory;
  vendorId: string;
  jobRank: JobRank;
  jobDescription: string;
  gradeBand: string;
  role: HrmsRole;
  supervisorId: string;
  projectIds: string[];
  primaryProjectId: string;
  startDate: string;
  payrollStartDate: string;
  payrollSameAsJoining: boolean;
  timesheetRequired: boolean;
  leavePolicyId: string;
  accessFlags: EmployeeAccessFlags;
  workMode: string;
  nationalIdDocumentTypeId: string;
  nationalIdNumber: string;
  skillIds: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  emergencyContactEmail: string;
}

const CREATE_WIZARD_STEPS = [
  { id: 1, label: "Personal Info" },
  { id: 2, label: "Employment Info" },
  { id: 3, label: "Gov ID" },
  { id: 4, label: "Review" },
] as const;

const CODE_PREVIEW_DEBOUNCE_MS = 350;

type CreateWizardStep = (typeof CREATE_WIZARD_STEPS)[number]["id"];
type PersonalFieldKey =
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "personalEmail"
  | "workEmail";

function officialEmailFieldError(value: string): string | null {
  const text = value.trim();
  if (!text) {
    return "Official email is required.";
  }
  if (!isValidPersonalEmail(text)) {
    return "Enter a valid official email address.";
  }
  return null;
}

function personalFieldError(
  field: PersonalFieldKey,
  form: Pick<FormState, PersonalFieldKey>,
): string | null {
  if (field === "firstName") {
    return personNameFieldError(form.firstName, "First name");
  }
  if (field === "lastName") {
    return personNameFieldError(form.lastName, "Last name");
  }
  if (field === "workEmail") {
    return officialEmailFieldError(form.workEmail);
  }
  if (field === "personalEmail") {
    return personalEmailFieldError(form.personalEmail);
  }
  return dateOfBirthFieldError(form.dateOfBirth, { required: true });
}

function personalFieldsToTouch(): PersonalFieldKey[] {
  return ["firstName", "lastName", "dateOfBirth", "personalEmail", "workEmail"];
}

const CREATE_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function createDialogFocusable(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(CREATE_FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (element.getAttribute("aria-disabled") === "true") {
      return false;
    }
    if (element.tabIndex < 0) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function CreateLabel({
  children,
  required = false,
  optional = false,
}: {
  readonly children: string;
  readonly required?: boolean;
  readonly optional?: boolean;
}) {
  return (
    <span className={required ? ui.fieldLabel : ui.fieldLabelOptional}>
      {children}
      {required ? (
        <span className={ui.fieldRequired} aria-hidden="true">
          {" *"}
        </span>
      ) : optional ? (
        <span className={ui.fieldHint}>{" (optional)"}</span>
      ) : null}
    </span>
  );
}

function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | null;
}) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className={ui.fieldError}>
      {message}
    </p>
  );
}

function HireDateInput({
  value,
  onChange,
  disabled,
  invalid = false,
  describedBy,
  minDate,
  maxDate,
  "aria-label": ariaLabel,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly "aria-label"?: string;
  readonly required?: boolean;
}) {
  return (
    <AppDateField
      value={value}
      disabled={disabled}
      invalid={invalid}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      minDate={minDate}
      maxDate={maxDate}
      onChange={onChange}
    />
  );
}

function createStepRequiredError(
  step: CreateWizardStep,
  form: FormState,
  nationalIdTypes: readonly NationalIdDocumentTypeOption[],
): string | null {
  if (step === 1) {
    const missing = hirePersonalStepError(form);
    if (missing) {
      return missing;
    }
    return validateEmployeePersonNames({
      firstName: form.firstName,
      lastName: form.lastName,
    });
  }
  if (step === 2) {
    return hireEmploymentStepError(form);
  }
  if (step === 3) {
    return hireGovIdStepError({
      nationality: form.nationality,
      nationalIdDocumentTypeId: form.nationalIdDocumentTypeId,
      nationalIdNumber: form.nationalIdNumber,
      nationalIdTypes,
    });
  }
  return null;
}

function ReviewSection({
  active,
  editing,
  title,
  description,
  onToggle,
  fullWidth = false,
  children,
}: {
  readonly active: boolean;
  readonly editing: boolean;
  readonly title: string;
  readonly description?: string;
  readonly onToggle: () => void;
  readonly fullWidth?: boolean;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  if (!active) {
    return children;
  }
  return (
    <section
      className={cx(ui.reviewCard, fullWidth && ui.colSpanFull)}
      aria-labelledby={headingId}
    >
      <header className={ui.reviewCardHeader}>
        <h3 id={headingId} className={ui.reviewCardTitle}>
          {title}
        </h3>
        <AppSectionEditButton
          editing={editing}
          onClick={onToggle}
          label={title}
        />
      </header>
      {description ? (
        <p className={cx(ui.muted, "mb-[0.75rem]")}>{description}</p>
      ) : null}
      <div className={ui.reviewCardGrid}>{children}</div>
    </section>
  );
}

function createInitialForm(
  actor: EmployeeActor,
  employee?: EmployeeRecord,
): FormState {
  if (employee) {
    const primary =
      employee.projectAssignments.find(
        (assignment) =>
          assignment.assignmentType === "PRIMARY" &&
          assignment.status === "ACTIVE",
      )?.projectId ??
      employee.projectIds[0] ??
      "";
    // Drafts often persist FULL_TIME as a DB default before the user chooses.
    // Keep the hire field empty until employment org fields are started.
    const hireEmploymentStarted = Boolean(
      employee.departmentId?.trim() ||
        employee.locationId?.trim() ||
        employee.designationId?.trim(),
    );
    return {
      firstName: employee.firstName,
      middleName: employee.middleName ?? "",
      lastName: employee.lastName,
      dateOfBirth: employee.personal.dateOfBirth ?? "",
      workEmail: employee.workEmail,
      department: employee.department,
      departmentId: employee.departmentId ?? "",
      locationId: employee.locationId ?? "",
      designationId: employee.designationId ?? "",
      personalEmail: employee.contact.personalEmail,
      gender: employee.personal.gender,
      nationality: employee.personal.nationality,
      ethnicity: employee.personal.ethnicity,
      maritalStatus: employee.personal.maritalStatus,
      phone: employee.contact.phone,
      addressLine1: employee.contact.addressLine1,
      addressLine2: employee.contact.addressLine2,
      city: employee.contact.city,
      state: employee.contact.state,
      postalCode: employee.contact.postalCode,
      country: employee.contact.country,
      title: employee.title,
      company: isUsableCompanyName(employee.company) ? employee.company : "",
      employmentType: hireEmploymentStarted ? employee.employmentType : "",
      workerType:
        employee.workerType ??
        parseEmploymentTypeToUi(employee.employmentType).workerType,
      workSchedule: (() => {
        const parsed = parseEmploymentTypeToUi(employee.employmentType);
        const schedule =
          employee.workSchedule !== undefined
            ? employee.workSchedule
            : parsed.workSchedule;
        return schedule ?? "";
      })(),
      employmentCategory:
        employee.employmentCategory ??
        parseEmploymentTypeToUi(employee.employmentType).employmentCategory,
      vendorId: employee.vendorId ?? "",
      jobRank: employee.jobRank,
      jobDescription: employee.jobDescription,
      gradeBand: employee.gradeBand ?? "",
      role: employee.role,
      supervisorId: employee.supervisorId ?? "",
      projectIds: [...employee.projectIds],
      primaryProjectId: primary,
      startDate: employee.startDate,
      payrollStartDate: employee.payrollStartDate ?? employee.startDate,
      payrollSameAsJoining:
        !employee.payrollStartDate ||
        employee.payrollStartDate === employee.startDate,
      timesheetRequired: Boolean(employee.timesheetRequired),
      leavePolicyId: employee.leavePolicyId ?? "",
      accessFlags: employee.accessFlags,
      workMode: employee.workMode ?? "",
      ...(() => {
        const gov = govIdFormFromEmployee(employee, []);
        return {
          nationalIdDocumentTypeId: gov.nationalIdDocumentTypeId,
          nationalIdNumber: gov.nationalIdNumber,
        };
      })(),
      skillIds: [...employee.professional.skillIds],
      emergencyContactName: employee.contact.emergencyName,
      emergencyContactPhone: employee.contact.emergencyPhone,
      emergencyContactRelation: employee.contact.emergencyRelation,
      emergencyContactEmail: employee.contact.emergencyEmail,
    };
  }

  // New create/draft: always EMPLOYEE — role assignment deferred to RBAC.
  // No role picker on hire; Admin / HR are bootstrap accounts only.
  const role: HrmsRole = "EMPLOYEE";
  const seedCompany = isUsableCompanyName(actor.company)
    ? actor.company!.trim()
    : "";

  return {
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    workEmail: "",
    department: "EMPLOYEE",
    departmentId: "",
    locationId: "",
    designationId: "",
    personalEmail: "",
    gender: "",
    nationality: "",
    ethnicity: "",
    maritalStatus: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    title: "",
    company: seedCompany,
    employmentType: "",
    workerType: "EMPLOYEE",
    workSchedule: "FULL_TIME",
    employmentCategory: "REGULAR",
    vendorId: "",
    jobRank: "RANK_7",
    jobDescription: "",
    gradeBand: "",
    role,
    supervisorId: "",
    projectIds: [],
    primaryProjectId: "",
    startDate: todayIsoDate(),
    payrollStartDate: todayIsoDate(),
    payrollSameAsJoining: true,
    timesheetRequired: false,
    leavePolicyId: "",
    accessFlags: VIEW_ONLY_ACCESS_FLAGS,
    workMode: "",
    nationalIdDocumentTypeId: "",
    nationalIdNumber: "",
    skillIds: [],
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    emergencyContactEmail: "",
  };
}

/** Modal employee create/invite form; view/edit stay full-page. */
export function EmployeeAccessPanel({
  mode,
  actor,
  data,
  reportingManagerEmployees = null,
  employee,
  onClose,
  onCreate,
  onSaveDraft,
  previewEmployeeCode,
  onSave,
  onReactivate,
  onOpenFullProfile,
  photoSrc,
  onUploadPhoto,
  onRemovePhoto,
  onPhotoError,
  orgDepartments = [],
  orgLocations = [],
  orgDesignations = [],
  leavePolicyOptions = [],
  orgCatalogError = null,
  nationalIdTypes = [],
  employeeCatalogError = null,
}: EmployeeAccessPanelProps) {
  const titleId = useId();
  const readOnly = mode === "view";
  const isCreate = mode === "create";
  const canEditPhoto = mode === "edit" && Boolean(onUploadPhoto && onRemovePhoto);

  const [persistedDraftId, setPersistedDraftId] = useState<string | null>(
    () => employee?.id ?? null,
  );
  const persistedDraftIdRef = useRef<string | null>(employee?.id ?? null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState(() => createInitialForm(actor, employee));
  const [createStep, setCreateStep] = useState<CreateWizardStep>(() =>
    initialCreateWizardStep(employee),
  );
  const [reviewEdits, setReviewEdits] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [inactiveConflictId, setInactiveConflictId] = useState<string | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [touchedPersonal, setTouchedPersonal] = useState<
    ReadonlySet<PersonalFieldKey>
  >(() => new Set());
  const [codePreview, setCodePreview] = useState(
    () => employee?.employeeCode ?? "",
  );
  const fieldErrorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const nationalIdStashRef = useRef<string>("");
  const onReview = isCreate && createStep === 4;
  const showPersonalStep = isCreate && (createStep === 1 || createStep === 4);
  const showEmploymentStep = !isCreate || createStep === 2 || createStep === 4;
  const showGovIdStep = isCreate && (createStep === 3 || createStep === 4);
  const showEmergencyStep = false;

  useEffect(() => {
    if (!error) {
      return;
    }
    errorRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
    });
  }, [error]);

  const canRevealFullNationalId = canViewFullNationalId(actor.role);

  function fieldLocked(field: string): boolean {
    return readOnly || (onReview && !reviewEdits.has(field));
  }

  function toggleReviewEdit(field: string) {
    const wasEditing = reviewEdits.has(field);
    setReviewEdits((current) => {
      const next = new Set(current);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
        if (field === "govId") {
          setForm((formState) => ({
            ...formState,
            nationalIdNumber: isMaskedNationalIdNumber(
              formState.nationalIdNumber,
            )
              ? ""
              : formState.nationalIdNumber,
          }));
        }
      }
      return next;
    });
    if (field !== "govId" || !isCreate) {
      return;
    }
    if (!wasEditing && canRevealFullNationalId) {
      setForm((current) => syncGovIdFormFields(true, current));
      return;
    }
    if (wasEditing) {
      setForm((current) => syncGovIdFormFields(false, current));
    }
  }

  const roleOptions = useMemo(() => {
    const allowed = getAllowedTargetRoles(actor);
    if (employee && !allowed.includes(employee.role)) {
      return [employee.role, ...allowed];
    }
    return allowed;
  }, [actor, employee]);

  const actorCompany = useMemo(() => {
    if (isUsableCompanyName(actor.company)) {
      return actor.company!.trim();
    }
    if (actor.employeeId) {
      const self = data.employees.find((row) => row.id === actor.employeeId);
      if (self && isUsableCompanyName(self.company)) {
        return self.company.trim();
      }
    }
    return "";
  }, [actor.company, actor.employeeId, data.employees]);

  const companies = useMemo(() => {
    const values = new Set(
      filterRealCompanies(data.employees.map((row) => row.company)),
    );
    if (isUsableCompanyName(form.company)) {
      values.add(form.company.trim());
    }
    if (actorCompany) {
      values.add(actorCompany);
    }
    return [...values].sort();
  }, [actorCompany, data.employees, form.company]);

  const companyOptions = useMemo(
    () => companies.map((company) => ({ value: company, label: company })),
    [companies],
  );
  const showCompanyPicker = shouldShowCompanyPicker(companies);
  const payrollApplicable = isPayrollStartApplicable(form.employmentType);
  const personalPreviewReady =
    isCreate &&
    !employee?.employeeCode &&
    personalFieldError("firstName", form) === null &&
    personalFieldError("lastName", form) === null &&
    personalFieldError("dateOfBirth", form) === null;

  useEffect(() => {
    if (employee?.id) {
      persistedDraftIdRef.current = employee.id;
      setPersistedDraftId(employee.id);
    }
    if (employee?.employeeCode) {
      setCodePreview(employee.employeeCode);
    }
  }, [employee?.employeeCode, employee?.id]);

  useEffect(() => {
    if (!isCreate) {
      return;
    }
    if (employee?.employeeCode) {
      setCodePreview(employee.employeeCode);
      return;
    }
    if (!personalPreviewReady) {
      setCodePreview("");
      return;
    }
    if (!previewEmployeeCode) {
      return;
    }
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewEmployeeCode({ firstName, lastName })
        .then((result) => {
          if (!cancelled) {
            setCodePreview(result.employeeCode);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCodePreview("");
          }
        });
    }, CODE_PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    employee?.employeeCode,
    form.firstName,
    form.lastName,
    isCreate,
    personalPreviewReady,
    previewEmployeeCode,
  ]);

  useEffect(() => {
    if (!isCreate || showCompanyPicker) {
      return;
    }
    const resolved = resolveCreateCompany({
      company: form.company,
      companies,
      actorCompany,
    });
    if (form.company !== resolved) {
      setForm((current) => ({ ...current, company: resolved }));
    }
  }, [actorCompany, companies, form.company, isCreate, showCompanyPicker]);

  function resolveRevealedNationalIdNumber(
    currentNumber: string,
  ): string | null {
    if (!canRevealFullNationalId) {
      return null;
    }
    if (employee) {
      const fromEmployee = employee.personal.nationalIdNumber?.trim() ?? "";
      if (fromEmployee && !isMaskedNationalIdNumber(fromEmployee)) {
        return fromEmployee;
      }
    }
    if (currentNumber.trim() && !isMaskedNationalIdNumber(currentNumber)) {
      return currentNumber.trim();
    }
    const stashed = nationalIdStashRef.current.trim();
    return stashed && !isMaskedNationalIdNumber(stashed) ? stashed : null;
  }

  function syncGovIdFormFields(
    revealFullNumber: boolean,
    current: FormState,
  ): FormState {
    if (!employee) {
      if (revealFullNumber) {
        const revealed = resolveRevealedNationalIdNumber(current.nationalIdNumber);
        if (revealed) {
          return { ...current, nationalIdNumber: revealed };
        }
      }
      if (
        onReview &&
        !revealFullNumber &&
        current.nationalIdNumber.trim() &&
        !isMaskedNationalIdNumber(current.nationalIdNumber)
      ) {
        nationalIdStashRef.current = current.nationalIdNumber.trim();
        const masked = maskedNationalIdFromLast4(
          current.nationalIdNumber.replace(/\D/g, "").slice(-4),
        );
        if (masked) {
          return { ...current, nationalIdNumber: masked };
        }
      }
      return current;
    }
    const gov = govIdFormFromEmployee(employee, nationalIdTypes, {
      revealFullNumber,
    });
    let nationalIdNumber = gov.nationalIdNumber;
    if (revealFullNumber) {
      const revealed = resolveRevealedNationalIdNumber(current.nationalIdNumber);
      if (revealed) {
        nationalIdNumber = revealed;
      }
    } else if (onReview) {
      if (
        current.nationalIdNumber.trim() &&
        !isMaskedNationalIdNumber(current.nationalIdNumber)
      ) {
        nationalIdStashRef.current = current.nationalIdNumber.trim();
      }
      const last4 =
        employee.personal.nationalIdLast4?.trim() ||
        nationalIdStashRef.current.replace(/\D/g, "").slice(-4) ||
        current.nationalIdNumber.replace(/\D/g, "").slice(-4);
      nationalIdNumber =
        maskedNationalIdFromLast4(last4) || gov.nationalIdNumber;
    }
    const nationality = current.nationality || gov.nationality;
    const nationalIdDocumentTypeId =
      current.nationalIdDocumentTypeId || gov.nationalIdDocumentTypeId;
    if (
      current.nationality === nationality &&
      current.nationalIdDocumentTypeId === nationalIdDocumentTypeId &&
      current.nationalIdNumber === nationalIdNumber
    ) {
      return current;
    }
    return {
      ...current,
      nationality,
      nationalIdDocumentTypeId,
      nationalIdNumber,
    };
  }

  useEffect(() => {
    if (!isCreate) {
      return;
    }
    if (onReview && !reviewEdits.has("govId")) {
      setForm((current) => syncGovIdFormFields(false, current));
      return;
    }
    if (!employee) {
      return;
    }
    if (onReview && reviewEdits.has("govId")) {
      return;
    }
    const revealFullNumber =
      canRevealFullNationalId &&
      (createStep === 3 || (onReview && reviewEdits.has("govId")));
    setForm((current) => {
      const synced = syncGovIdFormFields(revealFullNumber, current);
      const keepTypedNumber =
        createStep === 3 &&
        current.nationalIdNumber.trim() &&
        !isMaskedNationalIdNumber(current.nationalIdNumber);
      if (keepTypedNumber) {
        return { ...synced, nationalIdNumber: current.nationalIdNumber };
      }
      return synced;
    });
  }, [
    canRevealFullNationalId,
    createStep,
    employee,
    isCreate,
    nationalIdTypes,
    onReview,
    reviewEdits,
    employee?.personal.nationalIdDocumentType,
    employee?.personal.nationalIdLast4,
    employee?.personal.nationalIdNumber,
    employee?.personal.nationality,
  ]);

  useBodyScrollLock(isCreate);

  useEffect(() => {
    if (!isCreate) {
      return;
    }
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      returnFocusRef.current?.focus();
    };
  }, [isCreate]);

  useLayoutEffect(() => {
    if (!isCreate) {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const focusable = createDialogFocusable(dialog);
      const initial = focusable.find((element) =>
        element.hasAttribute("data-dialog-initial-focus"),
      );
      if (initial) {
        initial.focus();
        return;
      }
      dialog.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isCreate, createStep]);

  useEffect(() => {
    if (!isCreate || !dirty) {
      return;
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, isCreate]);

  const employmentTypeOptions = useMemo(
    () =>
      HIRE_EMPLOYMENT_TYPES.map((type) => ({
        value: type,
        label: EMPLOYMENT_TYPE_LABELS[type],
      })),
    [],
  );

  const nationalIdDocumentTypeCode = useMemo(() => {
    const fromForm = nationalIdTypes.find(
      (row) => row.documentTypeId === form.nationalIdDocumentTypeId,
    )?.documentTypeCode;
    return fromForm ?? employee?.personal.nationalIdDocumentType ?? "";
  }, [
    employee?.personal.nationalIdDocumentType,
    form.nationalIdDocumentTypeId,
    nationalIdTypes,
  ]);

  const nationalIdLast4OnFile = nationalIdLast4ForSelectedType({
    selectedTypeCode: nationalIdDocumentTypeCode,
    storedTypeCode: employee?.personal.nationalIdDocumentType,
    last4: employee?.personal.nationalIdLast4,
  });
  const govIdLast4Hint =
    form.nationalIdNumber.trim() &&
    !isMaskedNationalIdNumber(form.nationalIdNumber)
      ? ""
      : nationalIdLast4OnFile;

  const roleSelectOptions = useMemo(
    () =>
      roleOptions.map((role) => ({
        value: role,
        label: HRMS_ROLE_LABELS[role],
      })),
    [roleOptions],
  );

  const managerSearch = useReportingManagerSearch();
  const reportingManagerSource = useMemo(() => {
    // With a server search the options are exactly its results.
    if (managerSearch) {
      return reportingManagerEmployees ?? [];
    }
    const combined = new Map<string, EmployeeRecord>();
    for (const row of data.employees) {
      combined.set(row.id, row);
    }
    if (reportingManagerEmployees) {
      for (const row of reportingManagerEmployees) {
        combined.set(row.id, row);
      }
    }
    return [...combined.values()];
  }, [data.employees, managerSearch, reportingManagerEmployees]);

  const filteredSupervisors = useMemo(
    () =>
      selectReportingManagerOptions(reportingManagerSource, {
        jobRank: form.jobRank,
        excludeEmployeeId: employee?.id ?? null,
      }),
    [employee?.id, form.jobRank, reportingManagerSource],
  );
  const reportingManagerOptions = useMemo(
    () =>
      buildReportingManagerComboboxOptions(
        filteredSupervisors,
        form.supervisorId || null,
        employee?.supervisorName ?? null,
      ),
    [employee?.supervisorName, filteredSupervisors, form.supervisorId],
  );

  const showCompleteProfile =
    employee && !isCreate ? needsProfileCompletion(employee) : false;

  function requestClose() {
    if (leaveConfirmOpen) {
      return;
    }
    if (persistedDraftId) {
      onClose();
      return;
    }
    if (dirty) {
      setLeaveConfirmOpen(true);
      return;
    }
    onClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (leaveConfirmOpen || inactiveConflictId) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const focusable = createDialogFocusable(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (event.shiftKey) {
      if (!active || active === first || !dialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (!active || active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  function patchForm(partial: Partial<FormState>) {
    setDirty(true);
    if (
      partial.nationalIdNumber !== undefined &&
      partial.nationalIdNumber.trim() &&
      !isMaskedNationalIdNumber(partial.nationalIdNumber)
    ) {
      nationalIdStashRef.current = partial.nationalIdNumber.trim();
    }
    setForm((current) => {
      const next = { ...current, ...partial };
      if (
        partial.startDate !== undefined &&
        current.payrollSameAsJoining &&
        partial.payrollStartDate === undefined &&
        isPayrollStartApplicable(next.employmentType)
      ) {
        next.payrollStartDate = partial.startDate;
      }
      if (
        partial.employmentType !== undefined &&
        !isPayrollStartApplicable(next.employmentType)
      ) {
        next.payrollStartDate = "";
      }
      if (
        partial.nationality !== undefined &&
        partial.nationality !== current.nationality
      ) {
        next.nationalIdDocumentTypeId = "";
        next.nationalIdNumber = "";
      }
      if (
        partial.nationalIdDocumentTypeId !== undefined &&
        partial.nationalIdDocumentTypeId !== current.nationalIdDocumentTypeId &&
        current.nationalIdDocumentTypeId.trim() !== ""
      ) {
        next.nationalIdNumber = "";
      }
      if (
        partial.payrollSameAsJoining === true &&
        isPayrollStartApplicable(next.employmentType)
      ) {
        next.payrollStartDate = next.startDate;
      }
      if (
        partial.payrollSameAsJoining === false &&
        isPayrollStartApplicable(next.employmentType) &&
        !next.payrollStartDate.trim()
      ) {
        next.payrollStartDate = next.startDate;
      }
      return next;
    });
  }

  function touchPersonal(field: PersonalFieldKey) {
    setTouchedPersonal((current) => {
      if (current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.add(field);
      return next;
    });
  }

  function touchAllPersonal() {
    setTouchedPersonal(new Set(personalFieldsToTouch()));
  }

  function shownPersonalError(field: PersonalFieldKey): string | null {
    if (!touchedPersonal.has(field)) {
      return null;
    }
    return personalFieldError(field, form);
  }

  function resolveNationalIdNumberForSubmit(value: string): string {
    const trimmed = value.trim();
    if (trimmed && !isMaskedNationalIdNumber(trimmed)) {
      return trimmed;
    }
    const stashed = nationalIdStashRef.current.trim();
    if (stashed && !isMaskedNationalIdNumber(stashed)) {
      return stashed;
    }
    return trimmed;
  }

  function buildCreateInput(asDraft: boolean): CreateEmployeeInput | undefined {
    const result = buildCreateEmployeeInput({
      firstName: form.firstName,
      lastName: form.lastName,
      dateOfBirth: form.dateOfBirth,
      workEmail: form.workEmail,
      personalEmail: form.personalEmail,
      department: form.department,
      departmentId: form.departmentId,
      locationId: form.locationId,
      designationId: form.designationId,
      workMode: form.workMode,
      nationalIdDocumentTypeId: form.nationalIdDocumentTypeId,
      nationalIdNumber: resolveNationalIdNumberForSubmit(form.nationalIdNumber),
      nationalIdTypes,
      skillIds: form.skillIds,
      title: form.title,
      role: form.role,
      supervisorId: form.supervisorId,
      projectIds: [],
      accessFlags: form.accessFlags,
      startDate: form.startDate,
      company: form.company,
      companies,
      actorCompany,
      employmentType: form.employmentType,
      workerType: form.workerType,
      workSchedule: form.workSchedule || null,
      employmentCategory: form.employmentCategory,
      vendorId: form.vendorId,
      jobRank: form.jobRank,
      jobDescription: form.jobDescription,
      gradeBand: form.gradeBand,
      emergencyContactName: form.emergencyContactName,
      emergencyContactPhone: form.emergencyContactPhone,
      emergencyContactRelation: form.emergencyContactRelation,
      emergencyContactEmail: form.emergencyContactEmail,
      asDraft,
      employeeId: persistedDraftIdRef.current ?? persistedDraftId ?? employee?.id,
      middleName: form.middleName,
      gender: form.gender,
      nationality: form.nationality,
      ethnicity: form.ethnicity,
      maritalStatus: form.maritalStatus,
      payrollStartDate: resolvePayrollStartDate({
        joiningDate: form.startDate,
        payrollStartDate: form.payrollStartDate,
        sameAsJoining: form.payrollSameAsJoining,
        employmentType: form.employmentType,
      }),
      timesheetRequired: form.timesheetRequired,
      leavePolicyId: form.leavePolicyId || null,
      phone: form.phone,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      country: form.country,
    });
    if (!result.ok) {
      setError(result.error);
      return undefined;
    }
    return result.input;
  }

  async function finishCreate() {
    if (!onCreate || inviting) {
      return;
    }
    const input = buildCreateInput(false);
    if (!input) {
      return;
    }
    setInviting(true);
    try {
      const ok = await onCreate(input);
      if (ok) {
        setError(null);
        onClose();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to send invite. Try again.",
      );
    } finally {
      setInviting(false);
    }
  }

  async function persistDraft(options: {
    readonly close: boolean;
    readonly announce?: boolean;
  }): Promise<boolean> {
    if (!onSaveDraft) {
      return false;
    }
    if (
      !canSaveEmployeeDraft({
        firstName: form.firstName,
        lastName: form.lastName,
      })
    ) {
      setError("First name and last name are required to save a draft.");
      return false;
    }
    const nameError = validateEmployeePersonNames({
      firstName: form.firstName,
      lastName: form.lastName,
    });
    if (nameError) {
      touchAllPersonal();
      setError(nameError);
      return false;
    }
    if (options.close) {
      const draftFieldError = hireDraftSaveError({
        dateOfBirth: form.dateOfBirth,
        personalEmail: form.personalEmail,
        workEmail: form.workEmail,
      });
      if (draftFieldError) {
        if (personalEmailFieldError(form.personalEmail)) {
          touchPersonal("personalEmail");
        } else if (officialEmailFieldError(form.workEmail)) {
          touchPersonal("workEmail");
        } else {
          touchPersonal("dateOfBirth");
        }
        setError(draftFieldError);
        return false;
      }
    }
    const input = buildCreateInput(true);
    if (!input) {
      return false;
    }
    try {
      setDraftSaving(true);
      const result = await onSaveDraft(input, {
        close: options.close,
        announce: options.announce,
      });
      const ok = result !== false;
      if (!ok) {
        return false;
      }
      const savedId =
        typeof result === "string"
          ? result
          : input.id ?? persistedDraftIdRef.current ?? persistedDraftId ?? undefined;
      if (savedId) {
        persistedDraftIdRef.current = savedId;
        setPersistedDraftId(savedId);
      }
      setError(null);
      if (!options.close) {
        setDirty(false);
      }
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save draft.",
      );
      return false;
    } finally {
      setDraftSaving(false);
    }
  }

  async function finishSaveDraft() {
    // Explicit draft save: keep the create wizard on the current step
    // (corporate HRMS: save in place). Validation matches the former close path.
    const draftFieldError = hireDraftSaveError({
      dateOfBirth: form.dateOfBirth,
      personalEmail: form.personalEmail,
      workEmail: form.workEmail,
    });
    if (draftFieldError) {
      if (personalEmailFieldError(form.personalEmail)) {
        touchPersonal("personalEmail");
      } else if (officialEmailFieldError(form.workEmail)) {
        touchPersonal("workEmail");
      } else {
        touchPersonal("dateOfBirth");
      }
      setError(draftFieldError);
      return;
    }
    await persistDraft({ close: false, announce: true });
  }

  function finishSave() {
    if (!onSave || !employee) {
      return;
    }
    if (!form.employmentType) {
      setError("Employment type is required.");
      return;
    }
    if (!String(form.leavePolicyId || "").trim()) {
      setError("Leave policy is required.");
      return;
    }
    const access = syncAccessRoleFields(form.department, form.role);
    onSave(employee.id, {
      role: access.role,
      department: access.department,
      accessFlags: form.accessFlags,
      supervisorId: form.supervisorId || null,
      projectIds: employee.projectIds,
      company: resolveCreateCompany({
        company: form.company,
        companies,
        actorCompany,
      }),
      employmentType: form.employmentType,
      workerType: form.workerType,
      workSchedule: form.workSchedule || null,
      employmentCategory: form.employmentCategory,
      vendorId: isVendorRequired(form.employmentType)
        ? form.vendorId || null
        : null,
      jobRank: form.jobRank,
      jobDescription: form.jobDescription.trim(),
      startDate: form.startDate,
      timesheetRequired: form.timesheetRequired,
      leavePolicyId: form.leavePolicyId.trim() || null,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) {
      return;
    }
    setError(null);

    if (isCreate && createStep < 4) {
      if (createStep === 1) {
        touchAllPersonal();
      }
      const stepError = createStepRequiredError(createStep, form, nationalIdTypes);
      if (stepError) {
        setError(stepError);
        return;
      }
      if (onSaveDraft) {
        void (async () => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          const ok = await persistDraft({ close: false });
          if (!ok) {
            return;
          }
          setCreateStep((current) => (current + 1) as CreateWizardStep);
        })();
        return;
      }
      setCreateStep((current) => (current + 1) as CreateWizardStep);
      return;
    }

    if (isCreate) {
      const personalError = hirePersonalStepError(form);
      if (personalError) {
        touchAllPersonal();
        setError(personalError);
        return;
      }
      const employmentError = hireEmploymentStepError(form);
      if (employmentError) {
        setError(employmentError);
        return;
      }
      const govIdError = hireGovIdStepError({
        nationality: form.nationality,
        nationalIdDocumentTypeId: form.nationalIdDocumentTypeId,
        nationalIdNumber: form.nationalIdNumber,
        nationalIdTypes,
      });
      if (govIdError) {
        setError(govIdError);
        return;
      }

      const uniqueness = checkWorkEmailUniqueness(
        data,
        form.workEmail,
        persistedDraftIdRef.current ?? persistedDraftId ?? employee?.id,
      );
      if (!uniqueness.unique && uniqueness.conflict?.kind === "ACTIVE") {
        setError("Official email must be unique.");
        return;
      }
      if (!uniqueness.unique && uniqueness.conflict?.kind === "INACTIVE") {
        setInactiveConflictId(uniqueness.conflict.employeeId);
        return;
      }

      finishCreate().catch((error: unknown) => {
        setError(
          error instanceof Error ? error.message : "Unable to create employee.",
        );
      });
      return;
    }

    if (isVendorRequired(form.employmentType) && !form.vendorId) {
      setError("Vendor is required for contractor employment.");
      return;
    }

    finishSave();
  }

  const draftSaveEnabled =
    isCreate &&
    Boolean(onSaveDraft) &&
    canSaveEmployeeDraft({
      firstName: form.firstName,
      lastName: form.lastName,
    });

  const createReviewReady = useMemo(() => {
    if (!isCreate || createStep !== 4) {
      return false;
    }
    if (hirePersonalStepError(form)) {
      return false;
    }
    if (
      validateEmployeePersonNames({
        firstName: form.firstName,
        lastName: form.lastName,
      })
    ) {
      return false;
    }
    if (
      hireEmploymentStepError({
        departmentId: form.departmentId,
        designationId: form.designationId,
        locationId: form.locationId,
        startDate: form.startDate,
        employmentType: form.employmentType,
        vendorId: form.vendorId,
        payrollStartDate: form.payrollStartDate,
        payrollSameAsJoining: form.payrollSameAsJoining,
        leavePolicyId: form.leavePolicyId,
      })
    ) {
      return false;
    }
    if (
      hireGovIdStepError({
        nationality: form.nationality,
        nationalIdDocumentTypeId: form.nationalIdDocumentTypeId,
        nationalIdNumber: form.nationalIdNumber,
        nationalIdDocumentTypeCode,
        nationalIdTypes,
      })
    ) {
      return false;
    }
    return true;
  }, [
    createStep,
    form,
    isCreate,
    nationalIdDocumentTypeCode,
    nationalIdTypes,
  ]);

  const title =
    mode === "create"
      ? "Employee Creation"
      : mode === "view"
        ? "View employee access"
        : "Edit employee access";

  const header = (
    <header className={isCreate ? ui.createDialogHeader : ui.wizardHeader}>
      <div className={isCreate ? ui.createDialogHeaderMain : undefined}>
        {isCreate ? <p className={ui.createBrand}>EAOVA</p> : null}
        <p className={isCreate ? ui.createEyebrow : ui.eyebrow}>
          {isCreate ? "Employees · add" : `Access · ${mode}`}
        </p>
        <h2 id={titleId} className={isCreate ? ui.createTitle : undefined}>
          {isCreate
            ? title
            : employee
              ? formatEmployeeName(employee)
              : title}
        </h2>
        {employee?.businessEmployeeId ? (
          <p className={ui.muted} role="status">
            Employee ID: <strong>{employee.businessEmployeeId}</strong>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className={isCreate ? ui.createCloseBtn : ui.iconBtn}
        aria-label={
          isCreate ? "Close add employee" : "Close employee access panel"
        }
        onClick={isCreate ? requestClose : onClose}
      >
        <CloseIcon />
      </button>
    </header>
  );

  const formBody = (
        <form
          className={
            isCreate
              ? ui.createDialogForm
              : onReview
                ? ui.createReview
                : ui.formPage
          }
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if (!isCreate || event.key !== "Enter") {
              return;
            }
            const target = event.target;
            if (
              target instanceof HTMLTextAreaElement ||
              (target instanceof HTMLButtonElement && target.type === "submit")
            ) {
              return;
            }
            event.preventDefault();
          }}
          noValidate
        >
          {isCreate ? (
            <div className={ui.createStepperWrap}>
              <div
                className={ui.createStepperProgress}
                role="progressbar"
                aria-label="Hire form progress"
                aria-valuemin={1}
                aria-valuemax={CREATE_WIZARD_STEPS.length}
                aria-valuenow={createStep}
              >
                <div
                  className={ui.createStepperProgressFill}
                  style={{
                    transform: `scaleX(${(createStep - 1) / (CREATE_WIZARD_STEPS.length - 1)})`,
                  }}
                />
              </div>
              <div
                className={ui.createStepper}
                role="tablist"
                aria-label="Add employee steps"
              >
                {CREATE_WIZARD_STEPS.map((step) => {
                  const active = createStep === step.id;
                  const done = createStep > step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      className={
                        active
                          ? ui.createStepperIndexActive
                          : done
                            ? ui.createStepperIndexDone
                            : ui.createStepperIndex
                      }
                      aria-selected={active}
                      aria-current={active ? "step" : undefined}
                      data-complete={done || undefined}
                      disabled={step.id > createStep}
                      onClick={() => {
                        if (step.id <= createStep) {
                          setError(null);
                          setCreateStep(step.id);
                        }
                      }}
                    >
                      <span
                        className={
                          active
                            ? ui.createStepperMarkActive
                            : done
                              ? ui.createStepperMarkDone
                              : ui.createStepperMark
                        }
                        aria-hidden="true"
                      >
                        {done ? <Check size={11} strokeWidth={3} /> : step.id}
                      </span>
                      <span
                        className={
                          active || done
                            ? ui.createStepperLabelActive
                            : ui.createStepperLabel
                        }
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={isCreate ? ui.createDialogFields : "contents"}>
          {error ? (
            <div
              ref={errorRef}
              className={cx(ui.error, ui.colSpanFull)}
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div
            className={
              isCreate
                ? onReview
                  ? ui.createReview
                  : ui.createFormPage
                : "contents"
            }
          >

          {showPersonalStep ? (
            <ReviewSection
              active={onReview}
              editing={reviewEdits.has("personal")}
              title="Personal Info"
              onToggle={() => toggleReviewEdit("personal")}
            >
              <label className={ui.field}>
                <CreateLabel required>First name</CreateLabel>
                <input
                  required
                  value={form.firstName}
                  disabled={fieldLocked("personal")}
                  placeholder="ex. Jane"
                  aria-invalid={
                    Boolean(shownPersonalError("firstName")) || undefined
                  }
                  aria-describedby={
                    shownPersonalError("firstName")
                      ? `${fieldErrorId}-firstName`
                      : undefined
                  }
                  onChange={(event) =>
                    patchForm({ firstName: event.target.value })
                  }
                  onBlur={() => touchPersonal("firstName")}
                  autoComplete="given-name"
                  autoFocus={isCreate && createStep === 1}
                  data-dialog-initial-focus={
                    isCreate && createStep === 1 ? true : undefined
                  }
                />
                <FieldError
                  id={`${fieldErrorId}-firstName`}
                  message={shownPersonalError("firstName")}
                />
              </label>
              <label className={ui.field}>
                <CreateLabel optional>Middle name</CreateLabel>
                <input
                  value={form.middleName}
                  disabled={fieldLocked("personal")}
                  placeholder="ex. Marie"
                  onChange={(event) =>
                    patchForm({ middleName: event.target.value })
                  }
                  autoComplete="additional-name"
                  aria-label="Middle name"
                />
              </label>
              <label className={ui.field}>
                <CreateLabel required>Last name</CreateLabel>
                <input
                  required
                  value={form.lastName}
                  disabled={fieldLocked("personal")}
                  placeholder="ex. Doe"
                  aria-invalid={
                    Boolean(shownPersonalError("lastName")) || undefined
                  }
                  aria-describedby={
                    shownPersonalError("lastName")
                      ? `${fieldErrorId}-lastName`
                      : undefined
                  }
                  onChange={(event) =>
                    patchForm({ lastName: event.target.value })
                  }
                  onBlur={() => touchPersonal("lastName")}
                  autoComplete="family-name"
                />
                <FieldError
                  id={`${fieldErrorId}-lastName`}
                  message={shownPersonalError("lastName")}
                />
              </label>
              <label className={ui.field}>
                <CreateLabel required>Date of birth</CreateLabel>
                <HireDateInput
                  required
                  value={form.dateOfBirth}
                  disabled={fieldLocked("personal")}
                  invalid={Boolean(shownPersonalError("dateOfBirth"))}
                  describedBy={
                    shownPersonalError("dateOfBirth")
                      ? `${fieldErrorId}-dateOfBirth`
                      : undefined
                  }
                  minDate={minEmployeeDateOfBirth()}
                  maxDate={localIsoToday()}
                  onChange={(next) => {
                    patchForm({ dateOfBirth: next });
                    if (next) {
                      touchPersonal("dateOfBirth");
                    }
                  }}
                  aria-label="Date of birth"
                />
                <FieldError
                  id={`${fieldErrorId}-dateOfBirth`}
                  message={shownPersonalError("dateOfBirth")}
                />
              </label>
              <div className={ui.field}>
                <CreateLabel>Employee code</CreateLabel>
                <input
                  value={codePreview || "—"}
                  readOnly
                  tabIndex={-1}
                  className={ui.fieldInputSystem}
                  aria-label="Employee code"
                  aria-readonly="true"
                />
              </div>
              <label className={ui.field}>
                <CreateLabel optional>Personal email</CreateLabel>
                <input
                  type="email"
                  value={form.personalEmail}
                  disabled={fieldLocked("personal")}
                  placeholder="ex. jane.personal@email.com"
                  aria-invalid={
                    Boolean(shownPersonalError("personalEmail")) || undefined
                  }
                  aria-describedby={
                    shownPersonalError("personalEmail")
                      ? `${fieldErrorId}-personalEmail`
                      : undefined
                  }
                  onChange={(event) => {
                    patchForm({ personalEmail: event.target.value });
                    if (event.target.value.trim()) {
                      touchPersonal("personalEmail");
                    }
                  }}
                  onBlur={() => touchPersonal("personalEmail")}
                  autoComplete="email"
                  aria-label="Personal email"
                />
                <FieldError
                  id={`${fieldErrorId}-personalEmail`}
                  message={shownPersonalError("personalEmail")}
                />
              </label>
              {/* TODO: future email-generator provider will auto-fill THIS field; do not add a new field. */}
              <label className={ui.field}>
                <CreateLabel required>Official email</CreateLabel>
                <input
                  type="email"
                  value={form.workEmail}
                  disabled={fieldLocked("personal")}
                  placeholder="ex. jane.doe@company.com"
                  aria-invalid={
                    Boolean(shownPersonalError("workEmail")) || undefined
                  }
                  aria-describedby={
                    shownPersonalError("workEmail")
                      ? `${fieldErrorId}-workEmail`
                      : undefined
                  }
                  onChange={(event) =>
                    patchForm({ workEmail: event.target.value })
                  }
                  onBlur={() => touchPersonal("workEmail")}
                  autoComplete="email"
                  aria-label="Official email"
                />
                <FieldError
                  id={`${fieldErrorId}-workEmail`}
                  message={shownPersonalError("workEmail")}
                />
              </label>
            </ReviewSection>
          ) : null}

          {!isCreate ? (
            <IdentityBlock
              name={employee ? formatEmployeeName(employee) : title}
              businessEmployeeId={employee?.businessEmployeeId}
              employeeCode={employee?.employeeCode}
              designation={form.title}
              department={form.department}
              company={form.company}
              photoSrc={photoSrc}
              status={
                employee ? (
                  <StatusBadge label={EMPLOYEE_STATUS_LABELS[employee.status]} />
                ) : undefined
              }
            />
          ) : null}

          {canEditPhoto ? (
            <PhotoControls
              canEdit
              hasPhoto={Boolean(photoSrc || employee?.avatarObjectKey)}
              currentPhotoSrc={photoSrc}
              onUpload={onUploadPhoto!}
              onRemove={onRemovePhoto!}
              onError={onPhotoError}
            />
          ) : null}

          {!isCreate ? (
            <label className={ui.field}>
            <span className={ui.fieldLabel}>Personal email</span>
            <input
              type="email"
              value={form.personalEmail}
              disabled={readOnly}
              onChange={(event) =>
                patchForm({ personalEmail: event.target.value })
              }
              autoComplete="email"
            />
          </label>
          ) : null}

          {showEmploymentStep ? (
            <ReviewSection
              active={onReview}
              editing={reviewEdits.has("employment")}
              title="Employment Info"
              onToggle={() => toggleReviewEdit("employment")}
            >
          {!isCreate ? (
          <label className={ui.field}>
            <CreateLabel required={isCreate}>Official email</CreateLabel>
            <input
              required={isCreate}
              type="email"
              value={form.workEmail}
              disabled
              readOnly
              tabIndex={-1}
              className={ui.fieldInputSystem}
              placeholder="ex. jane.doe@company.com"
              aria-readonly="true"
              aria-label="Official email"
            />
          </label>
          ) : null}
          {isCreate ? (
            <EmployeeNationalIdFields
              workMode={form.workMode}
              nationality={form.nationality}
              documentTypeId={form.nationalIdDocumentTypeId}
              last4=""
              types={nationalIdTypes}
              catalogError={employeeCatalogError}
              readOnly={fieldLocked("employment")}
              showDocumentFields={false}
              onWorkModeChange={(workMode) => patchForm({ workMode })}
              onDocumentTypeIdChange={(nationalIdDocumentTypeId) =>
                patchForm({ nationalIdDocumentTypeId })
              }
            />
          ) : null}
          <DepartmentCascadeFields
            departments={orgDepartments}
            departmentId={form.departmentId || null}
            readOnly={fieldLocked("employment")}
            required={isCreate}
            hint={
              orgCatalogError ? (
                <span className={ui.muted}>{orgCatalogError}</span>
              ) : orgDepartments.length === 0 ? (
                <span className={ui.muted}>
                  {emptyOrgCatalogHint("department")}
                </span>
              ) : null
            }
            onChange={({ departmentId }) =>
              patchForm({ departmentId: departmentId ?? "" })
            }
          />

          <label className={ui.field}>
            <CreateLabel required={isCreate}>Location</CreateLabel>
            {orgLocations.length === 0 ? (
              <input
                value=""
                required={isCreate}
                disabled
                aria-label="Location"
                placeholder="Select location"
                readOnly
              />
            ) : (
              <EmployeesSearchCombobox
                required={isCreate}
                value={form.locationId}
                disabled={fieldLocked("employment")}
                placeholder="Search location"
                emptyLabel="Select location"
                noMatchesMessage="No matching locations"
                aria-label="Location"
                options={orgLocations.map((location) => ({
                  value: location.locationId,
                  label: location.locationName,
                }))}
                onChange={(locationId) => patchForm({ locationId })}
              />
            )}
            {orgCatalogError ? null : orgLocations.length === 0 ? (
              <span className={ui.muted}>
                {emptyOrgCatalogHint("location")}
              </span>
            ) : null}
          </label>

          <label className={ui.field}>
            <CreateLabel required={isCreate}>Designation</CreateLabel>
            {orgDesignations.length === 0 ? (
              <input
                value=""
                required={isCreate}
                disabled
                aria-label="Designation"
                placeholder="Select designation"
                readOnly
              />
            ) : (
              <EmployeesSearchCombobox
                required={isCreate}
                value={form.designationId}
                disabled={fieldLocked("employment")}
                placeholder="Search designation"
                emptyLabel="Select designation"
                noMatchesMessage="No matching designations"
                aria-label="Designation"
                options={orgDesignations.map((designation) => ({
                  value: designation.designationId,
                  label: designation.title,
                }))}
                onChange={(designationId) => {
                  const match = orgDesignations.find(
                    (d) => d.designationId === designationId,
                  );
                  patchForm({
                    designationId,
                    title: match?.title ?? form.title,
                  });
                }}
              />
            )}
            {orgCatalogError ? null : orgDesignations.length === 0 ? (
              <span className={ui.muted}>
                {emptyOrgCatalogHint("designation")}
              </span>
            ) : null}
          </label>

          {isCreate ? null : (
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Title</span>
              <input
                value={form.title}
                disabled={fieldLocked("employment")}
                onChange={(event) => patchForm({ title: event.target.value })}
              />
            </label>
          )}

          {!isCreate ? (
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Company</span>
            <EmployeesSelect
              value={form.company}
              disabled={fieldLocked("employment")}
              placeholder="Select company"
              aria-label="Company"
              options={companyOptions}
              onChange={(company) => patchForm({ company })}
            />
          </label>
          ) : null}

          <label className={ui.field}>
            <CreateLabel required={isCreate}>Employment type</CreateLabel>
            <EmployeesSearchCombobox
              required={isCreate}
              value={form.employmentType}
              disabled={fieldLocked("employment")}
              placeholder="Search employment type"
              emptyLabel="Select employment type"
              noMatchesMessage="No matching employment types"
              aria-label="Employment type"
              options={employmentTypeOptions}
              onChange={(next) => {
                if (!next) {
                  patchForm({ employmentType: "", vendorId: "" });
                  return;
                }
                const patched = patchEmploymentType(next as EmploymentType);
                patchForm({
                  employmentType: patched.employmentType,
                  workerType: patched.workerType,
                  workSchedule: patched.workSchedule ?? "",
                  employmentCategory: patched.employmentCategory,
                  vendorId: isVendorRequired(patched.employmentType)
                    ? form.vendorId
                    : "",
                });
              }}
            />
          </label>

          {isVendorRequired(form.employmentType) ? (
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Vendor *</span>
              <EmployeesSearchCombobox
                required
                value={form.vendorId}
                disabled={fieldLocked("employment")}
                placeholder="Search vendor"
                emptyLabel="Select vendor"
                noMatchesMessage="No matching vendors"
                aria-label="Vendor *"
                options={data.vendors.map((vendor) => ({
                  value: vendor.id,
                  label: vendor.name,
                }))}
                onChange={(vendorId) => patchForm({ vendorId })}
              />
            </label>
          ) : null}

          {!isCreate ? (
          <label className={cx(ui.field, !onReview && ui.colSpanFull)}>
            <span className={ui.fieldLabel}>Job description</span>
            {onReview ? (
              <input
                value={form.jobDescription}
                disabled={fieldLocked("employment")}
                aria-label="Job description"
                onChange={(event) =>
                  patchForm({ jobDescription: event.target.value })
                }
              />
            ) : (
              <textarea
                rows={2}
                value={form.jobDescription}
                disabled={fieldLocked("employment")}
                onChange={(event) =>
                  patchForm({ jobDescription: event.target.value })
                }
              />
            )}
          </label>
          ) : null}

          {!isCreate ? (
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Role</span>
            <EmployeesSelect
              value={form.role}
              disabled={fieldLocked("employment")}
              aria-label="Role"
              options={roleSelectOptions}
              onChange={(next) => {
                const role = next as HrmsRole;
                const access = syncAccessRoleFields(role, role);
                patchForm({
                  role: access.role,
                  department: access.department,
                  accessFlags:
                    access.role === "EMPLOYEE"
                      ? VIEW_ONLY_ACCESS_FLAGS
                      : FULL_ACCESS_FLAGS,
                });
              }}
            />
          </label>
          ) : null}

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Reporting manager</span>
            <EmployeesSearchCombobox
              value={form.supervisorId}
              disabled={fieldLocked("employment")}
              placeholder="Search active employees"
              emptyLabel="None"
              aria-label="Reporting manager"
              selectedLabel={employee?.supervisorName ?? undefined}
              options={reportingManagerOptions}
              serverFiltered={Boolean(managerSearch)}
              loading={managerSearch?.loading}
              onOpenChange={(open) => {
                if (!open) {
                  managerSearch?.search(null);
                }
              }}
              onQueryChange={managerSearch?.search}
              onChange={(supervisorId) => patchForm({ supervisorId })}
            />
          </label>

          <div className={ui.datePair}>
            <label className={ui.field}>
              <CreateLabel required={isCreate}>Date of joining</CreateLabel>
              <HireDateInput
                value={form.startDate}
                disabled={fieldLocked("employment")}
                onChange={(startDate) => patchForm({ startDate })}
                aria-label="Date of joining"
              />
            </label>
            <div className={ui.datePairSide}>
              {payrollApplicable ? (
                <>
                  {!form.payrollSameAsJoining ? (
                    <>
                      <CreateLabel required={isCreate}>
                        Payroll start date
                      </CreateLabel>
                      <HireDateInput
                        value={form.payrollStartDate}
                        disabled={fieldLocked("employment")}
                        minDate={form.startDate || undefined}
                        onChange={(payrollStartDate) =>
                          patchForm({ payrollStartDate })
                        }
                        aria-label="Payroll start date"
                      />
                      <span className={ui.fieldHint}>
                        Must be on or after date of joining.
                      </span>
                    </>
                  ) : (
                    <span
                      className={ui.datePairSideSpacer}
                      aria-hidden="true"
                    />
                  )}
                  <AppCheckbox
                    checked={!form.payrollSameAsJoining}
                    disabled={fieldLocked("employment")}
                    label="Payroll start date different from joining date"
                    onChange={(different) =>
                      patchForm({
                        payrollSameAsJoining: !different,
                      })
                    }
                  />
                </>
              ) : (
                <>
                  <CreateLabel optional>Payroll start date</CreateLabel>
                  <p className={ui.muted} role="status">
                    Not Applicable
                  </p>
                </>
              )}
            </div>
          </div>
          <div className={ui.datePair}>
            <label className={ui.field}>
              <CreateLabel required>Leave policy</CreateLabel>
              <EmployeesSelect
                required
                value={form.leavePolicyId}
                disabled={fieldLocked("employment")}
                placeholder={
                  leavePolicyOptions.length === 0
                    ? "No active leave policies"
                    : "Select leave policy"
                }
                aria-label="Leave policy"
                catalogLock
                options={leavePolicyOptions.map((policy) => ({
                  value: policy.policyId,
                  label:
                    policy.status === "Active"
                      ? policy.policyName
                      : `${policy.policyName} (Inactive)`,
                }))}
                onChange={(leavePolicyId) => patchForm({ leavePolicyId })}
              />
            </label>
            <div className={ui.datePairSide}>
              <span className={ui.datePairSideSpacer} aria-hidden="true" />
              <AppCheckbox
                checked={form.timesheetRequired}
                disabled={fieldLocked("employment")}
                label="Timesheet required"
                onChange={(timesheetRequired) =>
                  patchForm({ timesheetRequired })
                }
              />
            </div>
          </div>
            </ReviewSection>
          ) : null}

          {showGovIdStep ? (
            <ReviewSection
              active={onReview}
              editing={reviewEdits.has("govId")}
              title="Gov ID"
              fullWidth
              onToggle={() => toggleReviewEdit("govId")}
            >
              {!onReview ? (
                <p className={cx(ui.muted, ui.colSpanFull)}>
                  Document type and number are optional. Skip those if the employee
                  will complete them during onboarding. Choose a document type before
                  entering a number.
                </p>
              ) : null}
              <label className={ui.field}>
                <CreateLabel required>Nationality</CreateLabel>
                <EmployeesSearchCombobox
                  required
                  value={form.nationality}
                  disabled={fieldLocked("govId")}
                  placeholder="Search nationality"
                  emptyLabel="Select nationality"
                  noMatchesMessage="No matching countries"
                  aria-label="Nationality"
                  options={[...COUNTRY_CODE_OPTIONS]}
                  onChange={(nationality) => patchForm({ nationality })}
                />
              </label>
              <EmployeeNationalIdFields
                nationality={form.nationality}
                documentTypeId={form.nationalIdDocumentTypeId}
                documentTypeCode={nationalIdDocumentTypeCode}
                nationalIdNumber={form.nationalIdNumber}
                last4={govIdLast4Hint}
                types={nationalIdTypes}
                catalogError={employeeCatalogError}
                readOnly={fieldLocked("govId")}
                showWorkMode={false}
                showFieldHints={!onReview || reviewEdits.has("govId")}
                onDocumentTypeIdChange={(nationalIdDocumentTypeId) =>
                  patchForm({ nationalIdDocumentTypeId })
                }
                onNationalIdNumberChange={(nationalIdNumber) =>
                  patchForm({ nationalIdNumber })
                }
              />
            </ReviewSection>
          ) : null}

          {showEmergencyStep ? (
            <ReviewSection
              active={onReview}
              editing={reviewEdits.has("emergency")}
              title="Emergency"
              onToggle={() => toggleReviewEdit("emergency")}
            >
              <p className={cx(ui.muted, ui.colSpanFull)}>
                Optional for HR create. Employee can finish this during
                onboarding.
              </p>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Emergency contact</span>
                <input
                  value={form.emergencyContactName}
                  disabled={fieldLocked("emergency")}
                  onChange={(event) =>
                    patchForm({ emergencyContactName: event.target.value })
                  }
                  aria-label="Emergency contact"
                />
              </label>
              <EmployeesPhoneInput
                label="Emergency phone"
                value={form.emergencyContactPhone}
                disabled={fieldLocked("emergency")}
                ariaLabel="Emergency phone"
                onChange={(emergencyContactPhone) =>
                  patchForm({ emergencyContactPhone })
                }
              />
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Emergency relation</span>
                <EmployeesSelect
                  value={form.emergencyContactRelation}
                  disabled={fieldLocked("emergency")}
                  placeholder="Select relationship"
                  aria-label="Emergency relation"
                  options={
                    form.emergencyContactRelation.trim() &&
                    !EMERGENCY_RELATION_OPTIONS.some(
                      (option) =>
                        option.value === form.emergencyContactRelation.trim(),
                    )
                      ? [
                          {
                            value: form.emergencyContactRelation.trim(),
                            label: form.emergencyContactRelation.trim(),
                          },
                          ...EMERGENCY_RELATION_OPTIONS,
                        ]
                      : EMERGENCY_RELATION_OPTIONS
                  }
                  onChange={(emergencyContactRelation) =>
                    patchForm({ emergencyContactRelation })
                  }
                />
              </label>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Emergency email</span>
                <input
                  type="email"
                  value={form.emergencyContactEmail}
                  disabled={fieldLocked("emergency")}
                  onChange={(event) =>
                    patchForm({ emergencyContactEmail: event.target.value })
                  }
                  aria-label="Emergency email"
                />
              </label>
            </ReviewSection>
          ) : null}

          {!isCreate && employee ? (
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Status</span>
              <input
                value={EMPLOYEE_STATUS_LABELS[employee.status]}
                disabled
                readOnly
                tabIndex={-1}
                className={ui.fieldInputSystem}
                aria-readonly="true"
              />
            </label>
          ) : null}

          {showCompleteProfile && onOpenFullProfile ? (
            <button
              type="button"
              className={cx(ui.btnGhost, ui.colSpanFull)}
              onClick={() => onOpenFullProfile(readOnly ? "view" : "edit")}
            >
              {readOnly
                ? "View onboarding profile"
                : "Complete onboarding profile"}
            </button>
          ) : null}

          </div>
          </div>

          <div
            className={cx(
              ui.formActions,
              isCreate ? ui.createDialogActions : ui.colSpanFull,
            )}
          >
            {isCreate && createStep > 1 ? (
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => {
                  setError(null);
                  setCreateStep((current) => (current - 1) as CreateWizardStep);
                }}
              >
                Back
              </button>
            ) : null}
            <div className={ui.createDialogActionsPrimary}>
              <button
                type="button"
                className={isCreate ? ui.btnQuiet : ui.btnGhost}
                onClick={isCreate ? requestClose : onClose}
              >
                {readOnly ? "Close" : "Cancel"}
              </button>
              {isCreate && onSaveDraft ? (
                <button
                  type="button"
                  className={ui.btnGhost}
                  disabled={!draftSaveEnabled}
                  onClick={() => {
                    void finishSaveDraft();
                  }}
                >
                  Save draft
                </button>
              ) : null}
              {!readOnly ? (
                <button
                  type="submit"
                  className={isCreate ? ui.createContinueBtn : ui.btnPrimary}
                  disabled={draftSaving || inviting}
                >
                  {isCreate
                    ? createStep < 4
                      ? draftSaving
                        ? "Saving…"
                        : "Save & Continue"
                      : inviting
                        ? createReviewReady
                          ? "Saving…"
                          : "Sending invite…"
                        : createReviewReady
                          ? "Save"
                          : "Invite"
                    : "Grant access"}
                </button>
              ) : null}
            </div>
          </div>
        </form>
  );

  const nestedDialogs = (
    <>
      <ConfirmDialogShell
        open={isCreate && leaveConfirmOpen}
        title="Discard this employee?"
        description="Your entries will be lost if you discard. Keep editing to stay on this form."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          onClose();
        }}
      />
      {inactiveConflictId ? (
        <div className={ui.overlayNested} role="presentation">
          <div
            className={ui.chooser}
            role="alertdialog"
            aria-modal="true"
            aria-label="Rehire inactive employee"
          >
            <h2>Inactive email found</h2>
            <p>
              An inactive employee already uses this work email. Rehire that
              record instead of creating a duplicate.
            </p>
            <div className={ui.formActions}>
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => setInactiveConflictId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                onClick={() => {
                  onReactivate?.(inactiveConflictId);
                  setInactiveConflictId(null);
                  onClose();
                }}
              >
                Rehire
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  const panel = (
    <>
      {header}
      {formBody}
    </>
  );

  if (!isCreate) {
    return (
      <section className={ui.createPage} aria-labelledby={titleId}>
        {panel}
        {nestedDialogs}
      </section>
    );
  }

  const modal = (
    <>
      <div
        className={cx(ui.createOverlay, CREATE_OVERLAY_CHROME)}
        data-create-employee-overlay=""
        data-theme={
          typeof document !== "undefined"
            ? document.documentElement.dataset.theme
            : undefined
        }
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            requestClose();
          }
        }}
      >
        <div
          ref={dialogRef}
          className={ui.createDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
        >
          {panel}
        </div>
      </div>
      {nestedDialogs}
    </>
  );

  if (typeof document === "undefined") {
    return modal;
  }
  return createPortal(modal, document.body);
}
