import { useId, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { AppSectionCard } from "@/shared/ui";
import {
  LOCATION_COUNTRIES,
  timezoneDisplayLabel,
  type LocationRecord,
} from "@/modules/org";
import { cx, empUi as ui } from "@/shared/ui/empUi";
import { PROFILE_FORM_CHROME } from "@/shared/ui/fieldChrome";
import {
  FieldLabel,
  ProfileSelectField,
  ProfileTextField,
  ViewField,
} from "@/modules/employees/components/profileFields";
import { EmployeesPhoneInput } from "@/modules/employees/components/EmployeesPhoneInput";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_TYPES,
  isAllowedCompanyLogoFile,
  LOGO_ACCEPT,
  LOGO_HINT,
  MAX_LOGO_BYTES,
  MAX_LOGO_LABEL,
  TIMESHEET_REMINDER_WEEKDAYS,
  TIMESHEET_HOURS_FORMAT_OPTIONS,
} from "../constants";
import { headquartersOptionLabel, validateCompanyDraft } from "../selectors";
import { normalizeCompanyWebsite } from "../website";
import type {
  CompanyDraft,
  CompanyModuleData,
  CompanyRecord,
  TimesheetHoursFormat,
} from "../types";
import { companyUi } from "../uiClasses";
import { CompanyLogo } from "./CompanyLogo";

type SectionId = "contact" | "headquarters" | "configuration";

/** Pending logo chosen before the company row exists (create flow). */
export type CompanyPendingLogo = {
  readonly file: File | null;
};

interface CompanyPanelProps {
  readonly company: CompanyRecord;
  readonly data: CompanyModuleData;
  readonly locations: readonly LocationRecord[];
  readonly canEdit: boolean;
  readonly canConfigure: boolean;
  readonly onSave: (
    draft: CompanyDraft,
    logo?: CompanyPendingLogo,
  ) => boolean | Promise<boolean>;
  readonly onSaveConfiguration: (config: {
    readonly timesheetReminderWeekday: number;
    readonly timesheetHoursFormat: TimesheetHoursFormat;
  }) => boolean | Promise<boolean>;
  readonly logoSrc?: string | null;
  readonly onUploadLogo?: (file: File) => boolean | Promise<boolean>;
  readonly onRemoveLogo?: () => boolean | Promise<boolean>;
  readonly onOpenLocations?: () => void;
}

interface FormState {
  name: string;
  type: string;
  email: string;
  phone: string;
  website: string;
  headquartersLocationId: string;
  timesheetReminderWeekday: number;
  timesheetHoursFormat: TimesheetHoursFormat;
}

function buildInitialForm(company: CompanyRecord): FormState {
  return {
    name: company.name,
    type: company.type,
    email: company.email,
    phone: company.phone,
    website: company.website,
    headquartersLocationId: company.headquartersLocationId ?? "",
    timesheetReminderWeekday: company.timesheetReminderWeekday,
    timesheetHoursFormat: company.timesheetHoursFormat,
  };
}

function toDraft(form: FormState): CompanyDraft {
  return {
    name: form.name.trim(),
    type: form.type.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    website: normalizeCompanyWebsite(form.website) ?? form.website.trim(),
    headquartersLocationId: form.headquartersLocationId.trim() || null,
  };
}

function countryDisplayName(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) {
    return "";
  }
  return (
    LOCATION_COUNTRIES.find((country) => country.code === trimmed)?.name ??
    trimmed
  );
}

function LogoField({
  editing,
  logoSrc,
  companyName,
  companyId,
  onPick,
  onRemove,
}: {
  readonly editing: boolean;
  readonly logoSrc: string | null;
  readonly companyName: string;
  readonly companyId: string;
  readonly onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onRemove: () => void;
}) {
  const mark = (
    <CompanyLogo
      logoUrl={logoSrc}
      companyName={companyName}
      companyId={companyId}
      size="medium"
      tile="contrast"
      emptyDisplay="empty"
    />
  );

  if (!editing) {
    return (
      <div className={ui.viewField}>
        <span className={ui.viewFieldLabel}>Company logo</span>
        {mark}
      </div>
    );
  }

  return (
    <div className={ui.field}>
      <FieldLabel>Company logo</FieldLabel>
      <div className="flex min-h-[2.35rem] items-center gap-2">
        {mark}
        <label className={cx(ui.photoCapsule, "text-[0.78rem] font-semibold")}>
          <input
            type="file"
            accept={LOGO_ACCEPT}
            aria-label="Upload company logo"
            className={companyUi.srOnly}
            onChange={onPick}
          />
          {logoSrc ? "Replace" : "Upload"}
        </label>
        {logoSrc ? (
          <button type="button" className={ui.btnQuiet} onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>
      <span className={ui.fieldHint}>{LOGO_HINT}</span>
    </div>
  );
}

export function CompanyPanel({
  company,
  data,
  locations,
  canEdit,
  canConfigure,
  onSave,
  onSaveConfiguration,
  logoSrc = null,
  onUploadLogo,
  onRemoveLogo,
  onOpenLocations,
}: CompanyPanelProps) {
  const titleId = useId();
  const isCreate = company.id === "__new__";
  const [editing, setEditing] = useState<SectionId | null>(
    isCreate ? "contact" : null,
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildInitialForm(company));
  const [error, setError] = useState<string | null>(null);
  const [localLogoSrc, setLocalLogoSrc] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);

  const activeLocations = useMemo(
    () => locations.filter((location) => location.status === "Active"),
    [locations],
  );
  const headquartersOptions = useMemo(() => {
    const options = activeLocations.map((location) => ({
      value: location.locationId,
      label: headquartersOptionLabel(location),
    }));
    const selected = form.headquartersLocationId;
    if (
      selected &&
      !options.some((option) => option.value === selected)
    ) {
      const current = locations.find(
        (location) => location.locationId === selected,
      );
      if (current) {
        return [
          {
            value: current.locationId,
            label: headquartersOptionLabel(current),
          },
          ...options,
        ];
      }
    }
    return options;
  }, [activeLocations, form.headquartersLocationId, locations]);

  const selectedHeadquarters = useMemo(
    () =>
      locations.find(
        (location) => location.locationId === form.headquartersLocationId,
      ) ?? null,
    [form.headquartersLocationId, locations],
  );

  const typeOptions = useMemo(() => {
    const options = [
      { value: "", label: "Select company type" },
      ...COMPANY_TYPES.map((type) => ({
        value: type,
        label: type,
      })),
    ];
    if (form.type && !COMPANY_TYPES.includes(form.type as (typeof COMPANY_TYPES)[number])) {
      return [
        options[0]!,
        { value: form.type, label: form.type },
        ...options.slice(1),
      ];
    }
    return options;
  }, [form.type]);

  function patchForm(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!isAllowedCompanyLogoFile(file)) {
      setError(`Logo must be a JPG, PNG, WebP, or SVG, ${MAX_LOGO_LABEL} or smaller.`);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`Logo must be a JPG, PNG, WebP, or SVG, ${MAX_LOGO_LABEL} or smaller.`);
      return;
    }

    setError(null);
    setLogoCleared(false);
    if (localLogoSrc) {
      URL.revokeObjectURL(localLogoSrc);
    }
    setLocalLogoSrc(URL.createObjectURL(file));
    if (onUploadLogo) {
      setPendingLogoFile(null);
      void (async () => {
        const ok = await onUploadLogo(file);
        if (!ok) {
          setLocalLogoSrc((current) => {
            if (current) {
              URL.revokeObjectURL(current);
            }
            return null;
          });
          setError("Could not upload the company logo.");
        }
      })();
      return;
    }
    // Create flow: no company id yet — keep the file and upload after save.
    setPendingLogoFile(file);
  }

  async function handleLogoRemove() {
    if (onRemoveLogo) {
      const ok = await onRemoveLogo();
      if (!ok) {
        setError("Could not remove the company logo.");
        return;
      }
    }
    if (localLogoSrc) {
      URL.revokeObjectURL(localLogoSrc);
    }
    setLocalLogoSrc(null);
    setPendingLogoFile(null);
    setLogoCleared(true);
  }

  function cancelEdit() {
    setForm(buildInitialForm(company));
    setError(null);
    if (localLogoSrc) {
      URL.revokeObjectURL(localLogoSrc);
    }
    setLocalLogoSrc(null);
    setPendingLogoFile(null);
    setLogoCleared(false);
    setEditing(null);
  }

  async function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = toDraft(form);
    const errors = validateCompanyDraft(draft, data.companies, company.id);
    if (errors.length > 0) {
      setError(errors[0]!.message);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const ok = await onSave(
        draft,
        isCreate ? { file: pendingLogoFile } : undefined,
      );
      if (ok) {
        setPendingLogoFile(null);
        setEditing(null);
      }
    } finally {
      setSaving(false);
    }
  }

  const statusClass =
    company.status === "ACTIVE"
      ? companyUi.statusActive
      : companyUi.statusInactive;

  const contactEditing = editing === "contact";
  const headquartersEditing = editing === "headquarters";
  const configurationEditing = editing === "configuration";

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const ok = await onSaveConfiguration({
        timesheetReminderWeekday: form.timesheetReminderWeekday,
        timesheetHoursFormat: form.timesheetHoursFormat,
      });
      if (ok) {
        setEditing(null);
      }
    } finally {
      setSaving(false);
    }
  }

  const manageLocationsButton = onOpenLocations ? (
    <button
      type="button"
      className={companyUi.btnGhostCompact}
      onClick={onOpenLocations}
    >
      Manage locations
    </button>
  ) : null;

  return (
    <section
      className={cx(companyUi.page, PROFILE_FORM_CHROME)}
      role="region"
      aria-labelledby={titleId}
    >
      <header className={companyUi.pageHeader}>
        <div className={companyUi.pageHeaderMain}>
          <h2 id={titleId} className={companyUi.pageTitle}>
            {isCreate
              ? form.name.trim() || "Add company profile"
              : company.name}
          </h2>
          {isCreate ? null : (
            <span className={statusClass}>
              {COMPANY_STATUS_LABELS[company.status]}
            </span>
          )}
        </div>
      </header>

      <div className={companyUi.sections}>
        <AppSectionCard
          as="article"
          title="Name and contact"
          headingLevel="h3"
          bodyClassName={ui.profileStepPersonal}
          editing={contactEditing}
          onEdit={
            canEdit
              ? contactEditing
                ? cancelEdit
                : () => {
                    setError(null);
                    setForm(buildInitialForm(company));
                    setEditing("contact");
                  }
              : undefined
          }
          editLabel="Edit name and contact"
          stopEditLabel="Stop editing name and contact"
          onSave={contactEditing ? saveSection : undefined}
          onCancel={contactEditing ? cancelEdit : undefined}
          saving={saving}
        >
          {error && contactEditing ? (
            <p className={cx(ui.error, "col-span-full !mb-0")} role="alert">
              {error}
            </p>
          ) : null}
          <ProfileTextField
            label="Company name"
            required={contactEditing}
            nativeRequired={contactEditing}
            readOnly={!contactEditing}
            value={form.name}
            ariaLabel="Company name"
            onChange={(name) => patchForm({ name })}
          />
          <ProfileSelectField
            label="Company type"
            readOnly={!contactEditing}
            value={form.type}
            placeholder="Select company type"
            ariaLabel="Company type"
            options={typeOptions}
            onChange={(type) => patchForm({ type })}
          />
          <ProfileTextField
            label="Company email"
            required={contactEditing}
            nativeRequired={contactEditing}
            type="email"
            readOnly={!contactEditing}
            value={form.email}
            ariaLabel="Company email"
            onChange={(email) => patchForm({ email })}
          />
          {contactEditing ? (
            <EmployeesPhoneInput
              label="Company phone"
              required
              value={form.phone}
              ariaLabel="Company phone"
              onChange={(phone) => patchForm({ phone })}
            />
          ) : (
            <ViewField label="Company phone" value={form.phone} />
          )}
          <ProfileTextField
            label="Company website"
            required={contactEditing}
            nativeRequired={contactEditing}
            readOnly={!contactEditing}
            value={form.website}
            placeholder="company.com or https://company.com"
            ariaLabel="Company website"
            hint={
              contactEditing ? (
                <span className={ui.fieldHint}>
                  https:// is added automatically if you leave it off.
                </span>
              ) : undefined
            }
            onChange={(website) => patchForm({ website })}
          />
          <LogoField
            editing={contactEditing}
            logoSrc={logoCleared ? null : (localLogoSrc ?? logoSrc)}
            companyName={company.name}
            companyId={company.id}
            onPick={handleLogoChange}
            onRemove={() => {
              void handleLogoRemove();
            }}
          />
        </AppSectionCard>

        <AppSectionCard
          as="article"
          title="Headquarters"
          headingLevel="h3"
          bodyClassName={ui.profileStepPersonal}
          headerEnd={manageLocationsButton}
          editing={headquartersEditing}
          onEdit={
            canEdit
              ? headquartersEditing
                ? cancelEdit
                : () => {
                    setError(null);
                    setForm(buildInitialForm(company));
                    setEditing("headquarters");
                  }
              : undefined
          }
          editLabel="Edit headquarters"
          stopEditLabel="Stop editing headquarters"
          onSave={headquartersEditing ? saveSection : undefined}
          onCancel={headquartersEditing ? cancelEdit : undefined}
          saving={saving}
        >
          {error && headquartersEditing ? (
            <p className={cx(ui.error, "col-span-full !mb-0")} role="alert">
              {error}
            </p>
          ) : null}
          {activeLocations.length === 0 && !selectedHeadquarters ? (
            <p className={cx(ui.empty, "col-span-full !mb-0")}>
              Add an office in Locations, then select it as headquarters.
            </p>
          ) : (
            <>
              <ProfileSelectField
                label="Headquarters"
                required={headquartersEditing}
                readOnly={!headquartersEditing}
                value={form.headquartersLocationId}
                placeholder="Select headquarters"
                ariaLabel="Headquarters"
                options={headquartersOptions}
                hint="Add or edit offices in Locations."
                onChange={(headquartersLocationId) =>
                  patchForm({ headquartersLocationId })
                }
              />
              {selectedHeadquarters ? (
                <>
                  <ViewField
                    label="Location name"
                    value={selectedHeadquarters.locationName}
                  />
                  <ViewField
                    label="Type"
                    value={selectedHeadquarters.locationType ?? ""}
                  />
                  <ViewField
                    label="Street"
                    value={[
                      selectedHeadquarters.addressLine1,
                      selectedHeadquarters.addressLine2,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  />
                  <ViewField
                    label="City / State / ZIP"
                    value={[
                      selectedHeadquarters.city,
                      selectedHeadquarters.state,
                      selectedHeadquarters.zip,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  />
                  <ViewField
                    label="Country"
                    value={countryDisplayName(selectedHeadquarters.country)}
                  />
                  <ViewField
                    label="Timezone"
                    value={
                      selectedHeadquarters.timezone
                        ? timezoneDisplayLabel(selectedHeadquarters.timezone)
                        : ""
                    }
                  />
                  <ViewField
                    label="Code"
                    value={selectedHeadquarters.locationCode ?? ""}
                  />
                </>
              ) : null}
            </>
          )}
        </AppSectionCard>

        <AppSectionCard
          as="article"
          title="Configuration"
          headingLevel="h3"
          bodyClassName={ui.profileStepPersonal}
          editing={configurationEditing}
          onEdit={
            canConfigure
              ? configurationEditing
                ? cancelEdit
                : () => {
                    setError(null);
                    setForm(buildInitialForm(company));
                    setEditing("configuration");
                  }
              : undefined
          }
          editLabel="Edit configuration"
          stopEditLabel="Stop editing configuration"
          onSave={configurationEditing ? saveConfiguration : undefined}
          onCancel={configurationEditing ? cancelEdit : undefined}
          saving={saving}
        >
          {error && configurationEditing ? (
            <p className={cx(ui.error, "col-span-full !mb-0")} role="alert">
              {error}
            </p>
          ) : null}
          <ProfileSelectField
            label="Timesheet reminder day"
            required={configurationEditing}
            readOnly={!configurationEditing}
            value={String(form.timesheetReminderWeekday)}
            ariaLabel="Timesheet reminder day"
            hint="Employees who must submit timesheets receive a reminder email on this weekday."
            options={TIMESHEET_REMINDER_WEEKDAYS.map((day) => ({
              value: String(day.value),
              label: day.label,
            }))}
            onChange={(value) =>
              patchForm({ timesheetReminderWeekday: Number(value) })
            }
          />
          <ProfileSelectField
            label="Timesheet hours format"
            required={configurationEditing}
            readOnly={!configurationEditing}
            value={form.timesheetHoursFormat}
            ariaLabel="Timesheet hours format"
            hint="How everyone types and sees hours on timesheets. Saved hours don't change."
            options={TIMESHEET_HOURS_FORMAT_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            onChange={(value) =>
              patchForm({ timesheetHoursFormat: value === "decimal" ? "decimal" : "clock" })
            }
          />
        </AppSectionCard>
      </div>
    </section>
  );
}
