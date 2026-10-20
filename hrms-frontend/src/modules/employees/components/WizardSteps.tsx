import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Award, CloudUpload, Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ConfirmDialogShell,
  DialogShell,
  HRMS_ROLE_LABELS,
  isHrmsRole,
  type HrmsRole,
} from "@/shared";
import {
  AppCheckbox,
  AppDateField,
  AppSectionCard,
  AppSectionEditButton,
  type AppSectionEditProps,
  type AppSelectOption,
  AppSelect,
  AppDataTable,
  type AppDataTableColumn,
} from "@/shared/ui";
import { DepartmentCascadeFields } from "./DepartmentCascadeFields";
import { EmployeesSearchCombobox } from "./EmployeesSearchCombobox";
import { useReportingManagerSearch } from "./reportingManagerSearch";
import { EmployeesPhoneInput } from "./EmployeesPhoneInput";
import {
  COUNTRY_CODE_OPTIONS,
  countryCodeLabel,
  EMERGENCY_RELATION_OPTIONS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  ETHNICITIES,
  ETHNICITY_LABELS,
  FULL_ACCESS_FLAGS,
  GENDER_LABELS,
  GENDERS,
  isVendorRequired,
  MARITAL_STATUS_LABELS,
  MARITAL_STATUSES,
  resolveAddressCountryCode,
  SKILL_PROFICIENCIES,
  SKILL_PROFICIENCY_LABELS,
  SKILL_EXPERIENCE_RANGES,
  VIEW_ONLY_ACCESS_FLAGS,
  WORK_MODE_LABELS,
  WORK_MODES,
} from "../constants";
import {
  govIdFormFromEmployee,
  isCompleteSkillEntry,
  isFutureCertificateExpiry,
  nationalIdLast4ForSelectedType,
  tomorrowIsoDate,
  withSkillEntries,
  emergencyEmailFieldError,
} from "../employeeCatalog";
import { emptyOrgCatalogHint } from "../orgCatalogHints";
import {
  buildReportingManagerComboboxOptions,
  getAllowedTargetRoles,
  mergeReportingManagerEmployeeSource,
  selectReportingManagerOptions,
  syncAccessRoleFields,
} from "../selectors";
import { resolveProfileFieldEditState } from "../fieldPermissions";
import type {
  EmployeeActor,
  EmployeeRecord,
  EmployeeSkillEntry,
  EmployeesModuleData,
  EmploymentType,
  NationalIdDocumentTypeOption,
  OrgDepartmentOption,
  OrgDesignationOption,
  OrgLocationOption,
  LeavePolicyOption,
  SkillCatalogOption,
  SkillProficiency,
} from "../types";
import { AddressAutocomplete } from "@/modules/locations/components/AddressAutocomplete";
import type { GeocodedAddress } from "@/modules/org/geocoding";
import { hasStateList, normalizeLocationState, statesForCountry } from "@/modules/org";
import { MoreIcon } from "./icons";
import { EmployeeNationalIdFields } from "./employeeCatalogFields";
import {
  FieldLabel,
  ProfileSelectField,
  ProfileTextField,
  ViewField,
  selectDisplayLabel,
} from "./profileFields";
import { cx, ui } from "../uiClasses";

interface WizardStepProps {
  readonly draft: EmployeeRecord;
  readonly readOnly: boolean;
  readonly onChange: (patch: Partial<EmployeeRecord>) => void;
  readonly dataSupervisors: EmployeesModuleData["supervisors"];
  readonly dataProjects: EmployeesModuleData["projects"];
  readonly dataEmployees?: EmployeesModuleData["employees"];
  readonly dataVendors?: EmployeesModuleData["vendors"];
  readonly actor?: EmployeeActor;
  /** When true, self-service personal/contact fields may be edited after the pencil. */
  readonly selfRestricted?: boolean;
  readonly orgDepartments?: readonly OrgDepartmentOption[];
  readonly orgLocations?: readonly OrgLocationOption[];
  readonly orgDesignations?: readonly OrgDesignationOption[];
  readonly leavePolicyOptions?: readonly LeavePolicyOption[];
  readonly orgCatalogError?: string | null;
  readonly skillCatalog?: readonly SkillCatalogOption[];
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
  readonly employeeCatalogError?: string | null;
  readonly reportingManagerEmployees?: readonly EmployeeRecord[] | null;
  /** Red required marks on employee self-service fields. */
  readonly requireSelfFields?: boolean;
}

function withCurrentCountryOption(
  value: string,
): readonly { readonly value: string; readonly label: string }[] {
  if (!value || COUNTRY_CODE_OPTIONS.some((option) => option.value === value)) {
    return COUNTRY_CODE_OPTIONS;
  }
  return [
    { value, label: `${countryCodeLabel(value)} (${value})` },
    ...COUNTRY_CODE_OPTIONS,
  ];
}

function stateSelectOptions(
  countryCode: string,
  currentState: string,
): readonly { readonly value: string; readonly label: string }[] {
  const options = statesForCountry(countryCode).map((row) => ({
    value: row.code,
    label: row.name,
  }));
  const trimmed = currentState.trim();
  if (!trimmed) {
    return options;
  }
  const mapped = normalizeLocationState(countryCode, trimmed) ?? trimmed;
  if (options.some((option) => option.value === mapped)) {
    return options;
  }
  return [{ value: trimmed, label: trimmed }, ...options];
}

function stateSelectValue(countryCode: string, currentState: string): string {
  const trimmed = currentState.trim();
  if (!trimmed) {
    return "";
  }
  return normalizeLocationState(countryCode, trimmed) ?? trimmed;
}

function stateViewLabel(countryCode: string, currentState: string): string {
  const trimmed = currentState.trim();
  if (!trimmed) {
    return "";
  }
  const mapped = normalizeLocationState(countryCode, trimmed) ?? trimmed;
  return (
    statesForCountry(countryCode).find((row) => row.code === mapped)?.name ??
    trimmed
  );
}

function withCurrentSelectOption(
  value: string,
  options: readonly { readonly value: string; readonly label: string }[],
): readonly { readonly value: string; readonly label: string }[] {
  const trimmed = value.trim();
  if (!trimmed || options.some((option) => option.value === trimmed)) {
    return options;
  }
  return [{ value: trimmed, label: trimmed }, ...options];
}

function ProfileFormCard({
  title,
  titleId,
  fieldsClassName = ui.profileStepPersonal,
  editing,
  onEdit,
  editLabel,
  stopEditLabel,
  children,
}: {
  readonly title: string;
  readonly titleId: string;
  readonly fieldsClassName?: string;
  readonly children: ReactNode;
} & AppSectionEditProps) {
  return (
    <AppSectionCard
      title={title}
      titleId={titleId}
      bodyClassName={fieldsClassName}
      editing={editing}
      onEdit={onEdit}
      editLabel={editLabel}
      stopEditLabel={stopEditLabel}
    >
      {children}
    </AppSectionCard>
  );
}

function displayNationalIdLast4(value: string | null | undefined): string {
  const chars = (value ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-4);
  if (!chars) {
    return "—";
  }
  return `•••• ${chars}`;
}

export function PersonalStep({
  draft,
  readOnly,
  onChange,
  selfRestricted = false,
  requireSelfFields = false,
  editing,
  onEdit,
  editLabel,
  stopEditLabel,
}: Omit<WizardStepProps, "dataSupervisors" | "dataProjects"> &
  AppSectionEditProps) {
  const cardId = useId();
  const countryCode = resolveAddressCountryCode(draft.contact.country);
  const useStateSelect = hasStateList(countryCode);

  function fieldState(field: string) {
    return resolveProfileFieldEditState(field, {
      sectionReadOnly: readOnly,
      selfRestricted,
    });
  }

  function fieldDisabled(field: string): boolean {
    return !fieldState(field).editable;
  }

  function fieldLocked(field: string): boolean {
    return fieldState(field).ownershipLocked;
  }

  function fieldViewMode(field: string): boolean {
    return fieldState(field).viewMode;
  }

  function applyGeocodedAddress(place: GeocodedAddress) {
    const nextCountry =
      resolveAddressCountryCode(place.countryCode) ||
      resolveAddressCountryCode(draft.contact.country);
    let nextState = "";
    if (place.state) {
      nextState =
        normalizeLocationState(nextCountry, place.state) ??
        (hasStateList(nextCountry) ? "" : place.state);
    }
    onChange({
      contact: {
        ...draft.contact,
        addressLine1: place.street || draft.contact.addressLine1,
        city: place.city,
        state: nextState,
        postalCode: place.postalCode,
        country: nextCountry,
      },
    });
  }

  function handleCountryChange(country: string) {
    onChange({
      contact: { ...draft.contact, country, state: "" },
    });
  }

  return (
    <>
      <ProfileFormCard
        title="Personal Information"
        titleId={`${cardId}-identity`}
        editing={editing}
        onEdit={onEdit}
        editLabel={editLabel}
        stopEditLabel={stopEditLabel}
      >
        <ProfileTextField
          label="First name"
          readOnly={fieldDisabled("firstName")}
          locked={fieldLocked("firstName")}
          value={draft.firstName}
          onChange={(firstName) => onChange({ firstName })}
        />
        <ProfileTextField
          label="Middle name"
          readOnly={fieldDisabled("middleName")}
          locked={fieldLocked("middleName")}
          value={draft.middleName}
          onChange={(middleName) => onChange({ middleName })}
        />
        <ProfileTextField
          label="Last name"
          readOnly={fieldDisabled("lastName")}
          locked={fieldLocked("lastName")}
          value={draft.lastName}
          onChange={(lastName) => onChange({ lastName })}
        />
        <ProfileTextField
          label="Date of birth"
          type="date"
          readOnly={fieldDisabled("dateOfBirth")}
          locked={fieldLocked("dateOfBirth")}
          value={draft.personal.dateOfBirth}
          onChange={(dateOfBirth) =>
            onChange({
              personal: { ...draft.personal, dateOfBirth },
            })
          }
        />
        <ProfileSelectField
          label="Gender"
          required={requireSelfFields}
          readOnly={fieldDisabled("gender")}
          locked={fieldLocked("gender")}
          value={draft.personal.gender}
          placeholder="Select gender"
          options={GENDERS.map((value) => ({
            value,
            label: GENDER_LABELS[value],
          }))}
          onChange={(gender) =>
            onChange({
              personal: { ...draft.personal, gender },
            })
          }
        />
        <ProfileSelectField
          label="Marital status"
          required={requireSelfFields}
          readOnly={fieldDisabled("maritalStatus")}
          locked={fieldLocked("maritalStatus")}
          value={draft.personal.maritalStatus}
          placeholder="Select marital status"
          options={MARITAL_STATUSES.map((value) => ({
            value,
            label: MARITAL_STATUS_LABELS[value],
          }))}
          onChange={(maritalStatus) =>
            onChange({
              personal: { ...draft.personal, maritalStatus },
            })
          }
        />
        {fieldViewMode("nationality") ? (
          <ViewField
            label="Nationality"
            value={selectDisplayLabel(
              draft.personal.nationality,
              withCurrentCountryOption(draft.personal.nationality),
            )}
          />
        ) : fieldLocked("nationality") ? (
          <ProfileTextField
            label="Nationality"
            readOnly
            locked
            value={selectDisplayLabel(
              draft.personal.nationality,
              withCurrentCountryOption(draft.personal.nationality),
            )}
            ariaLabel="Nationality"
          />
        ) : (
          <div className={ui.field}>
            {requireSelfFields ? (
              <FieldLabel required>Nationality</FieldLabel>
            ) : (
              <span className={ui.fieldLabel}>Nationality</span>
            )}
            <EmployeesSearchCombobox
              required={requireSelfFields}
              value={draft.personal.nationality}
              placeholder="Search nationality"
              emptyLabel="Select nationality"
              noMatchesMessage="No matching countries"
              aria-label="Nationality"
              options={[...withCurrentCountryOption(draft.personal.nationality)]}
              onChange={(nationality) =>
                onChange({
                  personal: { ...draft.personal, nationality },
                })
              }
            />
          </div>
        )}
        <ProfileSelectField
          label="Ethnicity"
          required={requireSelfFields}
          readOnly={fieldDisabled("ethnicity")}
          locked={fieldLocked("ethnicity")}
          value={draft.personal.ethnicity}
          placeholder="Select ethnicity"
          options={ETHNICITIES.map((value) => ({
            value,
            label: ETHNICITY_LABELS[value],
          }))}
          onChange={(ethnicity) =>
            onChange({
              personal: { ...draft.personal, ethnicity },
            })
          }
        />
      </ProfileFormCard>
      <ProfileFormCard
        title="Contact Information"
        titleId={`${cardId}-contact`}
        fieldsClassName={ui.profileStepPersonal}
      >
        <ProfileTextField
          label="Personal email"
          required={requireSelfFields}
          type="email"
          readOnly={fieldDisabled("personalEmail")}
          locked={fieldLocked("personalEmail")}
          value={draft.contact.personalEmail}
          onChange={(personalEmail) =>
            onChange({
              contact: { ...draft.contact, personalEmail },
            })
          }
        />
        <EmployeesPhoneInput
          label="Phone number"
          required={requireSelfFields}
          value={draft.contact.phone}
          disabled={fieldDisabled("phone")}
          ownershipLocked={fieldLocked("phone")}
          ariaLabel="Phone number"
          onChange={(phone) =>
            onChange({
              contact: { ...draft.contact, phone },
            })
          }
        />
        <EmployeesPhoneInput
          label="Alternate phone"
          value={draft.contact.alternatePhone}
          disabled={fieldDisabled("alternatePhone")}
          ownershipLocked={fieldLocked("alternatePhone")}
          ariaLabel="Alternate phone"
          onChange={(alternatePhone) =>
            onChange({
              contact: { ...draft.contact, alternatePhone },
            })
          }
        />
      </ProfileFormCard>
      <ProfileFormCard title="Residential Address" titleId={`${cardId}-address`}>
        {fieldViewMode("country") ? (
          <ViewField
            label="Country"
            value={selectDisplayLabel(
              resolveAddressCountryCode(draft.contact.country),
              withCurrentCountryOption(
                resolveAddressCountryCode(draft.contact.country),
              ),
            )}
          />
        ) : fieldLocked("country") ? (
          <ProfileTextField
            label="Country"
            required={requireSelfFields}
            readOnly
            locked
            value={selectDisplayLabel(
              resolveAddressCountryCode(draft.contact.country),
              withCurrentCountryOption(
                resolveAddressCountryCode(draft.contact.country),
              ),
            )}
            ariaLabel="Country"
          />
        ) : (
          <div className={ui.field}>
            {requireSelfFields ? (
              <FieldLabel required>Country</FieldLabel>
            ) : (
              <span className={ui.fieldLabel}>Country</span>
            )}
            <EmployeesSearchCombobox
              required={requireSelfFields}
              value={resolveAddressCountryCode(draft.contact.country)}
              placeholder="Search country"
              emptyLabel="Select country"
              noMatchesMessage="No matching countries"
              aria-label="Country"
              options={[
                ...withCurrentCountryOption(
                  resolveAddressCountryCode(draft.contact.country),
                ),
              ]}
              onChange={handleCountryChange}
            />
          </div>
        )}
        {fieldViewMode("addressLine1") ? (
          <ViewField label="Address line 1" value={draft.contact.addressLine1} />
        ) : fieldLocked("addressLine1") ? (
          <ProfileTextField
            label="Address line 1"
            required={requireSelfFields}
            readOnly
            locked
            value={draft.contact.addressLine1}
            ariaLabel="Address line 1"
          />
        ) : (
          <label className={ui.field}>
            {requireSelfFields ? (
              <FieldLabel required>Address line 1</FieldLabel>
            ) : (
              <span className={ui.fieldLabel}>Address line 1</span>
            )}
            <AddressAutocomplete
              required={requireSelfFields}
              plainInput
              value={draft.contact.addressLine1}
              countryCode={resolveAddressCountryCode(draft.contact.country)}
              aria-label="Address line 1"
              onChange={(addressLine1) =>
                onChange({
                  contact: { ...draft.contact, addressLine1 },
                })
              }
              onPick={applyGeocodedAddress}
            />
          </label>
        )}
        <ProfileTextField
          label="Address line 2"
          readOnly={fieldDisabled("addressLine2")}
          locked={fieldLocked("addressLine2")}
          value={draft.contact.addressLine2}
          onChange={(addressLine2) =>
            onChange({
              contact: { ...draft.contact, addressLine2 },
            })
          }
        />
        {fieldViewMode("state") ? (
          <ViewField
            label="State/Province"
            value={stateViewLabel(countryCode, draft.contact.state)}
          />
        ) : fieldLocked("state") ? (
          <ProfileTextField
            label="State/Province"
            required={requireSelfFields}
            readOnly
            locked
            value={stateViewLabel(countryCode, draft.contact.state)}
            ariaLabel="State/Province"
          />
        ) : useStateSelect ? (
          <div className={ui.field}>
            {requireSelfFields ? (
              <FieldLabel required>State/Province</FieldLabel>
            ) : (
              <span className={ui.fieldLabel}>State/Province</span>
            )}
            <EmployeesSearchCombobox
              required={requireSelfFields}
              value={stateSelectValue(countryCode, draft.contact.state)}
              placeholder="Search state/province"
              emptyLabel="Select state/province"
              noMatchesMessage="No matching states"
              aria-label="State/Province"
              options={[
                ...stateSelectOptions(countryCode, draft.contact.state),
              ]}
              onChange={(state) =>
                onChange({
                  contact: { ...draft.contact, state },
                })
              }
            />
          </div>
        ) : (
          <ProfileTextField
            label="State/Province"
            required={requireSelfFields}
            readOnly={fieldDisabled("state")}
            locked={fieldLocked("state")}
            ariaLabel="State/Province"
            value={draft.contact.state}
            onChange={(state) =>
              onChange({
                contact: { ...draft.contact, state },
              })
            }
          />
        )}
        <ProfileTextField
          label="City"
          required={requireSelfFields}
          readOnly={fieldDisabled("city")}
          locked={fieldLocked("city")}
          value={draft.contact.city}
          onChange={(city) =>
            onChange({
              contact: { ...draft.contact, city },
            })
          }
        />
        <ProfileTextField
          label="Postal code"
          required={requireSelfFields}
          readOnly={fieldDisabled("postalCode")}
          locked={fieldLocked("postalCode")}
          value={draft.contact.postalCode}
          onChange={(postalCode) =>
            onChange({
              contact: { ...draft.contact, postalCode },
            })
          }
        />
      </ProfileFormCard>
    </>  );
}

export function GovernmentWorkAuthView({
  draft,
  readOnly,
  onChange,
  nationalIdTypes = [],
  employeeCatalogError = null,
  editing,
  onEdit,
  editLabel,
  stopEditLabel,
  savedEmployee,
}: {
  readonly draft: EmployeeRecord;
  readonly readOnly: boolean;
  readonly onChange: (patch: Partial<EmployeeRecord>) => void;
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
  readonly employeeCatalogError?: string | null;
  readonly savedEmployee?: EmployeeRecord;
} & AppSectionEditProps) {
  const cardId = useId();
  const typeCode = draft.personal.nationalIdDocumentType.trim();
  const typeId = draft.personal.nationalIdDocumentTypeId.trim();
  const typeMatch = nationalIdTypes.find(
    (row) =>
      (typeId && row.documentTypeId === typeId) ||
      (typeCode && row.documentTypeCode === typeCode),
  );
  const nationalIdDocumentTypeCode =
    typeMatch?.documentTypeCode ?? typeCode;
  const nationality = selectDisplayLabel(
    draft.personal.nationality,
    withCurrentCountryOption(draft.personal.nationality),
  );
  const documentType = typeMatch?.documentTypeLabel || typeCode;
  const storedEmployee = savedEmployee ?? draft;
  const govIdLast4Hint = nationalIdLast4ForSelectedType({
    selectedTypeCode: nationalIdDocumentTypeCode,
    storedTypeCode: storedEmployee.personal.nationalIdDocumentType,
    last4: storedEmployee.personal.nationalIdLast4,
  });
  const govForm = govIdFormFromEmployee(draft, nationalIdTypes, {
    revealFullNumber: !readOnly,
  });
  const nationalIdNumber =
    draft.personal.nationalIdNumber?.trim() || govForm.nationalIdNumber;

  return (
    <ProfileFormCard
      title="Government and Work Auth"
      titleId={`${cardId}-government-work-auth`}
      editing={editing}
      onEdit={onEdit}
      editLabel={editLabel}
      stopEditLabel={stopEditLabel}
    >
      {readOnly ? (
        <>
          <ViewField label="Nationality" value={nationality} />
          <ViewField label="Document Type" value={documentType} />
          <ViewField
            label="Government ID number"
            value={displayNationalIdLast4(draft.personal.nationalIdLast4)}
          />
        </>
      ) : (
        <>
          <div className={ui.field}>
            <FieldLabel required>Nationality</FieldLabel>
            <EmployeesSearchCombobox
              required
              value={draft.personal.nationality}
              placeholder="Search nationality"
              emptyLabel="Select nationality"
              noMatchesMessage="No matching countries"
              aria-label="Nationality"
              options={[...withCurrentCountryOption(draft.personal.nationality)]}
              onChange={(nationalityValue) =>
                onChange({
                  personal: {
                    ...draft.personal,
                    nationality: nationalityValue,
                    nationalIdDocumentTypeId: "",
                    nationalIdDocumentType: "",
                    nationalIdNumber: "",
                    nationalIdLast4: "",
                  },
                })
              }
            />
          </div>
          <EmployeeNationalIdFields
            nationality={draft.personal.nationality}
            documentTypeId={draft.personal.nationalIdDocumentTypeId}
            documentTypeCode={nationalIdDocumentTypeCode}
            nationalIdNumber={nationalIdNumber}
            last4={govIdLast4Hint}
            types={nationalIdTypes}
            catalogError={employeeCatalogError}
            readOnly={false}
            showWorkMode={false}
            showFieldHints
            onDocumentTypeIdChange={(nationalIdDocumentTypeId) =>
              onChange({
                personal: {
                  ...draft.personal,
                  nationalIdDocumentTypeId,
                  nationalIdNumber: "",
                },
              })
            }
            onNationalIdNumberChange={(nationalIdNumberValue) =>
              onChange({
                personal: {
                  ...draft.personal,
                  nationalIdNumber: nationalIdNumberValue,
                },
              })
            }
          />
        </>
      )}
    </ProfileFormCard>
  );
}

export function ContactStep({
  draft,
  readOnly,
  onChange,
  selfRestricted = false,
  requireSelfFields = false,
}: Omit<WizardStepProps, "dataSupervisors" | "dataProjects">) {
  function fieldState(field: string) {
    return resolveProfileFieldEditState(field, {
      sectionReadOnly: readOnly,
      selfRestricted,
    });
  }

  function fieldDisabled(field: string): boolean {
    return !fieldState(field).editable;
  }

  function fieldLocked(field: string): boolean {
    return fieldState(field).ownershipLocked;
  }

  const hasAlternate =
    Boolean(draft.contact.alternateEmergencyName.trim()) ||
    Boolean(draft.contact.alternateEmergencyPhone.trim()) ||
    Boolean(draft.contact.alternateEmergencyRelation.trim()) ||
    Boolean(draft.contact.alternateEmergencyEmail.trim());
  const [alternateOpen, setAlternateOpen] = useState(hasAlternate);
  const showAlternate = alternateOpen || hasAlternate;
  const canEditAlternate = !fieldDisabled("alternateEmergencyName");

  function patchContact(patch: Partial<EmployeeRecord["contact"]>) {
    onChange({ contact: { ...draft.contact, ...patch } });
  }

  function removeAlternate() {
    patchContact({
      alternateEmergencyName: "",
      alternateEmergencyPhone: "",
      alternateEmergencyRelation: "",
      alternateEmergencyEmail: "",
    });
    setAlternateOpen(false);
  }

  const emergencyEmailError = fieldDisabled("emergencyEmail")
    ? null
    : emergencyEmailFieldError(draft.contact.emergencyEmail);
  const alternateEmergencyEmailError = !canEditAlternate
    ? null
    : emergencyEmailFieldError(draft.contact.alternateEmergencyEmail);

  return (
    <div className={ui.wizardSectionStack}>
      <section
        className={ui.profileInnerCard}
        aria-labelledby="primary-emergency-heading"
      >
        <h3
          id="primary-emergency-heading"
          className={ui.profileInnerCardTitle}
        >
          Primary Emergency Contact
        </h3>
        <div className={ui.profileStepPersonal}>
          <ProfileTextField
            label="Contact name"
            required={requireSelfFields}
            nativeRequired={requireSelfFields}
            readOnly={fieldDisabled("emergencyName")}
            locked={fieldLocked("emergencyName")}
            value={draft.contact.emergencyName}
            onChange={(emergencyName) => patchContact({ emergencyName })}
          />
          <ProfileSelectField
            label="Relationship"
            required={requireSelfFields}
            readOnly={fieldDisabled("emergencyRelation")}
            locked={fieldLocked("emergencyRelation")}
            value={draft.contact.emergencyRelation}
            placeholder="Select relationship"
            options={withCurrentSelectOption(
              draft.contact.emergencyRelation,
              EMERGENCY_RELATION_OPTIONS,
            )}
            onChange={(emergencyRelation) =>
              patchContact({ emergencyRelation })
            }
          />
          <EmployeesPhoneInput
            label="Phone number"
            required={requireSelfFields}
            value={draft.contact.emergencyPhone}
            disabled={fieldDisabled("emergencyPhone")}
            ownershipLocked={fieldLocked("emergencyPhone")}
            ariaLabel="Emergency phone"
            onChange={(emergencyPhone) => patchContact({ emergencyPhone })}
          />
          <ProfileTextField
            label="Email"
            type="email"
            readOnly={fieldDisabled("emergencyEmail")}
            value={draft.contact.emergencyEmail}
            ariaLabel="Emergency email"
            error={emergencyEmailError}
            onChange={(emergencyEmail) => patchContact({ emergencyEmail })}
          />
        </div>
      </section>

      {showAlternate ? (
        <section
          className={ui.profileInnerCard}
          aria-labelledby="alternate-emergency-heading"
        >
          <div className={ui.profileInnerCardHeader}>
            <h3
              id="alternate-emergency-heading"
              className={ui.profileInnerCardTitle}
            >
              Alternate Emergency Contact
            </h3>
            {canEditAlternate ? (
              <button
                type="button"
                className={ui.iconBtn}
                aria-label="Remove alternate emergency contact"
                onClick={removeAlternate}
              >
                <Trash2 size={16} className="text-emp-critical" />
              </button>
            ) : null}
          </div>
          <div className={ui.profileStepPersonal}>
            <ProfileTextField
              label="Contact name"
              readOnly={!canEditAlternate}
              locked={fieldLocked("alternateEmergencyName")}
              value={draft.contact.alternateEmergencyName}
              ariaLabel="Alternate contact name"
              onChange={(alternateEmergencyName) =>
                patchContact({ alternateEmergencyName })
              }
            />
            <ProfileSelectField
              label="Relationship"
              readOnly={!canEditAlternate}
              locked={fieldLocked("alternateEmergencyRelation")}
              value={draft.contact.alternateEmergencyRelation}
              placeholder="Select relationship"
              ariaLabel="Alternate relationship"
              options={withCurrentSelectOption(
                draft.contact.alternateEmergencyRelation,
                EMERGENCY_RELATION_OPTIONS,
              )}
              onChange={(alternateEmergencyRelation) =>
                patchContact({ alternateEmergencyRelation })
              }
            />
            <EmployeesPhoneInput
              label="Phone number"
              value={draft.contact.alternateEmergencyPhone}
              disabled={!canEditAlternate}
              ownershipLocked={fieldLocked("alternateEmergencyPhone")}
              ariaLabel="Alternate phone number"
              onChange={(alternateEmergencyPhone) =>
                patchContact({ alternateEmergencyPhone })
              }
            />
            <ProfileTextField
              label="Email"
              type="email"
              readOnly={!canEditAlternate}
              value={draft.contact.alternateEmergencyEmail}
              ariaLabel="Alternate emergency email"
              error={alternateEmergencyEmailError}
              onChange={(alternateEmergencyEmail) =>
                patchContact({ alternateEmergencyEmail })
              }
            />
          </div>
        </section>
      ) : canEditAlternate ? (
        <button
          type="button"
          className={ui.profileAddRow}
          onClick={() => setAlternateOpen(true)}
        >
          <Plus size={16} />
          Add Alternate Emergency Contact
        </button>
      ) : null}
    </div>
  );
}

function SkillsRowMenu({
  labelName,
  canEdit,
  onEdit,
  onRemove,
}: {
  readonly labelName: string;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function placePanel() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const panelWidth = 152;
    const left = Math.min(
      Math.max(8, rect.right - panelWidth),
      window.innerWidth - panelWidth - 8,
    );
    setPanelPos({ top: rect.bottom + 6, left });
  }

  function closeMenu() {
    setOpen(false);
    setPanelPos(null);
  }

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;
      if (next) {
        placePanel();
      } else {
        setPanelPos(null);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    function handleReposition() {
      placePanel();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  const menu =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            ref={panelRef}
            className={ui.rowMenuPanel}
            role="menu"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            {canEdit ? (
              <button
                type="button"
                role="menuitem"
                className={ui.rowMenuItem}
                aria-label={`Edit ${labelName}`}
                onClick={() => {
                  onEdit();
                  closeMenu();
                }}
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={cx(ui.rowMenuItem, ui.rowMenuItemDanger)}
              aria-label={`Remove ${labelName}`}
              onClick={() => {
                onRemove();
                closeMenu();
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Remove
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={ui.rowMenu} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={ui.rowMenuTrigger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Actions for ${labelName}`}
        onClick={toggleOpen}
      >
        <MoreIcon />
      </button>
      {menu}
    </div>
  );
}

const SKILL_CERTIFICATE_ACCEPT =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/webp,image/gif,text/plain,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.txt";

const EMPTY_SKILL_ENTRY: EmployeeSkillEntry = {
  id: "",
  skillId: "",
  skillName: "",
  kind: "catalog",
  status: "Active",
  proficiency: "",
  yearsExperience: "",
  hasCertificate: false,
};

function skillHasCertificate(row: EmployeeSkillEntry): boolean {
  return Boolean(
    row.hasCertificate ||
      row.certificateName ||
      row.certificateObjectKey ||
      row.certificateFileName ||
      row.certificateFile,
  );
}

function formatCertificateExpiry(value: string | undefined): string | null {
  const raw = value?.trim().slice(0, 10);
  if (!raw) {
    return null;
  }
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseSkillProficiencyValue(value: string): SkillProficiency | "" {
  return value === "BEGINNER" ||
    value === "INTERMEDIATE" ||
    value === "EXPERT"
    ? value
    : "";
}

function proficiencyPillClass(value: SkillProficiency): string {
  if (value === "EXPERT") {
    return ui.skillPillExpert;
  }
  if (value === "INTERMEDIATE") {
    return ui.skillPillIntermediate;
  }
  return ui.skillPillBeginner;
}

function SkillEntryDialog({
  open,
  mode,
  initial,
  skillOptions,
  catalog,
  onClose,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: "add" | "edit";
  readonly initial: EmployeeSkillEntry;
  readonly skillOptions: readonly AppSelectOption[];
  readonly catalog: readonly SkillCatalogOption[];
  readonly onClose: () => void;
  readonly onSubmit: (entry: EmployeeSkillEntry) => void;
}) {
  const [skillId, setSkillId] = useState(initial.skillId);
  const [skillName, setSkillName] = useState(initial.skillName);
  const [proficiency, setProficiency] = useState<SkillProficiency | "">(
    initial.proficiency,
  );
  const [yearsExperience, setYearsExperience] = useState(
    initial.yearsExperience,
  );
  const [wantCertificate, setWantCertificate] = useState(
    skillHasCertificate(initial),
  );
  const [certificateFile, setCertificateFile] = useState<File | undefined>(
    initial.certificateFile,
  );
  const [certificateName, setCertificateName] = useState(
    initial.certificateName ?? "",
  );
  const [certificateExpiresOn, setCertificateExpiresOn] = useState(
    initial.certificateExpiresOn ?? "",
  );
  const [keptCertificate, setKeptCertificate] = useState<{
    readonly fileName: string;
    readonly objectKey?: string;
  } | null>(() =>
    initial.certificateFileName || initial.certificateObjectKey
      ? {
          fileName: initial.certificateFileName || "Certificate",
          objectKey: initial.certificateObjectKey,
        }
      : null,
  );
  const [dragging, setDragging] = useState(false);
  const [certificateFieldsKey, setCertificateFieldsKey] = useState(0);
  const labelName = skillName || "this skill";
  const shownFileName =
    certificateFile?.name || keptCertificate?.fileName || "";
  const trimmedCertificateName = certificateName.trim();
  const draft: EmployeeSkillEntry = {
    ...initial,
    skillId,
    skillName,
    proficiency,
    yearsExperience,
    hasCertificate: wantCertificate ? Boolean(trimmedCertificateName) : false,
    certificateName: wantCertificate ? trimmedCertificateName : undefined,
    certificateExpiresOn: wantCertificate
      ? certificateExpiresOn.trim() || undefined
      : undefined,
    certificateFile: wantCertificate ? certificateFile : undefined,
    certificateFileName: wantCertificate
      ? certificateFile?.name ?? keptCertificate?.fileName
      : undefined,
    certificateObjectKey: wantCertificate
      ? certificateFile
        ? undefined
        : keptCertificate?.objectKey
      : undefined,
  };
  const expiryInvalid =
    wantCertificate && !isFutureCertificateExpiry(certificateExpiresOn);
  const canSubmit =
    isCompleteSkillEntry(draft) &&
    (!wantCertificate || Boolean(trimmedCertificateName)) &&
    !expiryInvalid;

  function applyFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setCertificateFile(file);
    setWantCertificate(true);
  }

  function clearCertificate() {
    setCertificateFile(undefined);
    setKeptCertificate(null);
    setCertificateName("");
    setCertificateExpiresOn("");
    setCertificateFieldsKey((key) => key + 1);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    applyFile(event.dataTransfer.files?.[0]);
  }

  return (
    <DialogShell
      open={open}
      title={mode === "edit" ? "Edit Skill" : "Add New Skill"}
      className={ui.skillDialog}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.btnQuiet} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={ui.btnPrimary}
            disabled={!canSubmit}
            onClick={() => onSubmit(draft)}
          >
            {mode === "edit" ? "Save" : "Add Skill"}
          </button>
        </>
      }
    >
      <div className={ui.skillsDialogBody}>
        <div className={ui.skillsDialogField}>
          <span className={ui.skillsDialogLabel}>Skill Name</span>
          <EmployeesSearchCombobox
            value={skillId}
            options={skillOptions}
            disabled={skillOptions.length === 0}
            allowEmpty={false}
            placeholder="Search skills…"
            noMatchesMessage="No matching skills"
            aria-label="Skill name"
            onChange={(nextId) => {
              const selected = catalog.find(
                (option) => option.skillId === nextId,
              );
              if (!selected) {
                return;
              }
              setSkillId(selected.skillId);
              setSkillName(selected.skillName);
            }}
          />
        </div>
        <div className={ui.skillsDialogSplit}>
          <div className={ui.skillsDialogField}>
            <span className={ui.skillsDialogLabel}>Proficiency Level</span>
            <AppSelect
              value={proficiency}
              placeholder="Beginner"
              aria-label={`Proficiency level for ${labelName}`}
              options={SKILL_PROFICIENCIES.map((value) => ({
                value,
                label: SKILL_PROFICIENCY_LABELS[value],
              }))}
              onChange={(value) => {
                setProficiency(parseSkillProficiencyValue(value));
              }}
            />
          </div>
          <div className={ui.skillsDialogField}>
            <span className={ui.skillsDialogLabel}>Work Experience</span>
            <AppSelect
              value={yearsExperience}
              placeholder="Select YOE"
              aria-label={`Work experience for ${labelName}`}
              options={SKILL_EXPERIENCE_RANGES.map((value) => ({
                value,
                label: value,
              }))}
              onChange={setYearsExperience}
            />
          </div>
        </div>
        <div className={ui.skillsCertToggleRow}>
          <span className={ui.skillsDialogLabel}>
            Do you have a certificate for this skill?
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={wantCertificate}
            aria-label="Do you have a certificate for this skill?"
            className={ui.skillsCertSwitch}
            onClick={() => setWantCertificate((current) => !current)}
          >
            <span className={ui.srOnly}>
              {wantCertificate ? "Yes" : "No"}
            </span>
          </button>
        </div>
        {wantCertificate ? (
          <div className={ui.skillsDialogCertBlock}>
            <div className={ui.skillsDialogField}>
              <span className={ui.skillsDialogLabel}>
                Certificate Name{" "}
                <span className={ui.fieldRequired} aria-hidden="true">
                  *
                </span>
              </span>
              <input
                key={`certificate-name-${certificateFieldsKey}`}
                className={ui.skillsDialogInput}
                value={certificateName}
                placeholder="e.g. AWS Certified Developer"
                aria-label="Certificate name"
                aria-required="true"
                onChange={(event) => setCertificateName(event.target.value)}
              />
            </div>
            <div className={ui.skillsDialogField}>
              <span className={ui.skillsDialogLabel}>
                Expiry Date{" "}
                <span className={ui.skillsDialogOptional}>(Optional)</span>
              </span>
              <AppDateField
                key={`certificate-expiry-${certificateFieldsKey}`}
                value={certificateExpiresOn}
                minDate={tomorrowIsoDate()}
                aria-label="Certificate expiry date"
                invalid={expiryInvalid}
                onChange={setCertificateExpiresOn}
              />
              {expiryInvalid ? (
                <p className={ui.fieldError} role="alert">
                  Expiry date must be in the future.
                </p>
              ) : null}
            </div>
            {shownFileName ? (
              <div className={ui.skillsCertCurrent}>
                <Award
                  size={16}
                  aria-hidden
                  className={ui.skillsCertIcon}
                />
                <span className={ui.skillsCertName}>{shownFileName}</span>
                <button
                  type="button"
                  className={ui.skillsCertRemove}
                  aria-label={`Remove certificate for ${labelName}`}
                  onClick={clearCertificate}
                >
                  Remove
                </button>
              </div>
            ) : (
              <label
                className={cx(
                  ui.skillsDropzone,
                  dragging && ui.skillsDropzoneActive,
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <CloudUpload size={28} aria-hidden className={ui.skillsDropzoneIcon} />
                <span className={ui.skillsDropzoneCopy}>
                  Drag and drop your certificate here, or{" "}
                  <span className={ui.skillsDropzoneBrowse}>browse</span>
                </span>
                <span className={ui.skillsDropzoneHint}>
                  PDF, JPG or PNG (max. 5MB)
                </span>
                <input
                  type="file"
                  className={ui.srOnly}
                  accept={SKILL_CERTIFICATE_ACCEPT}
                  aria-label={`Certificate for ${labelName}`}
                  onChange={(event) => {
                    applyFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        ) : null}
      </div>
    </DialogShell>
  );
}

export function SkillsStep({
  draft,
  readOnly,
  onChange,
  skillCatalog = [],
  employeeCatalogError = null,
  onDownloadCertificate,
  onViewCertificate,
  onPersistEntries,
  headingId,
  editing,
  onEdit,
  editLabel,
  stopEditLabel,
}: Omit<WizardStepProps, "dataSupervisors" | "dataProjects"> & {
  readonly onDownloadCertificate?: (entry: EmployeeSkillEntry) => void;
  readonly onViewCertificate?: (entry: EmployeeSkillEntry) => void;
  /** When set, skill add/edit/remove persists immediately (My Profile). */
  readonly onPersistEntries?: (
    entries: readonly EmployeeSkillEntry[],
  ) => void;
  readonly headingId?: string;
} & AppSectionEditProps) {
  const entries = draft.professional.skillEntries;
  const catalog = skillCatalog;
  const takenIds = new Set(
    entries.map((row) => row.skillId).filter(Boolean),
  );
  const remaining = catalog.filter((row) => !takenIds.has(row.skillId));
  const hasPendingRow = entries.some((row) => !row.skillId);
  const canAdd = !readOnly && remaining.length > 0 && !hasPendingRow;
  const [dialog, setDialog] = useState<
    { readonly mode: "add" } | { readonly mode: "edit"; readonly index: number }
  | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{
    readonly index: number;
    readonly name: string;
  } | null>(null);

  function patchEntries(next: readonly EmployeeSkillEntry[]) {
    onChange({
      professional: withSkillEntries(draft.professional, next),
    });
  }

  function applyEntries(
    next: readonly EmployeeSkillEntry[],
    persist = false,
  ) {
    if (persist && onPersistEntries) {
      onPersistEntries(next);
      return;
    }
    patchEntries(next);
  }

  function removeSkill(index: number) {
    applyEntries(
      entries.filter((_, rowIndex) => rowIndex !== index),
      Boolean(onPersistEntries),
    );
  }

  const editingRow =
    dialog?.mode === "edit" ? entries[dialog.index] : undefined;
  const dialogSkillOptions = (
    dialog?.mode === "edit" && editingRow
      ? catalog.filter(
          (option) =>
            option.skillId === editingRow.skillId ||
            !takenIds.has(option.skillId),
        )
      : remaining
  ).map((option) => ({
    value: option.skillId,
    label: option.skillName,
  }));

  const skillRows = entries.map((row, index) => ({ row, index }));
  // The columns must stay the same object between renders: a rebuilt cell would
  // remount the row menu and close it. Callbacks that change are read from a ref.
  const certificateActionsRef = useRef({ onViewCertificate, onDownloadCertificate });
  certificateActionsRef.current = { onViewCertificate, onDownloadCertificate };
  const skillColumns = useMemo<
    AppDataTableColumn<{
      readonly row: EmployeeSkillEntry;
      readonly index: number;
    }>[]
  >(() => [
    {
      id: "name",
      header: "Skill Name",
      cell: ({ row }) => (
        <p className={readOnly ? ui.viewFieldValueMuted : ui.skillsName}>
          {row.skillName || "—"}
        </p>
      ),
      headerClassName: ui.skillsColName,
      cellClassName: ui.skillsColName,
    },
    {
      id: "proficiency",
      header: "Proficiency Level",
      cell: ({ row }) =>
        row.proficiency ? (
          readOnly ? (
            <span className={ui.viewFieldValueMuted}>
              {SKILL_PROFICIENCY_LABELS[row.proficiency]}
            </span>
          ) : (
            <span className={proficiencyPillClass(row.proficiency)}>
              {SKILL_PROFICIENCY_LABELS[row.proficiency]}
            </span>
          )
        ) : (
          <span className={ui.muted}>—</span>
        ),
      headerClassName: ui.skillsColChoice,
      cellClassName: ui.skillsColChoice,
    },
    {
      id: "experience",
      header: "Work Experience",
      cell: ({ row }) => (
        <span className={readOnly ? ui.viewFieldValueMuted : ui.skillsExperience}>
          {row.yearsExperience || "—"}
        </span>
      ),
      headerClassName: ui.skillsColChoice,
      cellClassName: ui.skillsColChoice,
    },
    {
      id: "certificate",
      header: "Certificate",
      cell: ({ row }) => {
        const labelName = row.skillName || "new skill";
        const displayCertificateName =
          row.certificateName ||
          row.certificateFile?.name ||
          row.certificateFileName ||
          "Certificate";
        const expiryLabel = formatCertificateExpiry(row.certificateExpiresOn);
        const canDownload = Boolean(
          row.certificateObjectKey || row.certificateFile,
        );
        return skillHasCertificate(row) ? (
          <div className={ui.skillsCert}>
            <Award size={16} aria-hidden className={ui.skillsCertIcon} />
            <span className={ui.skillsCertCopy}>
              <span className={ui.skillsCertName}>{displayCertificateName}</span>
              {expiryLabel ? (
                <span className={ui.skillsCertMeta}>Expires {expiryLabel}</span>
              ) : null}
            </span>
            {canDownload ? (
              <span className={ui.skillsCertIconActions}>
                <button
                  type="button"
                  className={ui.skillsCertIconBtn}
                  aria-label={`Preview ${displayCertificateName} for ${labelName}`}
                  onClick={() => certificateActionsRef.current.onViewCertificate?.(row)}
                >
                  <Eye size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className={ui.skillsCertIconBtn}
                  aria-label={`Download ${displayCertificateName} for ${labelName}`}
                  onClick={() => certificateActionsRef.current.onDownloadCertificate?.(row)}
                >
                  <Download size={16} aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
        ) : (
          <span className={ui.skillsCertNone}>None</span>
        );
      },
      headerClassName: ui.skillsColCert,
      cellClassName: ui.skillsColCert,
    },
    ...(readOnly
      ? []
      : [
          {
            id: "actions",
            header: "Actions",
            cell: ({ row, index }: { row: EmployeeSkillEntry; index: number }) => {
              const labelName = row.skillName || "new skill";
              return (
                <SkillsRowMenu
                  labelName={labelName}
                  canEdit={Boolean(row.skillId)}
                  onEdit={() => {
                    if (row.skillId) {
                      setDialog({ mode: "edit", index });
                    }
                  }}
                  onRemove={() =>
                    setPendingRemove({ index, name: row.skillName })
                  }
                />
              );
            },
            headerClassName: ui.skillsActions,
            cellClassName: ui.skillsActions,
          },
        ]),
  ], [readOnly, setDialog, setPendingRemove]);

  return (
    <div className={ui.wizardSectionStack}>
      <div className={ui.skillsHeader}>
        <div className={ui.skillsHeaderCopy}>
          <h2 id={headingId} className={ui.sectionHeaderTitle}>
            Skills
          </h2>
          <p className={ui.sectionHeaderLede}>
            Add and manage your professional skills.
          </p>
        </div>
        <div className={ui.skillsHeaderActions}>
          {onEdit ? (
            <AppSectionEditButton
              editing={editing}
              onClick={onEdit}
              label="skills"
              editLabel={editLabel}
              stopEditLabel={stopEditLabel}
            />
          ) : null}
          {readOnly ? null : (
            <button
              type="button"
              className={ui.skillsAddBtn}
              disabled={!canAdd}
              onClick={() => {
                if (!canAdd) {
                  return;
                }
                setDialog({ mode: "add" });
              }}
            >
              <Plus size={16} aria-hidden />
              Add Skill
            </button>
          )}
        </div>
      </div>
      {entries.length === 0 ? (
        <p className={ui.sectionHeaderLede}>No skills added yet.</p>
      ) : (
        <AppDataTable
          ariaLabel="Skills"
          data={skillRows}
          columns={skillColumns}
          getRowId={({ row, index }) => row.skillId || `pending-${index}`}
        />
      )}
      {employeeCatalogError ? (
        <span className={ui.muted}>{employeeCatalogError}</span>
      ) : catalog.length === 0 ? (
        <span className={ui.muted}>{emptyOrgCatalogHint("skill")}</span>
      ) : null}
      <SkillEntryDialog
        key={
          dialog == null
            ? "skill-dialog-closed"
            : dialog.mode === "edit"
              ? `skill-dialog-edit-${dialog.index}-${editingRow?.skillId ?? ""}`
              : "skill-dialog-add"
        }
        open={dialog != null}
        mode={dialog?.mode === "edit" ? "edit" : "add"}
        initial={editingRow ?? EMPTY_SKILL_ENTRY}
        skillOptions={dialogSkillOptions}
        catalog={catalog}
        onClose={() => setDialog(null)}
        onSubmit={(entry) => {
          if (dialog?.mode === "edit") {
            applyEntries(
              entries.map((row, rowIndex) =>
                rowIndex === dialog.index ? { ...row, ...entry } : row,
              ),
              Boolean(onPersistEntries),
            );
          } else {
            // Add Skill: persist to backend when My Profile callback is set.
            applyEntries([...entries, entry], Boolean(onPersistEntries));
          }
          setDialog(null);
        }}
      />
      <ConfirmDialogShell
        open={pendingRemove != null}
        title="Remove skill?"
        description={
          pendingRemove?.name
            ? `Remove ${pendingRemove.name} from this profile? You can add it again later.`
            : "Remove this skill from the list?"
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        tone="danger"
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) {
            removeSkill(pendingRemove.index);
          }
          setPendingRemove(null);
        }}
      />
    </div>
  );
}

export function AccessStep({
  draft,
  readOnly,
  onChange,
  actor,
}: Pick<WizardStepProps, "draft" | "readOnly" | "onChange" | "actor">) {
  const roleOptions = (() => {
    if (!actor) {
      return [draft.role];
    }
    const allowed = getAllowedTargetRoles(actor);
    if (!allowed.includes(draft.role)) {
      return [draft.role, ...allowed];
    }
    return allowed;
  })();

  if (readOnly || !actor) {
    return (
      <dl className={ui.wizardSummary}>
        <div>
          <dt>Role</dt>
          <dd>{HRMS_ROLE_LABELS[draft.role]}</dd>
        </div>
        <div>
          <dt>Access permissions</dt>
          <dd>
            {[
              draft.accessFlags.createAccess ? "Create" : null,
              draft.accessFlags.editAccess ? "Edit" : null,
              draft.accessFlags.viewAccess ? "View" : null,
              draft.accessFlags.fullAccess ? "Full access" : null,
            ]
              .filter(Boolean)
              .join(", ") || "No access"}
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <div className={ui.profileStep}>
      <div className={ui.field}>
        <span className={ui.fieldLabel}>Role</span>
        <AppSelect
          value={draft.role}
          aria-label="Role"
          options={roleOptions.map((role) => ({
            value: role,
            label: HRMS_ROLE_LABELS[role],
          }))}
          onChange={(nextRole) => {
            const role = nextRole as HrmsRole;
            const access = syncAccessRoleFields(role, role);
            onChange({
              role: access.role,
              department: access.department,
              accessFlags:
                access.role === "EMPLOYEE"
                  ? VIEW_ONLY_ACCESS_FLAGS
                  : FULL_ACCESS_FLAGS,
            });
          }}
        />
      </div>
      <p className={ui.muted}>
        Access flags are derived from role (employees get view-only; staff roles
        get full access).
      </p>
      <dl className={ui.wizardSummary}>
        <div>
          <dt>Access permissions</dt>
          <dd>
            {[
              draft.accessFlags.createAccess ? "Create" : null,
              draft.accessFlags.editAccess ? "Edit" : null,
              draft.accessFlags.viewAccess ? "View" : null,
              draft.accessFlags.fullAccess ? "Full access" : null,
            ]
              .filter(Boolean)
              .join(", ") || "No access"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function OrganizationStep({
  draft,
  readOnly,
  onChange,
  dataEmployees = [],
  dataVendors = [],
  orgDepartments = [],
  orgLocations = [],
  orgDesignations = [],
  leavePolicyOptions = [],
  orgCatalogError = null,
  selfRestricted = false,
  editing,
  onEdit,
  editLabel,
  stopEditLabel,
  reportingManagerEmployees = null,
}: Omit<
  WizardStepProps,
  "dataProjects" | "actor" | "nationalIdTypes" | "employeeCatalogError"
> &
  AppSectionEditProps) {
  const managerSearch = useReportingManagerSearch();
  // With a server search the options are exactly its results.
  const reportingManagerSource = managerSearch
    ? (reportingManagerEmployees ?? [])
    : mergeReportingManagerEmployeeSource(
        dataEmployees,
        reportingManagerEmployees,
      );

  // The roles an employee can have, plus any other value already on a loaded
  // person; the directory is no longer loaded in full to find them.
  const accessBuckets = [
    ...new Set([
      ...Object.keys(HRMS_ROLE_LABELS),
      ...dataEmployees.map((row) => row.department).filter(Boolean),
    ]),
  ].sort();
  if (draft.department && !accessBuckets.includes(draft.department)) {
    accessBuckets.unshift(draft.department);
  }

  const filteredSupervisors = selectReportingManagerOptions(
    reportingManagerSource,
    {
      jobRank: draft.jobRank,
      projectIds: draft.projectIds,
      excludeEmployeeId: draft.id,
    },
  );
  const reportingManagerOptions = buildReportingManagerComboboxOptions(
    filteredSupervisors,
    draft.supervisorId,
    draft.supervisorName,
  );

  const cardId = useId();
  const departmentHint = orgCatalogError ? (
    <span className={ui.muted}>{orgCatalogError}</span>
  ) : orgDepartments.length === 0 ? (
    <span className={ui.muted}>{emptyOrgCatalogHint("department")}</span>
  ) : null;
  const locationHint =
    orgCatalogError || orgLocations.length > 0 ? null : (
      <span className={ui.muted}>{emptyOrgCatalogHint("location")}</span>
    );
  const designationHint =
    orgCatalogError || orgDesignations.length > 0 ? null : (
      <span className={ui.muted}>{emptyOrgCatalogHint("designation")}</span>
    );

  function patchAccessDepartment(department: string) {
    const access = syncAccessRoleFields(department, department);
    onChange({
      department: access.department,
      role: access.role,
      accessFlags: isHrmsRole(access.role)
        ? access.role === "EMPLOYEE"
          ? VIEW_ONLY_ACCESS_FLAGS
          : FULL_ACCESS_FLAGS
        : draft.accessFlags,
    });
  }

  return (
    <ProfileFormCard
      title="Employment Information"
      titleId={`${cardId}-employment`}
      editing={editing}
      onEdit={onEdit}
      editLabel={editLabel}
      stopEditLabel={stopEditLabel}
    >
      {draft.businessEmployeeId ? (
        <ProfileTextField
          label="Employee ID"
          readOnly={readOnly}
          value={draft.businessEmployeeId}
          systemGenerated
        />
      ) : null}
      <ProfileTextField
        label="Employee code"
        readOnly={readOnly}
        value={draft.employeeCode}
        systemGenerated
      />
      <ProfileTextField
        label="Work email"
        type="email"
        readOnly={readOnly}
        value={draft.workEmail}
        // systemGenerated — restore when Microsoft 365 generates official email
        onChange={(workEmail) => onChange({ workEmail })}
      />
      <DepartmentCascadeFields
        departments={orgDepartments}
        departmentId={draft.departmentId}
        readOnly={readOnly}
        hint={departmentHint}
        onChange={({ departmentId, departmentName }) =>
          onChange({
            departmentId,
            departmentName,
          })
        }
      />
      {readOnly ? (
        <ViewField
          label="Location"
          value={
            orgLocations.find(
              (location) => location.locationId === draft.locationId,
            )?.locationName ??
            draft.locationName ??
            ""
          }
        />
      ) : (
        <div className={ui.field}>
          <FieldLabel>Location</FieldLabel>
          <EmployeesSearchCombobox
            value={draft.locationId ?? ""}
            placeholder="Search location"
            emptyLabel="Select location"
            noMatchesMessage="No matching locations"
            aria-label="Location"
            options={orgLocations.map((location) => ({
              value: location.locationId,
              label: location.locationName,
            }))}
            onChange={(locationId) => {
              const match = orgLocations.find(
                (location) => location.locationId === locationId,
              );
              onChange({
                locationId: locationId || null,
                locationName: match?.locationName ?? null,
              });
            }}
          />
          {locationHint}
        </div>
      )}
      {readOnly ? (
        <ViewField
          label="Work mode"
          value={
            draft.workMode
              ? (WORK_MODE_LABELS[
                  draft.workMode as keyof typeof WORK_MODE_LABELS
                ] ?? draft.workMode)
              : ""
          }
        />
      ) : (
        <div className={ui.field}>
          <FieldLabel>Work mode</FieldLabel>
          <EmployeesSearchCombobox
            value={draft.workMode ?? ""}
            placeholder="Search work mode"
            emptyLabel="Select work mode"
            noMatchesMessage="No matching work modes"
            aria-label="Work mode"
            options={WORK_MODES.map((mode) => ({
              value: mode,
              label: WORK_MODE_LABELS[mode],
            }))}
            onChange={(workMode) => onChange({ workMode: workMode || null })}
          />
        </div>
      )}
      {readOnly ? (
        <ViewField
          label="Designation"
          value={
            orgDesignations.find(
              (designation) => designation.designationId === draft.designationId,
            )?.title ??
            draft.title ??
            ""
          }
        />
      ) : (
        <div className={ui.field}>
          <FieldLabel>Designation</FieldLabel>
          <EmployeesSearchCombobox
            value={draft.designationId ?? ""}
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
                (designation) => designation.designationId === designationId,
              );
              onChange({
                designationId: designationId || null,
                title: match?.title ?? draft.title,
                jobDescription: match?.title ?? draft.jobDescription,
              });
            }}
          />
          {designationHint}
        </div>
      )}
      {!selfRestricted ? (
        accessBuckets.length > 0 ? (
          <ProfileSelectField
            label="Role / access"
            readOnly={readOnly}
            value={draft.department}
            ariaLabel="Role / access"
            options={accessBuckets.map((department) => ({
              value: department,
              label: department,
            }))}
            onChange={patchAccessDepartment}
          />
        ) : (
          <ProfileTextField
            label="Role / access"
            readOnly={readOnly}
            value={draft.department}
            ariaLabel="Role / access"
            onChange={patchAccessDepartment}
          />
        )
      ) : null}
      <ProfileSelectField
        label="Employment type"
        readOnly={readOnly}
        value={draft.employmentType}
        placeholder="Select employment type"
        options={EMPLOYMENT_TYPES.map((type) => ({
          value: type,
          label: EMPLOYMENT_TYPE_LABELS[type],
        }))}
        onChange={(employmentType) => {
          const nextType = employmentType as EmploymentType;
          onChange({
            employmentType: nextType,
            vendorId: isVendorRequired(nextType) ? draft.vendorId : null,
          });
        }}
      />
      {isVendorRequired(draft.employmentType) ? (
        <ProfileSelectField
          label="Vendor"
          required
          readOnly={readOnly}
          value={draft.vendorId ?? ""}
          placeholder="Select vendor"
          options={dataVendors.map((vendor) => ({
            value: vendor.id,
            label: vendor.name,
          }))}
          onChange={(vendorId) => onChange({ vendorId: vendorId || null })}
        />
      ) : null}
      <div className={ui.profileStepRowLead}>
        {readOnly ? (
          <ViewField
            label="Reporting manager"
            value={
              draft.supervisorId
                ? (reportingManagerOptions.find(
                    (option) => option.value === draft.supervisorId,
                  )?.label ?? "—")
                : "None"
            }
          />
        ) : (
          <div className={ui.field}>
            <span className={ui.fieldLabel}>Reporting manager</span>
            <EmployeesSearchCombobox
              value={draft.supervisorId ?? ""}
              placeholder="Search active employees"
              emptyLabel="None"
              aria-label="Reporting manager"
              options={reportingManagerOptions}
              selectedLabel={draft.supervisorName ?? undefined}
              serverFiltered={Boolean(managerSearch)}
              loading={managerSearch?.loading}
              onOpenChange={(open) => {
                if (!open) {
                  managerSearch?.search(null);
                }
              }}
              onQueryChange={managerSearch?.search}
              onChange={(supervisorId) => {
                const selected = reportingManagerOptions.find(
                  (supervisor) => supervisor.value === supervisorId,
                );
                onChange({
                  supervisorId: supervisorId || null,
                  supervisorName: selected?.label ?? null,
                });
              }}
            />
          </div>
        )}
      </div>
      <ProfileTextField
        label="Start date"
        type="date"
        readOnly={readOnly}
        value={draft.startDate}
        onChange={(startDate) => onChange({ startDate })}
      />
      <ProfileTextField
        label="Employment status"
        readOnly={readOnly}
        value={EMPLOYEE_STATUS_LABELS[draft.status] ?? draft.status}
        systemGenerated
      />
      <div className={ui.profileStepRowLead}>
        <ProfileTextField
          label="Payroll start date"
          type="date"
          readOnly={readOnly}
          value={draft.payrollStartDate ?? ""}
          minDate={draft.startDate || undefined}
          onChange={(payrollStartDate) =>
            onChange({ payrollStartDate: payrollStartDate || null })
          }
        />
      </div>
      <div className={ui.profileStepRowLead}>
        <div className={ui.viewField}>
          <span className={ui.viewFieldLabel}>Timesheet required</span>
          <AppCheckbox
            checked={Boolean(draft.timesheetRequired)}
            disabled={readOnly}
            label=""
            aria-label="Timesheet required"
            onChange={(timesheetRequired) =>
              onChange({ timesheetRequired })
            }
          />
        </div>
      </div>
      <ProfileSelectField
        label="Leave policy"
        required
        readOnly={readOnly}
        value={draft.leavePolicyId ?? ""}
        placeholder={
          leavePolicyOptions.length === 0
            ? "No active leave policies"
            : "Select leave policy"
        }
        options={(() => {
          const options = leavePolicyOptions.map((policy) => ({
            value: policy.policyId,
            label:
              policy.status === "Active"
                ? policy.policyName
                : `${policy.policyName} (Inactive)`,
          }));
          const currentId = draft.leavePolicyId?.trim() ?? "";
          const currentName = draft.leavePolicyName?.trim() ?? "";
          if (
            currentId &&
            currentName &&
            !options.some((option) => option.value === currentId)
          ) {
            return [...options, { value: currentId, label: currentName }];
          }
          return options;
        })()}
        onChange={(leavePolicyId) => {
          const selected = leavePolicyOptions.find(
            (policy) => policy.policyId === leavePolicyId,
          );
          onChange({
            leavePolicyId: leavePolicyId || null,
            leavePolicyName: selected?.policyName ?? null,
          });
        }}
      />
    </ProfileFormCard>
  );
}
