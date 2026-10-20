import { useState, type FormEvent } from "react";

import {
  AppBackLink,
  AppDataTable,
  AppDateField,
  type AppDataTableColumn,
} from "@/shared/ui";
import {
  CHECKS_ADDRESS_TYPE_LABELS,
  EXTRA_CONTACT_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  VENDOR_STATUS_LABELS,
} from "../constants";
import { canEditVendor, validateMsaDates } from "../selectors";
import type {
  VendorActor,
  VendorEmployeeLink,
  VendorRecord,
} from "../types";
import { ui, vendorStatusClass } from "../uiClasses";

const EMPLOYEES_PAGE_SIZE = 10;

const EMPLOYEE_COLUMNS: AppDataTableColumn<VendorEmployeeLink>[] = [
  {
    id: "name",
    header: "Name",
    value: (link) => link.displayName,
    cellClassName: "font-semibold",
  },
  { id: "project", header: "Project", value: (link) => link.projectName },
  { id: "client", header: "Client Name", value: (link) => link.clientName },
];

interface VendorDetailsViewProps {
  readonly vendor: VendorRecord;
  readonly actor: VendorActor;
  readonly employees: readonly VendorEmployeeLink[];
  readonly onBack: () => void;
  readonly onSaveMsa: (msaStartDate: string, msaEndDate: string) => void;
}

export function VendorDetailsView({
  vendor,
  actor,
  employees,
  onBack,
  onSaveMsa,
}: VendorDetailsViewProps) {
  const canEdit = canEditVendor(actor);
  const [msaStartDate, setMsaStartDate] = useState(
    vendor.msaStartDate ?? "",
  );
  const [msaEndDate, setMsaEndDate] = useState(vendor.msaEndDate ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const errors = validateMsaDates(msaStartDate, msaEndDate);
    if (errors.length > 0) {
      setError(errors[0]!.message);
      return;
    }
    setError(null);
    onSaveMsa(msaStartDate, msaEndDate);
  }

  const formatAddress = (addr: typeof vendor.corporateAddress) =>
    [addr.line1, addr.line2, addr.city, addr.state, addr.zipCode, addr.country]
      .filter(Boolean)
      .join(", ");

  return (
    <div className={ui.details}>
      <div className={ui.detailsHeader}>
        <AppBackLink onClick={onBack}>Vendors</AppBackLink>
        <h2 className={ui.detailsTitle}>{vendor.name}</h2>
        <span
          className={vendorStatusClass(vendor.status)}
        >
          {VENDOR_STATUS_LABELS[vendor.status]}
        </span>
      </div>

      <div className={ui.detailsCard}>
        <p className={ui.detailsCardText}>
          <strong>Type:</strong> {vendor.type || "—"}
        </p>
        <p className={ui.detailsCardText}>
          <strong>Contact:</strong> {vendor.contactName}
          {vendor.designation ? ` · ${vendor.designation}` : ""}
        </p>
        <p className={ui.detailsCardText}>
          <strong>EIN:</strong> {vendor.ein}
        </p>
        <p className={ui.detailsCardText}>
          <strong>Net pay term:</strong> {vendor.netPayTerm} days
        </p>
        <p className={ui.detailsCardText}>
          <strong>Corporate address:</strong> {formatAddress(vendor.corporateAddress)}
        </p>
        <p className={ui.detailsCardText}>
          <strong>Billing address:</strong>{" "}
          {vendor.billingIsCorporate
            ? "Same as corporate"
            : formatAddress(vendor.billingAddress)}
        </p>
        <p className={ui.detailsCardText}>
          <strong>Payment method:</strong>{" "}
          {vendor.payment.paymentType
            ? PAYMENT_TYPE_LABELS[vendor.payment.paymentType]
            : "—"}
          {vendor.payment.paymentType === "ach" && vendor.payment.ach.bankName
            ? ` (${vendor.payment.ach.bankName})`
            : ""}
          {vendor.payment.paymentType === "Checks" &&
          vendor.payment.checksAddressType
            ? ` → ${CHECKS_ADDRESS_TYPE_LABELS[vendor.payment.checksAddressType]}`
            : ""}
        </p>
        {vendor.extraContacts.length > 0 ? (
          <div>
            <strong>Additional contacts</strong>
            <ul className={ui.detailsCardList}>
              {vendor.extraContacts.map((contact) => (
                <li key={contact.id}>
                  {contact.contactType
                    ? EXTRA_CONTACT_TYPE_LABELS[contact.contactType]
                    : "Contact"}
                  : {contact.name || "—"}
                  {contact.email ? ` · ${contact.email}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <form className={ui.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={ui.formSection}>
          <legend className={ui.formLegend}>MSA dates</legend>
          {error ? (
            <p className={ui.error} role="alert">
              {error}
            </p>
          ) : null}
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Start date *</span>
            <AppDateField
              value={msaStartDate}
              disabled={!canEdit}
              aria-label="MSA start date"
              onChange={setMsaStartDate}
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>End date *</span>
            <AppDateField
              value={msaEndDate}
              disabled={!canEdit}
              minDate={msaStartDate || undefined}
              aria-label="MSA end date"
              onChange={setMsaEndDate}
            />
          </label>
          {canEdit ? (
            <div className={ui.formActions}>
              <button
                type="submit"
                className={ui.btnPrimary}
              >
                Update MSA
              </button>
            </div>
          ) : null}
        </fieldset>
      </form>

      <div className={ui.detailsCard}>
        <h3 className={ui.detailsCardTitle}>Employees</h3>
        <AppDataTable
          data={employees}
          columns={EMPLOYEE_COLUMNS}
          getRowId={(link) => link.id}
          ariaLabel="Vendor employees"
          resizable
          sortBy={{ id: "name" }}
          pagination={{ pageSize: EMPLOYEES_PAGE_SIZE }}
          emptyState={
            <p className="m-0 text-[0.85rem] text-emp-muted">
              No employees linked to this vendor.
            </p>
          }
        />
      </div>
    </div>
  );
}
