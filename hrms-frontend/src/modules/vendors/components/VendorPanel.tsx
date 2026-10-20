import { useId, useState, type FormEvent, type ReactNode } from "react";

import { AppBackLink, AppCheckbox } from "@/shared/ui";
import { AddressCascadeFields } from "@/modules/org/AddressCascadeFields";
import {
  ACCOUNT_TYPES,
  CHECKS_ADDRESS_TYPE_LABELS,
  CHECKS_ADDRESS_TYPES,
  EXTRA_CONTACT_TYPE_LABELS,
  EXTRA_CONTACT_TYPES,
  emptyAddress,
  emptyPayment,
  NET_PAY_TERMS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPES,
  VENDOR_TYPE_SUGGESTIONS,
} from "../constants";
import { validateVendorDraft } from "../selectors";
import type {
  AccountType,
  AddressFields,
  ChecksAddressType,
  ExtraContact,
  ExtraContactType,
  NetPayTerm,
  PaymentType,
  VendorDraft,
  VendorPayment,
  VendorRecord,
  VendorsModuleData,
} from "../types";
import { EmployeesPhoneInput } from "@/modules/employees/components/EmployeesPhoneInput";
import { ui } from "../uiClasses";

type PanelMode = "create" | "edit" | "view";

function renderVendorLabel(text: string, required: boolean): ReactNode {
  return (
    <span className={ui.fieldLabel}>
      {required ? `${text} *` : text}
    </span>
  );
}

interface VendorPanelProps {
  readonly mode: PanelMode;
  readonly vendor?: VendorRecord | null;
  readonly data: VendorsModuleData;
  readonly onClose: () => void;
  readonly onSave: (draft: VendorDraft) => void;
}

interface FormState {
  name: string;
  type: string;
  contactName: string;
  designation: string;
  ein: string;
  netPayTerm: NetPayTerm | "";
  corporateAddress: AddressFields;
  billingAddress: AddressFields;
  billingIsCorporate: boolean;
  payment: VendorPayment;
  extraContacts: ExtraContact[];
}

function createEmptyContact(): ExtraContact {
  return {
    id: `vc-new-${Math.random().toString(36).slice(2, 7)}`,
    contactType: "",
    name: "",
    designation: "",
    email: "",
    phone: "",
  };
}

function buildInitialForm(vendor?: VendorRecord | null): FormState {
  if (vendor) {
    return {
      name: vendor.name,
      type: vendor.type,
      contactName: vendor.contactName,
      designation: vendor.designation,
      ein: vendor.ein,
      netPayTerm: vendor.netPayTerm,
      corporateAddress: { ...vendor.corporateAddress },
      billingAddress: { ...vendor.billingAddress },
      billingIsCorporate: vendor.billingIsCorporate,
      payment: {
        paymentType: vendor.payment.paymentType,
        ach: { ...vendor.payment.ach },
        checksAddressType: vendor.payment.checksAddressType,
      },
      extraContacts:
        vendor.extraContacts.length > 0
          ? vendor.extraContacts.map((contact) => ({ ...contact }))
          : [createEmptyContact()],
    };
  }
  return {
    name: "",
    type: "",
    contactName: "",
    designation: "",
    ein: "",
    netPayTerm: "",
    corporateAddress: emptyAddress(),
    billingAddress: emptyAddress(),
    billingIsCorporate: true,
    payment: emptyPayment(),
    extraContacts: [createEmptyContact()],
  };
}

export function VendorPanel({
  mode,
  vendor,
  data,
  onClose,
  onSave,
}: VendorPanelProps) {
  const titleId = useId();
  const typeListId = useId();
  const readOnly = mode === "view";
  const [form, setForm] = useState<FormState>(() => buildInitialForm(vendor));
  const [error, setError] = useState<string | null>(null);

  function patchForm(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function patchCorpAddress(partial: Partial<AddressFields>) {
    setForm((current) => ({
      ...current,
      corporateAddress: { ...current.corporateAddress, ...partial },
    }));
  }

  function patchBillAddress(partial: Partial<AddressFields>) {
    setForm((current) => ({
      ...current,
      billingAddress: { ...current.billingAddress, ...partial },
    }));
  }

  function patchPayment(partial: Partial<VendorPayment>) {
    setForm((current) => ({
      ...current,
      payment: { ...current.payment, ...partial },
    }));
  }

  function patchContact(index: number, partial: Partial<ExtraContact>) {
    setForm((current) => ({
      ...current,
      extraContacts: current.extraContacts.map((contact, i) =>
        i === index ? { ...contact, ...partial } : contact,
      ),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;

    const draft: VendorDraft = {
      name: form.name.trim(),
      type: form.type.trim(),
      contactName: form.contactName.trim(),
      designation: form.designation.trim(),
      ein: form.ein.trim(),
      netPayTerm: form.netPayTerm,
      corporateAddress: form.corporateAddress,
      billingAddress: form.billingIsCorporate
        ? form.corporateAddress
        : form.billingAddress,
      billingIsCorporate: form.billingIsCorporate,
      payment: form.payment,
      extraContacts: form.extraContacts,
    };

    const excludeId = mode === "edit" ? vendor?.id : undefined;
    const errors = validateVendorDraft(draft, data.vendors, excludeId);
    if (errors.length > 0) {
      setError(errors[0]!.message);
      return;
    }

    setError(null);
    onSave(draft);
  }

  const title =
    mode === "create"
      ? "New vendor"
      : mode === "edit"
        ? `Edit — ${vendor?.name ?? ""}`
        : `View — ${vendor?.name ?? ""}`;

  return (
    <div
      className={ui.formPage}
      role="region"
      aria-labelledby={titleId}
    >
      <div className={ui.formPageHeader}>
        <AppBackLink onClick={onClose}>Vendors</AppBackLink>
        <h2 id={titleId} className={ui.formPageTitle}>{title}</h2>
      </div>

      <form
        className={ui.formPageCard}
        onSubmit={handleSubmit}
        noValidate
      >
          {error ? (
            <p className={ui.error} role="alert">
              {error}
            </p>
          ) : null}

          <fieldset className={ui.formSection}>
            <legend className={ui.formLegend}>Name and contact</legend>

            <label className={ui.field}>
              <span className={ui.fieldLabel}>Vendor name *</span>
              <input
                required
                value={form.name}
                disabled={readOnly}
                onChange={(e) => patchForm({ name: e.target.value })}
              />
            </label>

            <label className={ui.field}>
              <span className={ui.fieldLabel}>Vendor type</span>
              <input
                list={typeListId}
                value={form.type}
                disabled={readOnly}
                onChange={(e) => patchForm({ type: e.target.value })}
              />
              <datalist id={typeListId}>
                {VENDOR_TYPE_SUGGESTIONS.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </label>

            <label className={ui.field}>
              <span className={ui.fieldLabel}>Contact name *</span>
              <input
                required
                value={form.contactName}
                disabled={readOnly}
                onChange={(e) => patchForm({ contactName: e.target.value })}
              />
            </label>

            <label className={ui.field}>
              <span className={ui.fieldLabel}>Designation</span>
              <input
                value={form.designation}
                disabled={readOnly}
                onChange={(e) => patchForm({ designation: e.target.value })}
              />
            </label>

            <label className={ui.field}>
              <span className={ui.fieldLabel}>EIN *</span>
              <span className={ui.fieldHint}>
                Format: ##-####### (e.g. 12-3456789)
              </span>
              <input
                required
                value={form.ein}
                disabled={readOnly}
                placeholder="##-#######"
                onChange={(e) => patchForm({ ein: e.target.value })}
              />
            </label>

            <label className={ui.field}>
              <span className={ui.fieldLabel}>
                Net pay term *
              </span>
              <select
                required
                value={form.netPayTerm}
                disabled={readOnly}
                onChange={(e) =>
                  patchForm({
                    netPayTerm: e.target.value as NetPayTerm | "",
                  })
                }
              >
                <option value="">Select term</option>
                {NET_PAY_TERMS.map((term) => (
                  <option key={term} value={term}>
                    {term} days
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className={ui.formSection}>
            <legend className={ui.formLegend}>Corporate address</legend>

            <AddressCascadeFields
              value={form.corporateAddress}
              disabled={readOnly}
              fieldClassName={ui.field}
              onChange={patchCorpAddress}
              renderLabel={renderVendorLabel}
            />
          </fieldset>

          <fieldset className={ui.formSection}>
            <legend className={ui.formLegend}>Billing address</legend>

            <AppCheckbox
              className={ui.checkboxField}
              checked={form.billingIsCorporate}
              disabled={readOnly}
              label="Same as corporate"
              onChange={(billingIsCorporate) =>
                patchForm({ billingIsCorporate })
              }
            />

            {!form.billingIsCorporate ? (
              <AddressCascadeFields
                value={form.billingAddress}
                disabled={readOnly}
                fieldClassName={ui.field}
                onChange={patchBillAddress}
                renderLabel={renderVendorLabel}
              />
            ) : null}
          </fieldset>

          <fieldset className={ui.formSection}>
            <legend className={ui.formLegend}>Payment</legend>

            <label className={ui.field}>
              <span className={ui.fieldLabel}>Payment type</span>
              <select
                value={form.payment.paymentType}
                disabled={readOnly}
                onChange={(e) =>
                  patchPayment({
                    paymentType: e.target.value as PaymentType | "",
                  })
                }
              >
                <option value="">Select type</option>
                {PAYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PAYMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            {form.payment.paymentType === "ach" ? (
              <>
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>
                    Account number
                  </span>
                  <input
                    value={form.payment.ach.accountNumber}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchPayment({
                        ach: {
                          ...form.payment.ach,
                          accountNumber: e.target.value,
                        },
                      })
                    }
                  />
                </label>

                <label className={ui.field}>
                  <span className={ui.fieldLabel}>
                    Routing number
                  </span>
                  <input
                    value={form.payment.ach.routingNumber}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchPayment({
                        ach: {
                          ...form.payment.ach,
                          routingNumber: e.target.value,
                        },
                      })
                    }
                  />
                </label>

                <label className={ui.field}>
                  <span className={ui.fieldLabel}>Bank name</span>
                  <input
                    value={form.payment.ach.bankName}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchPayment({
                        ach: {
                          ...form.payment.ach,
                          bankName: e.target.value,
                        },
                      })
                    }
                  />
                </label>

                <label className={ui.field}>
                  <span className={ui.fieldLabel}>
                    Account type
                  </span>
                  <select
                    value={form.payment.ach.accountType}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchPayment({
                        ach: {
                          ...form.payment.ach,
                          accountType: e.target.value as AccountType | "",
                        },
                      })
                    }
                  >
                    <option value="">Select account type</option>
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            {form.payment.paymentType === "Checks" ? (
              <label className={ui.field}>
                <span className={ui.fieldLabel}>
                  Mail checks to
                </span>
                <select
                  value={form.payment.checksAddressType}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchPayment({
                      checksAddressType: e.target.value as
                        | ChecksAddressType
                        | "",
                    })
                  }
                >
                  <option value="">Select address</option>
                  {CHECKS_ADDRESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CHECKS_ADDRESS_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>

          <fieldset className={ui.formSection}>
            <legend className={ui.formLegend}>Additional contacts</legend>
            {form.extraContacts.map((contact, index) => (
              <div key={contact.id} className={ui.contactRow}>
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>
                    Contact type
                  </span>
                  <select
                    value={contact.contactType}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchContact(index, {
                        contactType: e.target.value as ExtraContactType | "",
                      })
                    }
                  >
                    <option value="">Select type</option>
                    {EXTRA_CONTACT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {EXTRA_CONTACT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>Name</span>
                  <input
                    value={contact.name}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchContact(index, { name: e.target.value })
                    }
                  />
                </label>
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>
                    Designation
                  </span>
                  <input
                    value={contact.designation}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchContact(index, { designation: e.target.value })
                    }
                  />
                </label>
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>Email</span>
                  <input
                    type="email"
                    value={contact.email}
                    disabled={readOnly}
                    onChange={(e) =>
                      patchContact(index, { email: e.target.value })
                    }
                  />
                </label>
                <EmployeesPhoneInput
                  label="Phone"
                  value={contact.phone}
                  disabled={readOnly}
                  ariaLabel={`Contact ${index + 1} phone`}
                  onChange={(phone) => patchContact(index, { phone })}
                />
                {!readOnly && form.extraContacts.length > 1 ? (
                  <button
                    type="button"
                    className={ui.btnGhostCompact}
                    onClick={() =>
                      patchForm({
                        extraContacts: form.extraContacts.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    Remove contact
                  </button>
                ) : null}
              </div>
            ))}
            {!readOnly ? (
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() =>
                  patchForm({
                    extraContacts: [...form.extraContacts, createEmptyContact()],
                  })
                }
              >
                Add contact
              </button>
            ) : null}
          </fieldset>

          <div className={ui.formActions}>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={onClose}
            >
              {readOnly ? "Back" : "Cancel"}
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
    </div>
  );
}
