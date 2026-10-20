"use client";

import {
  useLayoutEffect,
  useRef,
} from "react";
import {
  AppDateField,
  AppSelect,
  ProfileViewField,
  profileSelectDisplayLabel,
} from "@/shared/ui";
import { EmployeesPhoneInput } from "@/modules/employees/components/EmployeesPhoneInput";
import { EmployeesMultiSearchPicker } from "@/modules/employees/components/EmployeesMultiSearchPicker";
import { EmployeesSearchCombobox } from "@/modules/employees/components/EmployeesSearchCombobox";
import { clientNameWithCategory } from "@/modules/clients/clientCategory";
import {
  emptyStakeholderDraft,
  STAKEHOLDER_DEPARTMENT_MAX,
  STAKEHOLDER_EMAIL_MAX,
  STAKEHOLDER_NAME_MAX,
  STAKEHOLDER_TITLE_MAX,
} from "@/modules/clients/createClientDraft";
import {
  CatalogTextInput,
  FieldLabel,
} from "@/modules/org/catalogFields";
import { CATALOG_CONTROL, catalogUi as ui, cx } from "@/shared/ui/catalogUi";
import { clientsUi } from "@/modules/clients/uiClasses";
import { listProjectRegionOptions } from "../projectRegionOptions";
import {
  BILLING_TYPES,
  END_CUSTOMER_MAX,
  PROJECT_STATUS_LABELS,
} from "../constants";
import { projectScheduleDateErrors } from "../selectors";
import type {
  BillingType,
  ClientOption,
  EmployeeOption,
  ProjectStatus,
} from "../types";
import {
  isIntermediaryClient,
  isInternalProjectClient,
  type ProjectFormState,
} from "../projectFormState";
import { projectsUi } from "../uiClasses";

function joinOptionLabels(
  ids: readonly string[],
  options: readonly { readonly value: string; readonly label: string }[],
): string {
  return ids
    .map((id) => profileSelectDisplayLabel(id, options))
    .filter((label) => label.trim())
    .join(", ");
}

export interface ProjectFormFieldsProps {
  readonly form: ProjectFormState;
  readonly clients: readonly ClientOption[];
  readonly employees: readonly EmployeeOption[];
  readonly projectTypeOptions: readonly string[];
  readonly projectTypesLoading?: boolean;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly disabled?: boolean;
  /** When true, show plain label+value (no input borders), like employee profile. */
  readonly viewMode?: boolean;
  /** When true, hide client picker (locked to parent client on profile page). */
  readonly lockClient?: boolean;
  /** When true, omit stakeholders block (rendered separately as a table). */
  readonly hideStakeholders?: boolean;
  /** Field grid density; profile view/edit uses 3, Add Project stays 2. */
  readonly fieldColumns?: 2 | 3;
  readonly onChange: (partial: Partial<ProjectFormState>) => void;
}

export function ProjectFormFields({
  form,
  clients,
  employees,
  projectTypeOptions,
  projectTypesLoading = false,
  fieldErrors = {},
  disabled = false,
  viewMode = false,
  lockClient = false,
  hideStakeholders = false,
  fieldColumns = 2,
  onChange,
}: ProjectFormFieldsProps) {
  const pendingStakeholderFocusRef = useRef<number | null>(null);
  const stakeholderRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useLayoutEffect(() => {
    const index = pendingStakeholderFocusRef.current;
    if (index == null) {
      return;
    }
    pendingStakeholderFocusRef.current = null;
    const row = stakeholderRowRefs.current.get(index);
    if (!row) {
      return;
    }
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const nameInput = row.querySelector<HTMLInputElement>(
      `input[aria-label="Stakeholder ${index + 1} name"]`,
    );
    nameInput?.focus();
  }, [form.clientStakeholders.length]);

  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: clientNameWithCategory(client),
  }));

  const regionOptions = listProjectRegionOptions();
  const selectedClient =
    clients.find((row) => row.id === form.clientId) ?? null;
  const isInternalClient = isInternalProjectClient(selectedClient);
  const showEndCustomer = isIntermediaryClient(selectedClient);

  const employeeOptions = employees
    .filter(
      (employee) =>
        !employee.status || employee.status.trim().toUpperCase() === "ACTIVE",
    )
    .map((employee) => ({
      value: employee.id,
      label: employee.displayName,
    }));

  const typeValues = [...projectTypeOptions];
  if (form.projectType && !typeValues.includes(form.projectType)) {
    typeValues.unshift(form.projectType);
  }
  const typeOptions = typeValues.map((value) => ({ value, label: value }));

  const billingOptions = [
    { value: "", label: "Select billing type" },
    ...BILLING_TYPES.map((value) => ({ value, label: value })),
  ];

  const statusOptions = (
    Object.entries(PROJECT_STATUS_LABELS) as [ProjectStatus, string][]
  ).map(([value, label]) => ({ value, label }));

  const scheduleDateErrors = Object.fromEntries(
    projectScheduleDateErrors(form).map((row) => [row.field, row.message]),
  );
  const endDateError = scheduleDateErrors.endDate;
  const actualEndDateError = scheduleDateErrors.actualEndDate;

  const fieldGridClass = cx(
    projectsUi.createProjectForm,
    fieldColumns === 3
      ? "grid min-w-0 w-full max-w-full grid-cols-1 items-start gap-x-8 gap-y-5 min-[56rem]:grid-cols-3"
      : "grid min-w-0 w-full max-w-full grid-cols-1 items-start gap-x-8 gap-y-5 min-[40rem]:grid-cols-2",
  );

  if (viewMode) {
    return (
      <div className={fieldGridClass}>
        {lockClient ? null : (
          <ProfileViewField
            label="Client / Internal Client"
            value={profileSelectDisplayLabel(form.clientId, clientOptions)}
          />
        )}
        {!isInternalClient ? (
          <ProfileViewField
            label="Billing Type"
            value={profileSelectDisplayLabel(form.billingType, billingOptions)}
          />
        ) : null}
        {showEndCustomer ? (
          <ProfileViewField label="End Customer" value={form.endClient} />
        ) : null}
        <ProfileViewField label="Project Name" value={form.name} />
        <ProfileViewField label="Project Code (Max 8)" value={form.code} />
        <ProfileViewField
          label="Project Description"
          value={form.description}
          className="min-[40rem]:col-span-full"
        />
        <ProfileViewField
          label="Project Type"
          value={profileSelectDisplayLabel(form.projectType, typeOptions)}
        />
        {!isInternalClient ? (
          <ProfileViewField
            label="Region"
            value={profileSelectDisplayLabel(form.region, [
              { value: "", label: "" },
              ...regionOptions,
            ])}
          />
        ) : null}
        <ProfileViewField
          label="Project Manager(s)"
          value={joinOptionLabels(form.projectManagerIds, employeeOptions)}
        />
        <ProfileViewField
          label="Account Owner(s)"
          value={joinOptionLabels(form.accountOwnerIds, employeeOptions)}
        />
        <ProfileViewField
          label="Project Status"
          value={profileSelectDisplayLabel(form.status, statusOptions)}
        />
        <ProfileViewField label="Start Date" value={form.startDate} />
        <ProfileViewField label="Planned End Date" value={form.endDate} />
        <ProfileViewField label="Actual End Date" value={form.actualEndDate} />
      </div>
    );
  }

  return (
    <div className={fieldGridClass}>
      {lockClient ? null : (
        <label className={ui.field}>
          <FieldLabel required>Client / Internal Client</FieldLabel>
          <EmployeesSearchCombobox
            value={form.clientId}
            options={clientOptions}
            placeholder="Search clients"
            allowEmpty={false}
            emptyLabel=""
            disabled={disabled}
            aria-label="Client or internal client"
            onChange={(clientId) => onChange({ clientId })}
          />
          {fieldErrors.clientId ? (
            <span className="m-0 text-[0.85rem] text-red-700" role="alert">
              {fieldErrors.clientId}
            </span>
          ) : null}
          <span className={ui.fieldHint}>
            Select a real client or an internal client (e.g., Finance, Sales,
            Marketing)
          </span>
        </label>
      )}

      {!isInternalClient ? (
        <label className={ui.field}>
          <FieldLabel required>Billing Type</FieldLabel>
          <AppSelect
            value={form.billingType}
            options={billingOptions}
            placeholder="Select billing type"
            required
            disabled={disabled}
            onChange={(billingType) =>
              onChange({ billingType: billingType as BillingType | "" })
            }
          />
          {fieldErrors.billingType ? (
            <span className="m-0 text-[0.85rem] text-red-700" role="alert">
              {fieldErrors.billingType}
            </span>
          ) : null}
        </label>
      ) : null}

      {showEndCustomer ? (
        <label className={ui.field}>
          <FieldLabel optional>End Customer</FieldLabel>
          <CatalogTextInput
            value={form.endClient}
            maxLength={END_CUSTOMER_MAX}
            placeholder="e.g., Acme Pharma"
            aria-label="End customer"
            aria-invalid={fieldErrors.endClient ? "true" : undefined}
            disabled={disabled}
            onChange={(event) => {
              onChange({ endClient: event.target.value });
            }}
          />
          {fieldErrors.endClient ? (
            <span className="m-0 text-[0.85rem] text-red-700" role="alert">
              {fieldErrors.endClient}
            </span>
          ) : null}
          <span className={ui.fieldHint}>
            The customer we serve through this intermediary client
          </span>
        </label>
      ) : null}

      <label className={ui.field}>
        <FieldLabel required>Project Name</FieldLabel>
        <CatalogTextInput
          value={form.name}
          maxLength={100}
          aria-invalid={fieldErrors.name ? "true" : undefined}
          disabled={disabled}
          onChange={(event) => {
            onChange({ name: event.target.value });
          }}
        />
        {fieldErrors.name ? (
          <span className="m-0 text-[0.85rem] text-red-700" role="alert">
            {fieldErrors.name}
          </span>
        ) : null}
      </label>

      <label className={ui.field}>
        <FieldLabel required>Project Code (Max 8)</FieldLabel>
        <CatalogTextInput
          value={form.code}
          maxLength={8}
          required
          aria-invalid={fieldErrors.code ? "true" : undefined}
          disabled={disabled}
          onChange={(event) => {
            onChange({
              code: event.target.value.replace(/[^A-Za-z0-9]/g, ""),
            });
          }}
        />
        {fieldErrors.code ? (
          <span className="m-0 text-[0.85rem] text-red-700" role="alert">
            {fieldErrors.code}
          </span>
        ) : null}
        <span className={ui.fieldHint}>
          Max 8 characters, no special characters
        </span>
      </label>

      <label className={cx(ui.field, "col-span-full")}>
        <FieldLabel optional>Project Description</FieldLabel>
        <textarea
          className={CATALOG_CONTROL}
          rows={3}
          value={form.description}
          disabled={disabled}
          aria-label="Project description"
          onChange={(event) => {
            onChange({ description: event.target.value });
          }}
        />
      </label>

      <label className={ui.field}>
        <FieldLabel optional>Project Type</FieldLabel>
        <EmployeesSearchCombobox
          value={form.projectType}
          options={typeOptions}
          placeholder={
            projectTypesLoading
              ? "Loading project types…"
              : projectTypeOptions.length === 0
                ? "No project types available"
                : "Search project types"
          }
          allowEmpty
          emptyLabel="Select type"
          disabled={disabled || projectTypesLoading}
          aria-label="Project type"
          onChange={(projectType) => onChange({ projectType })}
        />
      </label>

      {!isInternalClient ? (
        <label className={ui.field}>
          <FieldLabel optional>Region</FieldLabel>
          <AppSelect
            value={form.region}
            options={[
              {
                value: "",
                label: "Select region",
              },
              ...regionOptions,
            ]}
            placeholder="Select region"
            disabled={disabled}
            onChange={(region) => onChange({ region })}
          />
        </label>
      ) : null}

      <div className={ui.field}>
        <FieldLabel optional>Project Manager(s)</FieldLabel>
        <EmployeesMultiSearchPicker
          selectedIds={form.projectManagerIds}
          options={employeeOptions}
          disabled={disabled}
          placeholder="Search and select project managers"
          aria-label="Project managers"
          emptySelectedMessage="No project managers selected"
          onChange={(projectManagerIds) =>
            onChange({ projectManagerIds: [...projectManagerIds] })
          }
        />
        {fieldErrors.projectManagerIds ? (
          <span className="m-0 text-[0.85rem] text-red-700" role="alert">
            {fieldErrors.projectManagerIds}
          </span>
        ) : null}
        <span className={ui.fieldHint}>
          Search and select project managers (multiple allowed)
        </span>
      </div>

      <div className={ui.field}>
        <FieldLabel optional>Account Owner(s)</FieldLabel>
        <EmployeesMultiSearchPicker
          selectedIds={form.accountOwnerIds}
          options={employeeOptions}
          disabled={disabled}
          placeholder="Search and select account owners"
          aria-label="Account owners"
          emptySelectedMessage="No account owners selected"
          onChange={(accountOwnerIds) =>
            onChange({ accountOwnerIds: [...accountOwnerIds] })
          }
        />
        {fieldErrors.accountOwnerIds ? (
          <span className="m-0 text-[0.85rem] text-red-700" role="alert">
            {fieldErrors.accountOwnerIds}
          </span>
        ) : null}
        <span className={ui.fieldHint}>
          Search and select account owners (multiple allowed)
        </span>
      </div>

      <label className={ui.field}>
        <FieldLabel>Project Status</FieldLabel>
        <AppSelect
          value={form.status}
          options={statusOptions}
          disabled={disabled}
          onChange={(status) => onChange({ status: status as ProjectStatus })}
        />
        <span className={ui.fieldHint}>Defaults to Active</span>
      </label>

      <label className={ui.field}>
        <FieldLabel optional>Start Date</FieldLabel>
        <AppDateField
          value={form.startDate}
          disabled={disabled}
          aria-label="Start Date"
          onChange={(startDate) => onChange({ startDate })}
        />
      </label>

      <label className={ui.field}>
        <FieldLabel optional>Planned End Date</FieldLabel>
        <AppDateField
          value={form.endDate}
          minDate={form.startDate || undefined}
          invalid={Boolean(endDateError)}
          disabled={disabled}
          aria-label="Planned End Date"
          onChange={(endDate) => onChange({ endDate })}
        />
        {endDateError ? (
          <span className="m-0 text-[0.85rem] text-red-700" role="alert">
            {endDateError}
          </span>
        ) : null}
      </label>

      <label className={ui.field}>
        <FieldLabel optional>Actual End Date</FieldLabel>
        <AppDateField
          value={form.actualEndDate}
          minDate={form.startDate || undefined}
          invalid={Boolean(actualEndDateError)}
          disabled={disabled}
          aria-label="Actual End Date"
          onChange={(actualEndDate) => onChange({ actualEndDate })}
        />
        {actualEndDateError ? (
          <span className="m-0 text-[0.85rem] text-red-700" role="alert">
            {actualEndDateError}
          </span>
        ) : null}
      </label>

      {!hideStakeholders ? (
      <div className={cx(ui.field, "col-span-full")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <FieldLabel>Stakeholders & Representatives</FieldLabel>
          {!disabled ? (
            <button
              type="button"
              className={projectsUi.addStakeholder}
              onClick={() => {
                pendingStakeholderFocusRef.current =
                  form.clientStakeholders.length;
                onChange({
                  clientStakeholders: [
                    ...form.clientStakeholders,
                    emptyStakeholderDraft(),
                  ],
                });
              }}
            >
              + Add stakeholder
            </button>
          ) : null}
        </div>
        {fieldErrors.clientStakeholders ? (
          <span
            className="mb-2 m-0 block text-[0.85rem] text-red-700"
            role="alert"
          >
            {fieldErrors.clientStakeholders}
          </span>
        ) : null}
        {form.clientStakeholders.map((stakeholder, index) => (
          <div
            key={stakeholder.id ?? `project-stakeholder-${index}`}
            className={projectsUi.stakeholderCard}
            ref={(node) => {
              if (node) {
                stakeholderRowRefs.current.set(index, node);
              } else {
                stakeholderRowRefs.current.delete(index);
              }
            }}
          >
            <div className={clientsUi.createCardBar}>
              <strong>Stakeholder {index + 1}</strong>
              {form.clientStakeholders.length > 1 && !disabled ? (
                <button
                  type="button"
                  className={clientsUi.iconBtn}
                  aria-label={`Remove stakeholder ${index + 1}`}
                  onClick={() =>
                    onChange({
                      clientStakeholders: form.clientStakeholders.filter(
                        (_, row) => row !== index,
                      ),
                    })
                  }
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className={projectsUi.stakeholderGrid}>
              <label className={projectsUi.stakeholderField}>
                <span>
                  Full Name{" "}
                  <span className={clientsUi.requiredMark} aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  className={projectsUi.stakeholderInput}
                  required
                  value={stakeholder.name}
                  placeholder="Full Name"
                  maxLength={STAKEHOLDER_NAME_MAX}
                  disabled={disabled}
                  aria-label={`Stakeholder ${index + 1} name`}
                  onChange={(event) => {
                    if (disabled) {
                      return;
                    }
                    onChange({
                      clientStakeholders: form.clientStakeholders.map(
                        (row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, name: event.target.value }
                            : row,
                      ),
                    });
                  }}
                />
              </label>
              <label className={projectsUi.stakeholderField}>
                <span>Title</span>
                <input
                  className={projectsUi.stakeholderInput}
                  value={stakeholder.title}
                  placeholder="(e.g., Director of Eng)"
                  maxLength={STAKEHOLDER_TITLE_MAX}
                  disabled={disabled}
                  aria-label={`Stakeholder ${index + 1} title`}
                  onChange={(event) => {
                    if (disabled) {
                      return;
                    }
                    onChange({
                      clientStakeholders: form.clientStakeholders.map(
                        (row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, title: event.target.value }
                            : row,
                      ),
                    });
                  }}
                />
              </label>
              <label className={projectsUi.stakeholderField}>
                <span>Department</span>
                <input
                  className={projectsUi.stakeholderInput}
                  value={stakeholder.department}
                  placeholder="Optional"
                  maxLength={STAKEHOLDER_DEPARTMENT_MAX}
                  disabled={disabled}
                  aria-label={`Stakeholder ${index + 1} department`}
                  onChange={(event) => {
                    if (disabled) {
                      return;
                    }
                    onChange({
                      clientStakeholders: form.clientStakeholders.map(
                        (row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, department: event.target.value }
                            : row,
                      ),
                    });
                  }}
                />
              </label>
              <label className={projectsUi.stakeholderField}>
                <span>Email</span>
                <input
                  className={projectsUi.stakeholderInput}
                  type="email"
                  value={stakeholder.email}
                  placeholder="name@company.com"
                  maxLength={STAKEHOLDER_EMAIL_MAX}
                  disabled={disabled}
                  aria-label={`Stakeholder ${index + 1} email`}
                  pattern="^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.(com|edu)$"
                  title="Enter an email ending in .com or .edu"
                  onChange={(event) => {
                    if (disabled) {
                      return;
                    }
                    onChange({
                      clientStakeholders: form.clientStakeholders.map(
                        (row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, email: event.target.value }
                            : row,
                      ),
                    });
                  }}
                />
              </label>
              <EmployeesPhoneInput
                label="Phone Number"
                appearance="form"
                value={stakeholder.phoneNumber}
                disabled={disabled}
                ariaLabel={`Stakeholder ${index + 1} phone`}
                onChange={(phone) =>
                  onChange({
                    clientStakeholders: form.clientStakeholders.map(
                      (row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, phoneNumber: phone }
                          : row,
                    ),
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
      ) : null}
    </div>
  );
}
