import rawConfig from "./fieldPermissionsConfig.json";

export type FieldPermissionRole = "SELF" | "HR" | "ADMIN";

export type FieldMasking = "none" | "last4";

export interface FieldPermissionRule {
  readonly whoWrites: readonly FieldPermissionRole[];
  readonly whoEditsLater: readonly FieldPermissionRole[];
  readonly whoViews: readonly FieldPermissionRole[];
  readonly masking: FieldMasking;
  readonly correctionRequest?: boolean;
  readonly fullViewRoles?: readonly FieldPermissionRole[];
}

interface FieldPermissionsFile {
  readonly roleAliases: Readonly<Record<string, string>>;
  readonly fields: Readonly<Record<string, FieldPermissionRule>>;
}

const CONFIG = rawConfig as FieldPermissionsFile;

/**
 * Effective principals for a request: staff may also act as SELF on own record.
 */
export function permissionPrincipals(
  appRole: string | null | undefined,
  isSelf: boolean,
): readonly FieldPermissionRole[] {
  const raw = (appRole ?? "").trim().toUpperCase();
  const out: FieldPermissionRole[] = [];
  if (raw && raw !== "EMPLOYEE") {
    const aliased = CONFIG.roleAliases[raw] ?? raw;
    if (aliased === "HR" || aliased === "ADMIN") {
      out.push(aliased);
    }
  }
  if (isSelf) {
    out.push("SELF");
  }
  return out;
}

export function getFieldRule(field: string): FieldPermissionRule | null {
  return CONFIG.fields[field] ?? null;
}

function principalsIntersect(
  allowed: readonly FieldPermissionRole[],
  principals: readonly FieldPermissionRole[],
): boolean {
  return principals.some((p) => allowed.includes(p));
}

export function canWrite(
  field: string,
  appRole: string | null | undefined,
  alreadySaved: boolean,
  isSelf: boolean,
): boolean {
  const rule = getFieldRule(field);
  if (!rule) {
    return false;
  }
  const principals = permissionPrincipals(appRole, isSelf);
  const allowed = alreadySaved ? rule.whoEditsLater : rule.whoWrites;
  return principalsIntersect(allowed, principals);
}

export function canView(
  field: string,
  appRole: string | null | undefined,
  isSelf: boolean,
): boolean {
  const rule = getFieldRule(field);
  if (!rule) {
    return true;
  }
  const principals = permissionPrincipals(appRole, isSelf);
  return principalsIntersect(rule.whoViews, principals);
}

export function canViewFullNationalId(
  appRole: string | null | undefined,
  isSelf = false,
): boolean {
  const rule = getFieldRule("nationalIdNumber");
  const fullRoles = rule?.fullViewRoles ?? ["ADMIN"];
  const principals = permissionPrincipals(appRole, isSelf);
  return principalsIntersect(fullRoles, principals);
}

export function fieldMasking(field: string): FieldMasking {
  return getFieldRule(field)?.masking ?? "none";
}

/** Mask a national ID / passport to last 4 alphanumeric characters for display. */
export function maskLast4(value: string | null | undefined): string {
  const chars = String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-4);
  if (!chars) {
    return "";
  }
  return `••••${chars}`;
}

export function allowsCorrectionRequest(field: string): boolean {
  return Boolean(getFieldRule(field)?.correctionRequest);
}

export const CORRECTION_REQUEST_FIELDS = Object.entries(CONFIG.fields)
  .filter(([, rule]) => rule.correctionRequest)
  .map(([name]) => name);

/** Fields employees complete during self-onboarding (Flow 2). */
export const SELF_ONBOARDING_FIELDS = [
  "gender",
  "ethnicity",
  "maritalStatus",
  "personalEmail",
  "phone",
  "phoneNumber",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
  "country",
  "emergencyName",
  "emergencyPhone",
  "emergencyRelation",
  "emergencyEmail",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "emergencyContactEmail",
  "emergencyEmployeeId",
] as const;

/** Fields employees own when not listed explicitly in fieldPermissionsConfig. */
const EMPLOYEE_OWNED_FIELD_FALLBACK = new Set<string>([
  ...SELF_ONBOARDING_FIELDS,
  "alternatePhone",
  "alternateEmergencyName",
  "alternateEmergencyPhone",
  "alternateEmergencyRelation",
  "alternateEmergencyEmail",
]);

/** True when the employee completes this field during onboarding (SELF in whoWrites). */
export function isEmployeeOwnedField(field: string): boolean {
  const rule = getFieldRule(field);
  if (!rule) {
    return EMPLOYEE_OWNED_FIELD_FALLBACK.has(field);
  }
  return rule.whoWrites.includes("SELF");
}

export interface ProfileFieldEditState {
  readonly editable: boolean;
  /** Section is in view mode — render static read-only copy. */
  readonly viewMode: boolean;
  /** Section is editing but this principal cannot change the field — grey input. */
  readonly ownershipLocked: boolean;
}

export function resolveProfileFieldEditState(
  field: string,
  options: {
    readonly sectionReadOnly: boolean;
    readonly selfRestricted: boolean;
  },
): ProfileFieldEditState {
  if (options.sectionReadOnly) {
    return {
      editable: false,
      viewMode: true,
      ownershipLocked: false,
    };
  }
  const employeeOwned = isEmployeeOwnedField(field);
  if (options.selfRestricted) {
    return {
      editable: employeeOwned,
      viewMode: false,
      ownershipLocked: !employeeOwned,
    };
  }
  return {
    editable: !employeeOwned,
    viewMode: false,
    ownershipLocked: employeeOwned,
  };
}
