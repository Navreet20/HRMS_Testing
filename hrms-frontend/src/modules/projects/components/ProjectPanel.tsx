import { useId, useState, type FormEvent } from "react";

import { AppBackLink, AppDateField, ProfileViewField } from "@/shared/ui";
import {
  INVOICE_PERIOD_LABELS,
  INVOICE_PERIODS,
  isProtectedProjectName,
  PROJECT_REGIONS,
} from "../constants";
import { validateProjectDraft, selectProjectClientPickerGroups, projectClientOptionLabel } from "../selectors";
import type {
  ClientOption,
  InvoicePeriod,
  ProjectDraft,
  ProjectRecord,
  ProjectsModuleData,
  VendorOption,
  WorkContact,
} from "../types";
import { EmployeesPhoneInput } from "@/modules/employees/components/EmployeesPhoneInput";
import { projectsUi as ui } from "../uiClasses";

type PanelMode = "create" | "edit" | "view";

interface ProjectPanelProps {
  readonly mode: PanelMode;
  readonly project?: ProjectRecord | null;
  readonly data: ProjectsModuleData;
  readonly onClose: () => void;
  readonly onSave: (draft: ProjectDraft) => void;
  readonly onAddClient: (client: ClientOption) => void;
  readonly onAddVendor: (vendor: VendorOption) => void;
}

interface FormState {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  endClient: string;
  invoicePeriod: InvoicePeriod | "";
  region: string;
  description: string;
  workContact: WorkContact;
  newClientName: string;
  newVendorName: string;
}

function buildInitialForm(project?: ProjectRecord | null): FormState {
  if (project) {
    return {
      name: project.name,
      code: project.code,
      startDate: project.startDate,
      endDate: project.endDate,
      clientId: project.clientId ?? "",
      clientName: project.clientName ?? "",
      vendorId: project.vendorId ?? "",
      vendorName: project.vendorName ?? "",
      endClient: project.endClient,
      invoicePeriod: project.invoicePeriod ?? "",
      region: project.region ?? "",
      description: project.description ?? "",
      workContact: { ...project.workContact },
      newClientName: "",
      newVendorName: "",
    };
  }
  return {
    name: "",
    code: "",
    startDate: "",
    endDate: "",
    clientId: "",
    clientName: "",
    vendorId: "",
    vendorName: "",
    endClient: "",
    invoicePeriod: "",
    region: "",
    description: "",
    workContact: { firstName: "", lastName: "", mobile: "", email: "" },
    newClientName: "",
    newVendorName: "",
  };
}

export function ProjectPanel({
  mode,
  project,
  data,
  onClose,
  onSave,
  onAddClient,
  onAddVendor,
}: ProjectPanelProps) {
  const titleId = useId();
  const readOnly = mode === "view";
  const [form, setForm] = useState<FormState>(() => buildInitialForm(project));
  const [error, setError] = useState<string | null>(null);

  const isDepartment = isProtectedProjectName(form.name);
  const selectedClient = data.clients.find((c) => c.id === form.clientId);
  const isInternalClient = Boolean(selectedClient?.isInternal);
  const clientGroups = selectProjectClientPickerGroups(
    data.clients,
    form.clientId,
  );

  function patchForm(partial: Partial<FormState>) {
    setForm((c) => ({ ...c, ...partial }));
  }

  function patchContact(partial: Partial<WorkContact>) {
    setForm((c) => ({
      ...c,
      workContact: { ...c.workContact, ...partial },
    }));
  }

  function handleClientSelect(value: string) {
    if (value === "__add__") {
      return;
    }
    const client = data.clients.find((c) => c.id === value);
    patchForm({
      clientId: client?.id ?? "",
      clientName: client?.name ?? "",
    });
  }

  function handleAddClient() {
    const name = form.newClientName.trim();
    if (!name) return;
    const id = `cust-${Date.now().toString(36)}`;
    onAddClient({ id, name });
    patchForm({ clientId: id, clientName: name, newClientName: "" });
  }

  function handleVendorSelect(value: string) {
    if (value === "__add__") {
      return;
    }
    const vendor = data.vendors.find((v) => v.id === value);
    patchForm({
      vendorId: vendor?.id ?? "",
      vendorName: vendor?.name ?? "",
    });
  }

  function handleAddVendor() {
    const name = form.newVendorName.trim();
    if (!name) return;
    const id = `vendor-${Date.now().toString(36)}`;
    onAddVendor({ id, name });
    patchForm({ vendorId: id, vendorName: name, newVendorName: "" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;

    const kind = isDepartment ? "DEPARTMENT" : "COMMERCIAL";
    const draft: ProjectDraft = {
      name: form.name.trim(),
      code: form.code.trim(),
      kind,
      startDate: form.startDate,
      endDate: form.endDate,
      actualEndDate: project?.actualEndDate ?? "",
      clientId: form.clientId || null,
      clientName: form.clientName || null,
      vendorId: form.vendorId || null,
      vendorName: form.vendorName || null,
      endClient: form.endClient,
      invoicePeriod: (form.invoicePeriod as InvoicePeriod) || null,
      projectType: project?.projectType ?? "",
      region: isDepartment || isInternalClient ? "" : form.region,
      billingType: project?.billingType ?? (kind === "DEPARTMENT" ? "" : "Per HR"),
      status: project?.status ?? "ACTIVE",
      description: form.description,
      projectManagerIds: project?.projectManagers.map((m) => m.employeeId) ?? [],
      accountOwnerIds: project?.accountOwners.map((m) => m.employeeId) ?? [],
      clientStakeholders: project?.clientStakeholders ?? [],
      workContact: form.workContact,
    };

    const excludeId = mode === "edit" ? project?.id : undefined;
    const errors = validateProjectDraft(draft, data.projects, excludeId, {
      clients: data.clients,
    });
    if (errors.length > 0) {
      setError(errors[0]!.message);
      return;
    }

    setError(null);
    onSave(draft);
  }

  const title =
    mode === "create"
      ? "New project"
      : mode === "edit"
        ? `Edit — ${project?.name ?? ""}`
        : `View — ${project?.name ?? ""}`;

  return (
    <section
      className={ui.formPage}
      role="region"
      aria-labelledby={titleId}
    >
      <header className={ui.formPageHeader}>
        <AppBackLink onClick={onClose}>Projects</AppBackLink>
        <div>
          <p className={ui.eyebrow}>Project · {mode}</p>
          <h2 id={titleId} className={ui.formPageTitle}>{title}</h2>
        </div>
      </header>

        {isDepartment && mode !== "view" ? (
          <div className={ui.deptNotice}>
            <p>
              This name is a protected department container. Commercial fields
              (client, invoice period) are not required.
            </p>
          </div>
        ) : null}

        <form
          className={ui.formCard}
          onSubmit={handleSubmit}
          noValidate
        >
          {error ? (
            <p className={ui.error} role="alert">
              {error}
            </p>
          ) : null}

          {readOnly ? (
            <>
              <ProfileViewField label="Project name" value={form.name} />
              <ProfileViewField
                label="Project description"
                value={form.description}
                className="[grid-column:1/-1]"
              />
              <ProfileViewField label="Start date" value={form.startDate} />
              <ProfileViewField label="End date" value={form.endDate} />
              {!isDepartment ? (
                <>
                  <ProfileViewField
                    label="Client"
                    value={form.clientName || form.clientId}
                  />
                  {!isInternalClient ? (
                    <ProfileViewField label="Region" value={form.region} />
                  ) : null}
                  <ProfileViewField
                    label="Invoice period"
                    value={
                      form.invoicePeriod
                        ? INVOICE_PERIOD_LABELS[form.invoicePeriod]
                        : ""
                    }
                  />
                </>
              ) : null}
              <ProfileViewField
                label="Vendor"
                value={form.vendorName || form.vendorId}
              />
              <ProfileViewField label="End client" value={form.endClient} />
              <ProfileViewField
                label="Work contact first name"
                value={form.workContact.firstName}
              />
              <ProfileViewField
                label="Work contact last name"
                value={form.workContact.lastName}
              />
              <ProfileViewField
                label="Mobile"
                value={form.workContact.mobile}
              />
              <ProfileViewField
                label="Email"
                value={form.workContact.email}
              />
            </>
          ) : (
            <>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Project name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => {
                patchForm({ name: e.target.value });
              }}
            />
          </label>

          <label className={ui.fieldWide}>
            <span className={ui.fieldLabel}>
              Project description
            </span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => {
                patchForm({ description: e.target.value });
              }}
            />
          </label>

          <div className={ui.field}>
            <span className={ui.fieldLabel}>Start date *</span>
            <AppDateField
              value={form.startDate}
disabled={readOnly}
              aria-label="Start date"
              onChange={(startDate) => patchForm({ startDate })}
            />
          </div>

          <div className={ui.field}>
            <span className={ui.fieldLabel}>End date *</span>
            <AppDateField
              value={form.endDate}
disabled={readOnly}
              aria-label="End date"
              onChange={(endDate) => patchForm({ endDate })}
            />
          </div>

          {!isDepartment ? (
            <>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Client *</span>
                <select
                  value={form.clientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                >
                  <option value="">Select client</option>
                  {clientGroups.external.length > 0 ? (
                    <optgroup label="External clients">
                      {clientGroups.external.map((client) => (
                        <option key={client.id} value={client.id}>
                          {projectClientOptionLabel(client)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {clientGroups.internal.length > 0 ? (
                    <optgroup label="Internal destinations">
                      {clientGroups.internal.map((client) => (
                        <option key={client.id} value={client.id}>
                          {projectClientOptionLabel(client)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>

              {!isInternalClient ? (
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>Region</span>
                  <select
                    value={form.region}
                    aria-label="Region"
                    onChange={(e) => patchForm({ region: e.target.value })}
                  >
                    <option value="">Select region</option>
                    {PROJECT_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className={ui.field}>
                <span className={ui.fieldLabel}>
                  Or add new client
                </span>
                <div className="flex gap-[0.35rem]">
                  <input
                    value={form.newClientName}
                    placeholder="New client name"
                    onChange={(e) =>
                      patchForm({ newClientName: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className={ui.btnGhostCompact}
                    disabled={!form.newClientName.trim()}
                    onClick={handleAddClient}
                  >
                    Add
                  </button>
                </div>
              </div>

              <label className={ui.field}>
                <span className={ui.fieldLabel}>
                  Invoice period *
                </span>
                <select
                  value={form.invoicePeriod}
                  onChange={(e) =>
                    patchForm({
                      invoicePeriod: e.target.value as InvoicePeriod | "",
                    })
                  }
                >
                  <option value="">Select period</option>
                  {INVOICE_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {INVOICE_PERIOD_LABELS[period]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Vendor</span>
            <select
              value={form.vendorId}
              onChange={(e) => handleVendorSelect(e.target.value)}
            >
              <option value="">None</option>
              {data.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <div className={ui.field}>
            <span className={ui.fieldLabel}>
              Or add new vendor
            </span>
            <div className="flex gap-[0.35rem]">
              <input
                value={form.newVendorName}
                placeholder="New vendor name"
                onChange={(e) =>
                  patchForm({ newVendorName: e.target.value })
                }
              />
              <button
                type="button"
                className={ui.btnGhostCompact}
                disabled={!form.newVendorName.trim()}
                onClick={handleAddVendor}
              >
                Add
              </button>
            </div>
          </div>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>End client</span>
            <input
              value={form.endClient}
              onChange={(e) => patchForm({ endClient: e.target.value })}
            />
          </label>

          <fieldset className="m-0 rounded-[0.5rem] border border-app-border px-[0.75rem] py-[0.65rem]">
            <legend className="px-[0.25rem] py-0 text-[0.8rem] text-app-muted">
              Work contact
            </legend>
            <div className="grid gap-[0.55rem]">
              <label className={ui.field}>
                <span className={ui.fieldLabel}>First name</span>
                <input
                  value={form.workContact.firstName}
                  onChange={(e) =>
                    patchContact({ firstName: e.target.value })
                  }
                />
              </label>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Last name</span>
                <input
                  value={form.workContact.lastName}
                  onChange={(e) =>
                    patchContact({ lastName: e.target.value })
                  }
                />
              </label>
              <EmployeesPhoneInput
                label="Mobile"
                value={form.workContact.mobile}
                ariaLabel="Mobile"
                onChange={(mobile) => patchContact({ mobile })}
              />
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Email</span>
                <input
                  type="email"
                  value={form.workContact.email}
                  onChange={(e) =>
                    patchContact({ email: e.target.value })
                  }
                />
              </label>
            </div>
          </fieldset>
            </>
          )}

          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onClose}
            >
              {readOnly ? "Close" : "Cancel"}
            </button>
            {!readOnly ? (
              <button
                type="submit"
                className={ui.btnPrimary}
              >
                {mode === "create" ? "Create" : "Save"}
              </button>
            ) : null}
          </div>
        </form>
    </section>
  );
}
