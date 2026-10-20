import { HRMS_ROLE_LABELS } from "@/shared";
import { formatEmployeeName } from "../selectors";
import type { EmployeeRecord } from "../types";
import { ui } from "../uiClasses";

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "?";
}

function formatCreatedOn(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ViewField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className={ui.systemAccountField}>
      <span className={ui.systemAccountFieldLabel}>{label}</span>
      <p className={ui.systemAccountFieldValue}>{value}</p>
    </div>
  );
}

interface SystemAccountPanelProps {
  readonly employee: EmployeeRecord;
}

/**
 * Account card for bootstrap / system logins.
 * These rows are not employee hires — My Profile must not show the wizard.
 */
export function SystemAccountPanel({ employee }: SystemAccountPanelProps) {
  const displayName =
    formatEmployeeName(employee) || HRMS_ROLE_LABELS[employee.role];
  const roleLabel = HRMS_ROLE_LABELS[employee.role];
  const createdOn = formatCreatedOn(employee.createdDate);
  const accountCode = employee.employeeCode.trim();
  const workEmail = employee.workEmail.trim();
  const showAccountSection = Boolean(workEmail || accountCode);

  return (
    <section className={ui.systemAccount} aria-label="System account">
      <header className={ui.systemAccountHeader}>
        <div className={ui.systemAccountHeaderMain}>
          <span className={ui.systemAccountAvatar} aria-hidden="true">
            {initialsFor(displayName)}
          </span>
          <h2 className={ui.systemAccountName}>{displayName}</h2>
          <span className={ui.systemAccountBadge}>System account</span>
        </div>
      </header>

      <p className={ui.systemAccountCopy}>
        Not an employee profile. This login administers the HRMS — it is not
        a hire record, so personal, contact, and employment details do not
        apply.
      </p>

      <div className={ui.systemAccountBody}>
        {showAccountSection ? (
          <fieldset className={ui.systemAccountSection}>
            <legend>Account</legend>
            <div className={ui.systemAccountGrid}>
              {workEmail ? (
                <ViewField label="Email" value={workEmail} />
              ) : null}
              {accountCode ? (
                <ViewField label="Code" value={accountCode} />
              ) : null}
            </div>
          </fieldset>
        ) : null}

        <fieldset className={ui.systemAccountSection}>
          <legend>Permission</legend>
          <div className={ui.systemAccountGrid}>
            <div className={ui.systemAccountField}>
              <span className={ui.systemAccountFieldLabel}>Permission</span>
              <p className={ui.systemAccountFieldValue}>
                {roleLabel}
                <span className={ui.systemAccountRoleCode}>{employee.role}</span>
              </p>
            </div>
            {createdOn ? (
              <ViewField label="Created" value={createdOn} />
            ) : null}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
