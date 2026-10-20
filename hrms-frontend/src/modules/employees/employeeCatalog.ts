import {
  AsYouType,
  getCountryCallingCode,
  isPossiblePhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";

import {
  DEFAULT_PHONE_DIAL_CODE,
  isVendorRequired,
  PHONE_DIAL_CODES,
  SKILL_EXPERIENCE_RANGES,
} from "./constants";
import { syncAccessRoleFields } from "./selectors";
import type {
  CreateEmployeeInput,
  EmployeeAccessFlags,
  EmployeeRecord,
  EmploymentCategory,
  EmploymentType,
  JobRank,
  NationalIdDocumentTypeOption,
  SkillCatalogOption,
  EmployeeSkillEntry,
  ProfessionalProfile,
  SkillProficiency,
  WorkerType,
  WorkSchedule,
} from "./types";

/** Minimum hire age (employment eligibility). */
export const MIN_EMPLOYEE_AGE = 18;

/**
 * Maximum plausible employee age for data quality (typo guard).
 * Corporate HRMS (Workday, SAP SuccessFactors, BambooHR) use ~100-year windows;
 * retirement policy (often 65–67) is separate — employees may work past that.
 */
export const MAX_EMPLOYEE_AGE = 100;

/** @deprecated Use {@link minEmployeeDateOfBirth} for date inputs. */
export const DATE_OF_BIRTH_MIN = "1900-01-01";

function shiftCalendarYears(base: Date, years: number): Date {
  return new Date(base.getFullYear() + years, base.getMonth(), base.getDate());
}

/** Earliest allowed DOB (today minus {@link MAX_EMPLOYEE_AGE} years) — validation only. */
export function minEmployeeDateOfBirth(now = new Date()): string {
  return todayIsoDate(shiftCalendarYears(now, -MAX_EMPLOYEE_AGE));
}

/** Latest allowed DOB for an adult hire — validation only. */
export function maxAdultDateOfBirth(now = new Date()): string {
  return todayIsoDate(shiftCalendarYears(now, -MIN_EMPLOYEE_AGE));
}

const NAME_STEM_NON_LETTERS = /[^A-Z]+/g;

/** Draft employee_code stem from names (mirrors backend `name_based_code_stem`). */
export function nameBasedCodeStem(firstName: string, lastName: string): string {
  const first =
    (firstName || "").trim().toUpperCase().replace(NAME_STEM_NON_LETTERS, "").slice(0, 3) ||
    "XXX";
  const last =
    (lastName || "").trim().toUpperCase().replace(NAME_STEM_NON_LETTERS, "").slice(0, 3) ||
    "XXX";
  return `${first}_${last}`;
}

/**
 * Offline/mock unique name-based code. Live preview uses the API so collision
 * suffixes stay consistent with persisted rows.
 */
export function allocateNameBasedEmployeeCode(
  firstName: string,
  lastName: string,
  existingCodes: readonly (string | null | undefined)[],
): string {
  const stem = nameBasedCodeStem(firstName, lastName);
  const existing = new Set(
    existingCodes.filter((code): code is string => Boolean(code)),
  );
  if (!existing.has(stem)) {
    return stem;
  }
  let suffix = 2;
  while (existing.has(`${stem}-${suffix}`)) {
    suffix += 1;
  }
  return `${stem}-${suffix}`;
}

const PERSONAL_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Longest dial codes first so +353 matches before +35 / +3. */
const DIAL_CODES_BY_LENGTH = [...PHONE_DIAL_CODES].sort(
  (left, right) => right.length - left.length,
);

export interface SplitPhoneParts {
  readonly dialCode: string;
  readonly nationalNumber: string;
}

/**
 * Split a stored phone into dial code + national number for UI fields.
 * Prefers an existing E.164 prefix from {@link PHONE_DIAL_CODES}; otherwise
 * keeps digits in the national field with the default dial code.
 */
export function splitPhoneParts(
  value: string | null | undefined,
): SplitPhoneParts {
  const compact = (value ?? "").replace(/[\s\-().]/g, "").trim();
  if (!compact) {
    return { dialCode: DEFAULT_PHONE_DIAL_CODE, nationalNumber: "" };
  }
  const withPlus = compact.startsWith("+") ? compact : `+${compact}`;
  for (const dialCode of DIAL_CODES_BY_LENGTH) {
    if (withPlus.startsWith(dialCode)) {
      return {
        dialCode,
        nationalNumber: withPlus.slice(dialCode.length),
      };
    }
  }
  return {
    dialCode: DEFAULT_PHONE_DIAL_CODE,
    nationalNumber: withPlus.replace(/^\+/, ""),
  };
}

/**
 * Combine dial code + national number into a compact E.164-ish string
 * for PATCH (`phoneNumber` / `alternatePhoneNumber`). Empty national → "".
 */
export function combinePhoneParts(
  dialCode: string,
  nationalNumber: string,
): string {
  const digits = nationalNumber.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!digits) {
    return "";
  }
  const code = (dialCode.trim() || DEFAULT_PHONE_DIAL_CODE).replace(
    /[^\d+]/g,
    "",
  );
  const prefix = code.startsWith("+") ? code : `+${code}`;
  return `${prefix}${digits}`;
}

/** Fallback max national digits when country metadata is unavailable (NANP). */
export const MAX_CONTACT_PHONE_NATIONAL_DIGITS = 10;

const MAX_NATIONAL_DIGITS_BY_COUNTRY = new Map<string, number>();

function toCountryCode(iso2: string | null | undefined): CountryCode | null {
  const code = (iso2 ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return null;
  }
  return code as CountryCode;
}

/** Longest national length libphonenumber accepts for `iso2` (e.g. US 10, IN 13). */
export function maxNationalDigitsForCountry(
  iso2: string | null | undefined,
): number {
  const country = toCountryCode(iso2) ?? "US";
  const cached = MAX_NATIONAL_DIGITS_BY_COUNTRY.get(country);
  if (cached != null) {
    return cached;
  }
  let max = MAX_CONTACT_PHONE_NATIONAL_DIGITS;
  for (let length = 15; length >= 1; length -= 1) {
    const result = validatePhoneNumberLength("2".repeat(length), country);
    if (result === undefined || result === "TOO_SHORT") {
      max = length;
      break;
    }
  }
  MAX_NATIONAL_DIGITS_BY_COUNTRY.set(country, max);
  return max;
}

/** Strip formatting and cap national digits at the selected country's max length. */
export function sanitizeContactPhoneNationalInput(
  value: string,
  countryIso2?: string,
): string {
  return value
    .replace(/\D/g, "")
    .slice(0, maxNationalDigitsForCountry(countryIso2));
}

function storedFromNational(
  national: string,
  countryIso2: string | null | undefined,
): string {
  const country = toCountryCode(countryIso2) ?? "US";
  let calling = "1";
  try {
    calling = String(getCountryCallingCode(country));
  } catch {
    calling = "1";
  }
  return combinePhoneParts(`+${calling}`, national);
}

/**
 * Country-specific length/format check for a stored E.164 contact phone.
 * Incomplete numbers fail (too short / wrong length); empty is OK unless required.
 */
export function contactPhoneError(
  stored: string | null | undefined,
  options: {
    readonly required?: boolean;
    readonly country?: string;
  } = {},
): string | null {
  if (isPhonePlaceholder(stored)) {
    return options.required ? "Phone number is required." : null;
  }
  const compact = (stored ?? "").replace(/[\s\-().]/g, "").trim();
  if (!compact || compact === "+") {
    return options.required ? "Phone number is required." : null;
  }
  const e164 = compact.startsWith("+") ? compact : `+${compact}`;
  const country =
    toCountryCode(options.country) ??
    toCountryCode(defaultCountryFromStoredPhone(stored));
  if (!country) {
    return "Enter a valid phone number for the selected country.";
  }
  const lengthResult = validatePhoneNumberLength(e164, country);
  if (lengthResult === "TOO_SHORT") {
    return "Phone number is too short for the selected country.";
  }
  if (lengthResult === "TOO_LONG") {
    return "Phone number is too long for the selected country.";
  }
  if (lengthResult === "INVALID_LENGTH") {
    return "Phone number does not match the required length for the selected country.";
  }
  if (lengthResult === "NOT_A_NUMBER" || lengthResult === "INVALID_COUNTRY") {
    return "Enter a valid phone number for the selected country.";
  }
  if (!isPossiblePhoneNumber(e164, country)) {
    return "Enter a valid phone number for the selected country.";
  }
  return null;
}

export function contactPhoneNationalNumberError(
  value: string | null | undefined,
  options: { readonly required?: boolean; readonly country?: string } = {},
): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) {
    return options.required ? "Phone number is required." : null;
  }
  return contactPhoneError(storedFromNational(digits, options.country), {
    required: options.required,
    country: options.country,
  });
}

/** As-you-type national formatting for the selected ISO-3166 country (US, IN, GB, …). */
export function formatContactPhoneNational(
  nationalDigits: string,
  countryIso2: string,
): string {
  const country = toCountryCode(countryIso2);
  const digits = nationalDigits.replace(/\D/g, "");
  if (!country || !digits) {
    return digits;
  }
  return new AsYouType(country).input(digits);
}

/** Primary ISO-3166 alpha-2 country for each supported ITU dial code. */
const DIAL_CODE_TO_COUNTRY: Record<string, string> = {
  "1": "us",
  "7": "ru",
  "27": "za",
  "31": "nl",
  "33": "fr",
  "34": "es",
  "39": "it",
  "41": "ch",
  "44": "gb",
  "46": "se",
  "49": "de",
  "52": "mx",
  "55": "br",
  "60": "my",
  "61": "au",
  "62": "id",
  "63": "ph",
  "64": "nz",
  "65": "sg",
  "81": "jp",
  "82": "kr",
  "86": "cn",
  "91": "in",
  "92": "pk",
  "234": "ng",
  "254": "ke",
  "353": "ie",
  "880": "bd",
  "966": "sa",
  "971": "ae",
};

/** Default `react-phone-input-2` country from stored E.164. */
export function defaultCountryFromStoredPhone(
  stored: string | null | undefined,
): string {
  const { dialCode } = splitPhoneParts(stored);
  const dial = dialCode.replace("+", "");
  return DIAL_CODE_TO_COUNTRY[dial] ?? "us";
}

function dialCodeDigits(
  selectedDialCode: string | null | undefined,
  stored: string | null | undefined,
): string {
  const fromSelected = (selectedDialCode ?? "").replace(/\D/g, "");
  if (fromSelected) {
    return fromSelected;
  }
  return splitPhoneParts(stored).dialCode.replace(/\D/g, "") || "1";
}

/**
 * National digits for the widget, using the selected dial code when present.
 *
 * `splitPhoneParts` only knows {@link PHONE_DIAL_CODES}. For other countries
 * (e.g. Angola +244) it would treat the dial digits as national and
 * `toReactPhoneInputValue` would prepend the dial code again (`244` + `2449`).
 */
function nationalDigitsForReactPhoneInput(
  stored: string | null | undefined,
  dial: string,
): string {
  const compact = (stored ?? "").replace(/\D/g, "");
  if (!compact) {
    return "";
  }
  if (dial && compact.startsWith(dial)) {
    return compact.slice(dial.length);
  }
  return splitPhoneParts(stored).nationalNumber.replace(/\D/g, "");
}

/**
 * `react-phone-input-2` `value`: dial-code digits + national digits, no `+`.
 * Always includes the dial code (even when national is empty) so the library
 * does not treat the next keystroke as a new country prefix.
 */
export function toReactPhoneInputValue(
  stored: string | null | undefined,
  selectedDialCode?: string,
  countryIso2?: string,
): string {
  const dial = dialCodeDigits(selectedDialCode, stored);
  const nationalNumber = nationalDigitsForReactPhoneInput(stored, dial);
  const countryIso =
    toCountryCode(countryIso2)?.toLowerCase() ??
    DIAL_CODE_TO_COUNTRY[dial] ??
    defaultCountryFromStoredPhone(stored);
  const sanitized = sanitizeContactPhoneNationalInput(nationalNumber, countryIso);
  return `${dial}${sanitized}`;
}

/**
 * Library display value — same contract as {@link toReactPhoneInputValue}.
 * National-only strings must not be passed as `value` (typing `9` with US
 * selected would render as `+9` / Afghanistan).
 */
export function toReactPhoneInputDisplayValue(
  stored: string | null | undefined,
  selectedDialCode?: string,
  countryIso2?: string,
): string {
  return toReactPhoneInputValue(stored, selectedDialCode, countryIso2);
}

/** Map library onChange to stored E.164 (+…), capping national digits per country. */
export function fromReactPhoneInputChange(
  value: string,
  country: { readonly dialCode?: string; readonly countryCode?: string },
): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  const dialCode = (country.dialCode ?? "1").replace(/\D/g, "") || "1";
  const national = digits.startsWith(dialCode)
    ? digits.slice(dialCode.length)
    : digits;
  const countryIso =
    country.countryCode || DIAL_CODE_TO_COUNTRY[dialCode] || "us";
  const sanitized = sanitizeContactPhoneNationalInput(national, countryIso);
  if (!sanitized) {
    return "";
  }
  return combinePhoneParts(`+${dialCode}`, sanitized);
}

/** Human-readable phone for read-only profile fields (international grouping). */
export function formatStoredPhoneDisplay(
  stored: string | null | undefined,
): string {
  const text = (stored ?? "").trim();
  if (!text || isPhonePlaceholder(text)) {
    return "";
  }
  const compact = text.replace(/[\s\-().]/g, "");
  const e164 = compact.startsWith("+") ? compact : `+${compact}`;
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.isPossible()) {
    return parsed.formatInternational();
  }
  return compact.replace(/^\+/, "") ? e164 : text;
}

/** Local calendar date as YYYY-MM-DD (date-input `max` for joining dates, etc.). */
export function todayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Alias used by hire flows and profile date pickers. */
export const todayLocalIsoDate = todayIsoDate;

export function tomorrowIsoDate(now = new Date()): string {
  return todayIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  );
}

/** Empty expiry is allowed; a filled value must be after today (local calendar). */
export function isFutureCertificateExpiry(
  value: string | undefined | null,
  now = new Date(),
): boolean {
  const iso = value?.trim().slice(0, 10) ?? "";
  if (!iso) {
    return true;
  }
  return iso > todayIsoDate(now);
}

/**
 * True when `text` is a real YYYY-MM-DD calendar date.
 * Uses setFullYear so years 0–99 stay year 9 / 99, not 1909 / 1999.
 */
function isCalendarIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const parsed = new Date(0);
  parsed.setFullYear(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

const DOB_INVALID_MESSAGE = "Enter a valid date of birth";
const DOB_FUTURE_MESSAGE = "Date of birth cannot be in the future.";
const DOB_UNDERAGE_MESSAGE = `Date of birth must be at least ${MIN_EMPLOYEE_AGE} years ago.`;
const DOB_OVERAGE_MESSAGE = `Date of birth cannot be more than ${MAX_EMPLOYEE_AGE} years ago.`;

/**
 * Field error for a date of birth. Must be a real calendar date between
 * {@link MIN_EMPLOYEE_AGE} and {@link MAX_EMPLOYEE_AGE} years ago (inclusive).
 */
export function dateOfBirthError(
  value: string,
  today = todayIsoDate(),
): string | null {
  const text = value.trim();
  if (!isCalendarIsoDate(text)) {
    return DOB_INVALID_MESSAGE;
  }
  const reference = new Date(`${today}T12:00:00`);
  const minDob = minEmployeeDateOfBirth(reference);
  if (text < minDob) {
    return DOB_OVERAGE_MESSAGE;
  }
  if (text > today) {
    return DOB_FUTURE_MESSAGE;
  }
  const maxDob = maxAdultDateOfBirth(reference);
  if (text > maxDob) {
    return DOB_UNDERAGE_MESSAGE;
  }
  return null;
}

/**
 * Hire/create form DOB validation (supports optional empty when not required).
 * Matches backend `_validate_date_of_birth` in `profile_fields.py`.
 */
export function dateOfBirthFieldError(
  value: string,
  options?: { readonly required?: boolean },
): string | null {
  const text = value.trim();
  if (!text) {
    return options?.required === false ? null : "Date of birth is required.";
  }
  return dateOfBirthError(text);
}

/** True when DOB is a real calendar date within the hire age window. */
export function isValidDateOfBirth(
  value: string,
  today = todayIsoDate(),
): boolean {
  return dateOfBirthError(value, today) === null;
}

/**
 * Save Draft may omit DOB, but a filled DOB must pass the same checks as Continue.
 */
export function hireDraftSaveError(input: {
  readonly dateOfBirth: string;
  readonly personalEmail?: string;
  readonly workEmail?: string;
}): string | null {
  const dob = input.dateOfBirth.trim();
  if (dob) {
    const dobError = dateOfBirthError(dob);
    if (dobError) {
      return dobError;
    }
  }
  const personalError = personalEmailFieldError(input.personalEmail ?? "");
  if (personalError) {
    return personalError;
  }
  const work = input.workEmail?.trim() ?? "";
  if (work && !isValidPersonalEmail(work)) {
    return "Enter a valid official email address.";
  }
  return null;
}

/** Basic personal/emergency email check (any domain; not org-specific). */
export function isValidPersonalEmail(value: string): boolean {
  const text = value.trim();
  return text.length > 0 && text.length <= 254 && PERSONAL_EMAIL_RE.test(text);
}

/** Optional emergency email — empty is OK; filled values must include @ and .com. */
export function emergencyEmailFieldError(value: string): string | null {
  const text = value.trim();
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  if (!lower.includes("@") || !lower.includes(".com")) {
    return "Enter a valid email";
  }
  if (text.length > 254 || !PERSONAL_EMAIL_RE.test(text)) {
    return "Enter a valid email";
  }
  return null;
}

/** Optional personal email — empty is OK; filled values must look like name@domain.tld. */
export function personalEmailFieldError(value: string): string | null {
  const text = value.trim();
  if (!text) {
    return null;
  }
  if (!isValidPersonalEmail(text)) {
    return "Enter a valid personal email address.";
  }
  return null;
}

/** Emergency phone uses the same country length/format rules as contact phones. */
export function isValidEmergencyPhone(value: string): boolean {
  if (isPhonePlaceholder(value)) {
    return false;
  }
  return contactPhoneError(value) === null;
}

/** Employment types that do not start payroll (EMP-DATA-3 Unpaid Intern only). */
export const NON_PAYROLL_EMPLOYMENT_TYPES: ReadonlySet<EmploymentType> =
  new Set(["UNPAID_INTERN"]);

export function isPayrollStartApplicable(
  employmentType: EmploymentType | "" | null | undefined,
): boolean {
  if (!employmentType) {
    return true;
  }
  return !NON_PAYROLL_EMPLOYMENT_TYPES.has(employmentType);
}

export function payrollStartDateError(input: {
  readonly joiningDate: string;
  readonly payrollStartDate: string;
  readonly sameAsJoining: boolean;
  readonly employmentType: EmploymentType | "" | null | undefined;
}): string | null {
  if (!isPayrollStartApplicable(input.employmentType) || input.sameAsJoining) {
    return null;
  }
  const joining = input.joiningDate.trim();
  const payroll = input.payrollStartDate.trim();
  if (!joining) {
    return "Date of joining is required before payroll start date.";
  }
  if (!payroll) {
    return "Enter a payroll start date.";
  }
  if (!isCalendarIsoDate(payroll) || !isCalendarIsoDate(joining)) {
    return "Payroll start date must be a valid date.";
  }
  if (payroll < joining) {
    return "Payroll start date cannot be before date of joining.";
  }
  return null;
}

export function resolvePayrollStartDate(input: {
  readonly joiningDate: string;
  readonly payrollStartDate: string;
  readonly sameAsJoining: boolean;
  readonly employmentType: EmploymentType | "" | null | undefined;
}): string | null {
  if (!isPayrollStartApplicable(input.employmentType)) {
    return null;
  }
  if (input.sameAsJoining) {
    return input.joiningDate.trim() || null;
  }
  return input.payrollStartDate.trim() || null;
}

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "OTHER", label: "Other" },
  { value: "UNSPECIFIED", label: "Unspecified" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
] as const;

export const MARITAL_STATUS_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "OTHER", label: "Other" },
] as const;

export const ETHNICITY_OPTIONS = [
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
  { value: "ASIAN", label: "Asian" },
  { value: "BLACK_OR_AFRICAN_AMERICAN", label: "Black or African American" },
  { value: "HISPANIC_OR_LATINO", label: "Hispanic or Latino" },
  { value: "WHITE", label: "White" },
  { value: "NATIVE_AMERICAN", label: "Native American" },
  { value: "PACIFIC_ISLANDER", label: "Pacific Islander" },
  { value: "TWO_OR_MORE", label: "Two or more" },
  { value: "OTHER", label: "Other" },
] as const;

/** ISO country codes accepted by the employee nationality field. */
export const NATIONALITY_OPTIONS = [
  "US",
  "CA",
  "MX",
  "GB",
  "IE",
  "IN",
  "AU",
  "NZ",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "BE",
  "CH",
  "AT",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "PT",
  "BR",
  "AR",
  "CL",
  "CO",
  "PE",
  "JP",
  "KR",
  "CN",
  "HK",
  "TW",
  "SG",
  "MY",
  "TH",
  "PH",
  "ID",
  "VN",
  "AE",
  "SA",
  "QA",
  "KW",
  "BH",
  "OM",
  "ZA",
  "NG",
  "KE",
  "EG",
  "IL",
  "TR",
  "RU",
  "UA",
  "PK",
  "BD",
  "LK",
  "NP",
  "OTHER",
].map((value) => ({ value, label: value }));

export function hirePersonalStepError(input: {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string;
  readonly personalEmail?: string;
  readonly workEmail?: string;
}): string | null {
  const missing: string[] = [];
  if (!input.firstName.trim()) {
    missing.push("first name");
  }
  if (!input.lastName.trim()) {
    missing.push("last name");
  }
  if (!input.dateOfBirth.trim()) {
    missing.push("date of birth");
  }
  if (!(input.workEmail?.trim() ?? "")) {
    missing.push("official email");
  }
  if (missing.length > 0) {
    return requiredFieldsContinueError(missing);
  }
  const dobError = dateOfBirthError(input.dateOfBirth);
  if (dobError) {
    return dobError;
  }
  const personal = input.personalEmail?.trim() ?? "";
  const personalError = personalEmailFieldError(personal);
  if (personalError) {
    return personalError;
  }
  if (!isValidPersonalEmail(input.workEmail ?? "")) {
    return "Enter a valid official email address.";
  }
  return null;
}

function joinRequiredFieldNames(names: readonly string[]): string {
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function requiredFieldsContinueError(names: readonly string[]): string {
  const joined = joinRequiredFieldNames(names);
  const verb = names.length === 1 ? "is" : "are";
  const sentence = `${joined} ${verb} required to continue.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function hireEmploymentStepError(input: {
  readonly departmentId: string;
  readonly designationId: string;
  readonly locationId: string;
  readonly startDate: string;
  readonly employmentType: EmploymentType | "";
  readonly vendorId: string;
  readonly payrollStartDate: string;
  readonly payrollSameAsJoining: boolean;
  readonly leavePolicyId?: string;
}): string | null {
  const missing: string[] = [];
  if (!input.departmentId.trim()) {
    missing.push("department");
  }
  if (!input.designationId.trim()) {
    missing.push("designation");
  }
  if (!input.locationId.trim()) {
    missing.push("location");
  }
  if (!input.startDate.trim()) {
    missing.push("date of joining");
  }
  if (!String(input.employmentType || "").trim()) {
    missing.push("employment type");
  }
  if (!String(input.leavePolicyId || "").trim()) {
    missing.push("leave policy");
  }
  if (missing.length > 0) {
    return requiredFieldsContinueError(missing);
  }
  if (isVendorRequired(input.employmentType) && !input.vendorId) {
    return "Vendor is required for contractor employment.";
  }
  return payrollStartDateError({
    joiningDate: input.startDate,
    payrollStartDate: input.payrollStartDate,
    sameAsJoining: input.payrollSameAsJoining,
    employmentType: input.employmentType,
  });
}

/** Normalizer fallbacks that are not real designations on the profile UI. */
const PROFILE_DEFAULT_TITLE_LABELS = new Set(["employee", "general"]);

function hasFilledProfileText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasProfileOrgDepartment(employee: EmployeeRecord): boolean {
  return (
    hasFilledProfileText(employee.departmentId) ||
    hasFilledProfileText(employee.departmentName)
  );
}

function hasProfileOrgLocation(employee: EmployeeRecord): boolean {
  return (
    hasFilledProfileText(employee.locationId) ||
    hasFilledProfileText(employee.locationName)
  );
}

function hasProfileDesignation(employee: EmployeeRecord): boolean {
  if (hasFilledProfileText(employee.designationId)) {
    return true;
  }
  const title = employee.title?.trim() ?? "";
  if (!title) {
    return false;
  }
  return !PROFILE_DEFAULT_TITLE_LABELS.has(title.toLowerCase());
}

/**
 * Employment tab checkmark on My Profile / wizard tabs.
 * Matches OrganizationStep read-only fields HR fills (org IDs + names), not
 * legacy access-bucket `department` or optional reporting manager.
 */
export function profileEmploymentSectionComplete(
  employee: EmployeeRecord,
): boolean {
  if (!hasFilledProfileText(employee.workEmail)) {
    return false;
  }
  if (!isUsableCompanyName(employee.company)) {
    return false;
  }
  if (!hasProfileOrgDepartment(employee)) {
    return false;
  }
  if (!hasProfileOrgLocation(employee)) {
    return false;
  }
  if (!hasProfileDesignation(employee)) {
    return false;
  }
  if (!hasFilledProfileText(employee.employmentType)) {
    return false;
  }
  if (!hasFilledProfileText(employee.startDate)) {
    return false;
  }
  if (
    isVendorRequired(employee.employmentType) &&
    !hasFilledProfileText(employee.vendorId)
  ) {
    return false;
  }
  return true;
}

export function hireGovIdStepError(input: {
  readonly nationality: string;
  readonly nationalIdDocumentTypeId?: string;
  readonly nationalIdDocumentTypeCode?: string;
  readonly nationalIdNumber?: string;
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
}): string | null {
  if (!input.nationality.trim()) {
    return requiredFieldsContinueError(["nationality"]);
  }
  const number = input.nationalIdNumber?.trim();
  if (number && !isMaskedNationalIdNumber(number)) {
    return nationalIdNumberError({
      nationalIdNumber: number,
      documentTypeId: input.nationalIdDocumentTypeId || null,
      documentTypeCode: input.nationalIdDocumentTypeCode,
      types: input.nationalIdTypes ?? [],
      nationality: input.nationality,
    });
  }
  return null;
}

export function hireEmergencyStepError(input: {
  readonly name: string;
  readonly phone: string;
  readonly relation: string;
  readonly email: string;
}): string | null {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const relation = input.relation.trim();
  const email = input.email.trim();
  if (!name && !phone && !relation && !email) {
    return null;
  }
  if (phone) {
    const phoneError = contactPhoneError(phone);
    if (phoneError) {
      return phoneError;
    }
  }
  const emailError = emergencyEmailFieldError(email);
  if (emailError) {
    return emailError;
  }
  return null;
}

/** Nested create/draft keys the backend maps onto EMERGENCY_CONTACT. */
export function emergencyContactBodyFromForm(input: {
  readonly name: string;
  readonly phone: string;
  readonly relation: string;
  readonly email?: string;
}): Record<string, string> {
  const body: Record<string, string> = {};
  const name = input.name.trim();
  const phone = input.phone.trim();
  const relation = input.relation.trim();
  const email = input.email?.trim() ?? "";
  if (name) {
    body.emergencyContactName = name;
  }
  if (phone) {
    body.emergencyContactPhone = phone.replace(/[\s\-().]/g, "");
  }
  if (relation) {
    body.emergencyContactRelation = relation;
  }
  if (email) {
    body.emergencyContactEmail = email;
  }
  return body;
}

export function isActiveCatalogStatus(status: string | null | undefined): boolean {
  return (status ?? "Active").trim().toLowerCase() === "active";
}

export function filterActiveCatalogRows<T extends { readonly status?: string | null }>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => isActiveCatalogStatus(row.status));
}

export function normalizeCountryCode(
  raw: string | null | undefined,
): string | null {
  const text = (raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(text)) {
    return null;
  }
  return text;
}

export function nationalityForDocumentTypes(
  nationality: string | null | undefined,
): string | null {
  const text = (nationality ?? "").trim().toUpperCase();
  return text || null;
}

export function filterDocumentTypesForCountry(
  types: readonly NationalIdDocumentTypeOption[],
  country: string | null,
): NationalIdDocumentTypeOption[] {
  const active = types.filter((row) => isActiveCatalogStatus(row.status));
  if (!country) {
    return [];
  }
  return active.filter((row) => {
    const code = row.countryCode?.trim().toUpperCase() ?? "";
    return !code || code === country;
  });
}

const GENERIC_PASSPORT_FORMAT = /^[A-Z0-9]{6,9}$/;

const KNOWN_NATIONAL_ID_FORMATS: Record<string, RegExp> = {
  SSN: /^\d{9}$/,
  AADHAAR: /^\d{12}$/,
  PAN: /^[A-Z]{5}\d{4}[A-Z]$/,
  DRIVERS_LICENSE: /^[A-Z0-9]{5,20}$/,
};

const NATIONAL_ID_COUNTRY_FORMATS: Record<
  string,
  Record<string, RegExp>
> = {
  US: {
    PASSPORT: /^[A-Z0-9]{9}$/,
  },
  IN: {
    PASSPORT: /^[A-Z][0-9]{7}$/,
  },
};

/** User-facing examples when catalog NUMBER_FORMAT is set but no static hint exists. */
const NATIONAL_ID_FORMAT_HINTS: Record<string, string> = {
  SSN: "9 digits (dashes optional, e.g. 123-45-6789)",
  AADHAAR: "12 digits",
  PAN: "5 letters, 4 digits, then 1 letter (e.g. ABCDE1234F)",
  DRIVERS_LICENSE: "5–20 letters or digits (e.g. D1234567)",
  PASSPORT: "6–9 letters or digits (e.g. AB123456)",
};

const NATIONAL_ID_COUNTRY_FORMAT_HINTS: Record<
  string,
  Record<string, string>
> = {
  US: {
    PASSPORT: "9 letters or digits (e.g. 123456789)",
  },
  IN: {
    PASSPORT: "1 letter followed by 7 digits (e.g. A1234567)",
  },
};

const NATIONAL_ID_FORMAT_PLACEHOLDERS: Record<string, string> = {
  SSN: "123-45-6789",
  AADHAAR: "12 digits",
  PAN: "ABCDE1234F",
  DRIVERS_LICENSE: "D1234567",
  PASSPORT: "AB123456",
};

const NATIONAL_ID_COUNTRY_FORMAT_PLACEHOLDERS: Record<
  string,
  Record<string, string>
> = {
  US: {
    PASSPORT: "123456789",
  },
  IN: {
    PASSPORT: "A1234567",
  },
};

const GENERIC_PASSPORT_MAX_INPUT_LENGTH = 9;

const NATIONAL_ID_MAX_INPUT_LENGTHS: Record<string, number> = {
  AADHAAR: 12,
  PAN: 10,
  SSN: 11,
  DRIVERS_LICENSE: 20,
};

const SSN_MAX_DIGITS = 9;

/** Format up to 9 SSN digits with optional dashes (123-45-6789). */
function formatSsnInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, SSN_MAX_DIGITS);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

const NATIONAL_ID_COUNTRY_MAX_INPUT_LENGTHS: Record<
  string,
  Record<string, number>
> = {
  US: {
    PASSPORT: 9,
  },
  IN: {
    PASSPORT: 8,
  },
};

/** Max characters allowed while typing (after normalization). */
export function nationalIdMaxInputLength(
  documentTypeCode: string | null | undefined,
  countryCode?: string | null,
): number | undefined {
  const code = (documentTypeCode ?? "").trim().toUpperCase();
  if (!code) {
    return undefined;
  }
  const country = normalizeCountryCode(countryCode);
  if (country) {
    const countryMax = NATIONAL_ID_COUNTRY_MAX_INPUT_LENGTHS[country]?.[code];
    if (countryMax !== undefined) {
      return countryMax;
    }
    if (code === "PASSPORT") {
      return GENERIC_PASSPORT_MAX_INPUT_LENGTH;
    }
  }
  return NATIONAL_ID_MAX_INPUT_LENGTHS[code];
}

/** Normalize and truncate to the document type's max input length. */
export function clampNationalIdNumberInput(
  documentTypeCode: string | null | undefined,
  raw: string,
  countryCode?: string | null,
): string {
  const code = (documentTypeCode ?? "").trim().toUpperCase();
  if (code === "SSN") {
    return formatSsnInput(raw);
  }
  const normalized = normalizeNationalIdNumber(documentTypeCode, raw);
  const max = nationalIdMaxInputLength(documentTypeCode, countryCode);
  if (max === undefined) {
    return normalized;
  }
  return normalized.slice(0, max);
}

/** Normalize before format validation / persistence. */
export function normalizeNationalIdNumber(
  documentTypeCode: string | null | undefined,
  raw: string,
): string {
  const code = (documentTypeCode ?? "").trim().toUpperCase();
  const text = raw.trim();
  if (!text) {
    return "";
  }
  if (code === "PAN") {
    return text.toUpperCase().replace(/\s+/g, "");
  }
  if (code === "AADHAAR") {
    return text.replace(/\D/g, "");
  }
  if (code === "SSN") {
    return text.replace(/\D/g, "");
  }
  if (code === "PASSPORT" || code === "DRIVERS_LICENSE") {
    return text.toUpperCase().replace(/[\s-]+/g, "");
  }
  return text;
}

export function nationalIdFormatHint(
  type: NationalIdDocumentTypeOption | null | undefined,
  countryCode?: string | null,
): string | null {
  if (!type) {
    return null;
  }
  const code = type.documentTypeCode.toUpperCase();
  const country = normalizeCountryCode(countryCode);
  if (country) {
    const countryHint = NATIONAL_ID_COUNTRY_FORMAT_HINTS[country]?.[code];
    if (countryHint) {
      return countryHint;
    }
  }
  const staticHint = NATIONAL_ID_FORMAT_HINTS[code];
  if (staticHint) {
    return staticHint;
  }
  if (type.format?.trim()) {
    return "the required format for this document type";
  }
  return null;
}

export function nationalIdFormatPlaceholder(
  type: NationalIdDocumentTypeOption | null | undefined,
  countryCode?: string | null,
): string | null {
  if (!type) {
    return null;
  }
  const code = type.documentTypeCode.toUpperCase();
  const country = normalizeCountryCode(countryCode);
  if (country) {
    const countryPlaceholder =
      NATIONAL_ID_COUNTRY_FORMAT_PLACEHOLDERS[country]?.[code];
    if (countryPlaceholder) {
      return countryPlaceholder;
    }
  }
  return NATIONAL_ID_FORMAT_PLACEHOLDERS[code] ?? null;
}

function nationalIdFormatErrorMessage(
  type: NationalIdDocumentTypeOption,
  countryCode?: string | null,
): string {
  const hint = nationalIdFormatHint(type, countryCode);
  if (hint) {
    return `${type.documentTypeLabel} must match ${hint}.`;
  }
  return `Enter a valid ${type.documentTypeLabel} number.`;
}

/** Catalog regex when present, else known document-type patterns. */
export function resolveNationalIdFormatPattern(
  type: NationalIdDocumentTypeOption | null | undefined,
  countryCode?: string | null,
): RegExp | null {
  if (!type) {
    return null;
  }
  const catalog = type.format?.trim();
  if (catalog) {
    try {
      return new RegExp(catalog);
    } catch {
      return null;
    }
  }
  const code = type.documentTypeCode.toUpperCase();
  const country = normalizeCountryCode(countryCode);
  if (country) {
    const countryPattern = NATIONAL_ID_COUNTRY_FORMATS[country]?.[code];
    if (countryPattern) {
      return countryPattern;
    }
    if (code === "PASSPORT") {
      return GENERIC_PASSPORT_FORMAT;
    }
  }
  return KNOWN_NATIONAL_ID_FORMATS[code] ?? null;
}

/**
 * Resolve catalog UUID from draft id and/or API type code.
 * Profile GET returns ``nationalIdDocumentType`` (code) but often omits the UUID.
 */
export function resolveNationalIdDocumentTypeId(input: {
  readonly documentTypeId: string | null | undefined;
  readonly documentTypeCode?: string | null | undefined;
  readonly types: readonly NationalIdDocumentTypeOption[];
}): string {
  const id = input.documentTypeId?.trim() ?? "";
  if (id) {
    const byId = input.types.find((row) => row.documentTypeId === id);
    if (byId) {
      return byId.documentTypeId;
    }
    const idAsCode = input.types.find(
      (row) => row.documentTypeCode.toUpperCase() === id.toUpperCase(),
    );
    if (idAsCode) {
      return idAsCode.documentTypeId;
    }
  }
  const code = input.documentTypeCode?.trim() ?? "";
  if (!code) {
    return "";
  }
  const byCode = input.types.find(
    (row) => row.documentTypeCode.toUpperCase() === code.toUpperCase(),
  );
  return byCode?.documentTypeId ?? "";
}

export function nationalIdNumberError(input: {
  readonly nationalIdNumber: string | null | undefined;
  readonly documentTypeId: string | null;
  readonly documentTypeCode?: string | null;
  readonly types: readonly NationalIdDocumentTypeOption[];
  readonly nationality?: string | null;
}): string | null {
  const raw = input.nationalIdNumber?.trim();
  if (!raw) {
    return null;
  }
  const resolvedId = resolveNationalIdDocumentTypeId({
    documentTypeId: input.documentTypeId,
    documentTypeCode: input.documentTypeCode,
    types: input.types,
  });
  const type =
    input.types.find((row) => row.documentTypeId === resolvedId) ?? null;
  if (!type) {
    return "Select a government ID type first.";
  }
  const country = nationalityForDocumentTypes(input.nationality);
  const number = normalizeNationalIdNumber(type.documentTypeCode, raw);
  const pattern = resolveNationalIdFormatPattern(type, country);
  if (!pattern) {
    return null;
  }
  if (!pattern.test(number)) {
    return nationalIdFormatErrorMessage(type, country);
  }
  return null;
}

export function activeSkills(
  catalog: readonly SkillCatalogOption[],
): SkillCatalogOption[] {
  return catalog.filter((row) => isActiveCatalogStatus(row.status));
}

export function parseSkillProficiency(raw: unknown): SkillProficiency | "" {
  const value = String(raw ?? "").trim().toUpperCase();
  if (
    value === "BEGINNER" ||
    value === "INTERMEDIATE" ||
    value === "EXPERT"
  ) {
    return value;
  }
  return "";
}

export function formatSkillExperience(raw: unknown): string {
  if (raw == null || raw === "") {
    return "";
  }
  const text = String(raw).trim();
  if (
    SKILL_EXPERIENCE_RANGES.includes(
      text as (typeof SKILL_EXPERIENCE_RANGES)[number],
    )
  ) {
    return text;
  }
  const years =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.trunc(raw)
      : Number((text.match(/^(\d+)/) ?? [])[1]);
  if (!Number.isFinite(years)) {
    return "";
  }
  if (years <= 1) {
    return "0-1";
  }
  if (years <= 2) {
    return "1-2";
  }
  if (years <= 3) {
    return "2-3";
  }
  if (years <= 5) {
    return "3-5";
  }
  if (years <= 7) {
    return "5-7";
  }
  if (years <= 10) {
    return "7-10";
  }
  return "10+";
}

const SKILL_EXPERIENCE_TO_YEARS: Readonly<Record<string, number>> = {
  "0-1": 1,
  "1-2": 2,
  "2-3": 3,
  "3-5": 5,
  "5-7": 7,
  "7-10": 10,
  "10+": 11,
};

export function yearsExperienceToNumber(
  range: string | null | undefined,
): number | undefined {
  const key = (range ?? "").trim();
  if (!key) {
    return undefined;
  }
  return SKILL_EXPERIENCE_TO_YEARS[key];
}

export function mapSkillCertificateFields(row: Record<string, unknown>): Pick<
  EmployeeSkillEntry,
  | "hasCertificate"
  | "certificateName"
  | "certificateExpiresOn"
  | "certificateFileName"
  | "certificateObjectKey"
> {
  const objectKeyRaw = row.certificateObjectKey ?? row.certificate_object_key;
  const objectKey =
    typeof objectKeyRaw === "string" && objectKeyRaw.trim()
      ? objectKeyRaw
      : undefined;
  const fileNameRaw = row.certificateFileName ?? row.certificate_file_name;
  const fileName =
    typeof fileNameRaw === "string" && fileNameRaw.trim()
      ? fileNameRaw.trim()
      : undefined;
  const nameRaw = row.certificateName ?? row.certificate_name;
  const certificateName =
    typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : undefined;
  const expiresRaw = row.certificateExpiresOn ?? row.certificate_expires_on;
  const certificateExpiresOn =
    typeof expiresRaw === "string" && expiresRaw.trim()
      ? expiresRaw.trim().slice(0, 10)
      : undefined;
  return {
    hasCertificate:
      Boolean(row.hasCertificate) ||
      Boolean(objectKey) ||
      Boolean(certificateName),
    ...(certificateName ? { certificateName } : {}),
    ...(certificateExpiresOn ? { certificateExpiresOn } : {}),
    ...(fileName ? { certificateFileName: fileName } : {}),
    ...(objectKey ? { certificateObjectKey: objectKey } : {}),
  };
}

export function entriesFromSkillLists(
  skillIds: readonly string[],
  skillNames: readonly string[],
): EmployeeSkillEntry[] {
  return skillIds.filter(Boolean).map((skillId, index) => {
    const skillName = skillNames[index] ?? skillId;
    return {
      id: skillId,
      skillId,
      skillName,
      kind: "catalog" as const,
      status: "Active",
      proficiency: "" as const,
      yearsExperience: "",
      hasCertificate: false,
    };
  });
}

export function mapEmployeeSkillEntries(raw: unknown): EmployeeSkillEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries: EmployeeSkillEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const skillId = String(row.skillId ?? "");
    if (!skillId) {
      continue;
    }
    const years = row.yearsExperience ?? row.years_experience;
    const skillName = String(row.skillName ?? skillId);
    entries.push({
      id: String(row.employeeSkillId ?? skillId),
      skillId,
      skillName,
      kind: "catalog",
      status: String(row.status ?? "Active"),
      proficiency: parseSkillProficiency(row.proficiency),
      yearsExperience: formatSkillExperience(years),
      ...mapSkillCertificateFields(row),
    });
  }
  return entries;
}

export function withSkillEntries(
  professional: ProfessionalProfile,
  skillEntries: readonly EmployeeSkillEntry[],
): ProfessionalProfile {
  const attached = skillEntries.filter((row) => row.skillId);
  return {
    ...professional,
    skillEntries,
    skillIds: attached.map((row) => row.skillId),
    skills: attached.map((row) => row.skillName),
  };
}

export function isCompleteSkillEntry(row: EmployeeSkillEntry): boolean {
  return Boolean(
    row.skillId && row.proficiency && row.yearsExperience.trim(),
  );
}

export function persistableSkillEntries(
  entries: readonly EmployeeSkillEntry[] | undefined,
): EmployeeSkillEntry[] {
  return (entries ?? []).filter(isCompleteSkillEntry);
}

export function nationalIdCatalogError(input: {
  readonly nationality: string | null;
  readonly documentTypeId: string | null;
  /** Existing last4 on file — Save must not require re-entering the number. */
  readonly nationalIdLast4?: string | null;
  /** Write-only full number; empty/masked means user is not changing it. */
  readonly nationalIdNumber?: string | null;
}): string | null {
  if (!input.documentTypeId) {
    return null;
  }
  const number = input.nationalIdNumber?.trim() ?? "";
  const enteringNewNumber =
    Boolean(number) && !isMaskedNationalIdNumber(number);
  // Keep existing Gov ID on file: do not block profile Save when the user is
  // not submitting a new number (type may be code-only from GET).
  if (input.nationalIdLast4?.trim() && !enteringNewNumber) {
    return null;
  }
  if (!nationalityForDocumentTypes(input.nationality)) {
    return "Select nationality first";
  }
  return null;
}

/**
 * True when ``value`` looks like a masked/display last4 (bullets, stars, x’s),
 * not a real ID the user typed for write.
 */
export function isMaskedNationalIdNumber(
  value: string | null | undefined,
): boolean {
  const text = (value ?? "").trim();
  if (!text) {
    return false;
  }
  if (/[•*]/.test(text)) {
    return true;
  }
  if (/^x{2,}/i.test(text.replace(/[\s-]/g, ""))) {
    return true;
  }
  return false;
}

/** Display placeholder when GET returns last4 only (never persisted as-is). */
export function maskedNationalIdFromLast4(last4: string | null | undefined): string {
  const chars = (last4 ?? "").trim().replace(/[^A-Za-z0-9]/g, "");
  if (!chars || chars.length > 4) {
    return "";
  }
  return `••••${chars}`;
}

/** Restore Gov ID wizard fields from a saved employee/draft row. */
export function govIdFormFromEmployee(
  employee: EmployeeRecord,
  types: readonly NationalIdDocumentTypeOption[],
  options?: { readonly revealFullNumber?: boolean },
): {
  readonly nationality: string;
  readonly nationalIdDocumentTypeId: string;
  readonly nationalIdNumber: string;
} {
  const nationality = employee.personal.nationality?.trim() ?? "";
  const nationalIdDocumentTypeId = resolveNationalIdDocumentTypeId({
    documentTypeId: employee.personal.nationalIdDocumentTypeId,
    documentTypeCode: employee.personal.nationalIdDocumentType,
    types,
  });
  const fullNumber = employee.personal.nationalIdNumber?.trim() ?? "";
  const nationalIdNumber =
    options?.revealFullNumber &&
    fullNumber &&
    !isMaskedNationalIdNumber(fullNumber)
      ? fullNumber
      : maskedNationalIdFromLast4(employee.personal.nationalIdLast4);
  return { nationality, nationalIdDocumentTypeId, nationalIdNumber };
}

/** Last4 hint only when the selected type matches what is stored on file. */
export function nationalIdLast4ForSelectedType(input: {
  readonly selectedTypeCode: string | null | undefined;
  readonly storedTypeCode: string | null | undefined;
  readonly last4: string | null | undefined;
}): string {
  const last4 = input.last4?.trim() ?? "";
  if (!last4) {
    return "";
  }
  const selected = (input.selectedTypeCode ?? "").trim().toUpperCase();
  const stored = (input.storedTypeCode ?? "").trim().toUpperCase();
  if (!selected || !stored || selected !== stored) {
    return "";
  }
  return last4;
}

/** First wizard step when resuming an incomplete hire draft. */
export function initialCreateWizardStep(employee?: EmployeeRecord): 1 | 2 | 3 | 4 {
  if (!employee?.id) {
    return 1;
  }
  const hasPersonal =
    Boolean(employee.firstName.trim()) &&
    Boolean(employee.lastName.trim()) &&
    Boolean(employee.personal.dateOfBirth.trim());
  const hasEmployment =
    Boolean(employee.departmentId) &&
    Boolean(employee.locationId) &&
    Boolean(employee.designationId);
  const hasGovId =
    Boolean(employee.personal.nationality.trim()) &&
    (Boolean(employee.personal.nationalIdDocumentType.trim()) ||
      Boolean(employee.personal.nationalIdLast4.trim()));
  if (hasPersonal && hasEmployment && hasGovId) {
    return 4;
  }
  if (hasPersonal && hasEmployment) {
    return 3;
  }
  if (hasPersonal) {
    return 2;
  }
  return 1;
}

/** Flat identity fields for create / PATCH. Includes optional full ID number. */
export function identityBodyFromCatalog(input: {
  readonly workMode: string | null;
  readonly nationalIdDocumentTypeId: string | null;
  readonly nationalIdNumber?: string | null;
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
}): Record<string, string> {
  const body: Record<string, string> = {};
  if (input.workMode) {
    body.workMode = input.workMode;
  }
  const typeId = input.nationalIdDocumentTypeId?.trim();
  if (typeId) {
    body.nationalIdDocumentTypeId = typeId;
  }
  if (input.nationalIdNumber === "") {
    if (typeId) {
      body.nationalIdNumber = "";
    }
    return body;
  }
  const rawNumber = input.nationalIdNumber?.trim();
  if (rawNumber && !isMaskedNationalIdNumber(rawNumber)) {
    const type =
      input.nationalIdTypes?.find((row) => row.documentTypeId === typeId) ??
      null;
    body.nationalIdNumber = normalizeNationalIdNumber(
      type?.documentTypeCode,
      rawNumber,
    );
  }
  return body;
}

/** UI-only placeholders that must never be persisted as company. */
const COMPANY_PLACEHOLDERS = new Set([
  "—",
  "–",
  "-",
  "Select company",
]);

/** Em-dash / dash placeholders sometimes stored or displayed as empty phones. */
const PHONE_PLACEHOLDERS = new Set(["—", "–", "-"]);
const EMERGENCY_NAME_PLACEHOLDERS = new Set(["emergency contact"]);

/**
 * True when ``value`` is a real company name (not empty / em dash / select label).
 */
export function isUsableCompanyName(
  value: string | null | undefined,
): boolean {
  const text = (value ?? "").trim();
  if (!text) {
    return false;
  }
  return !COMPANY_PLACEHOLDERS.has(text);
}

/** True when value is empty or a display-only phone placeholder. */
export function isPhonePlaceholder(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  return !text || PHONE_PLACEHOLDERS.has(text);
}

/** True when value is empty or the legacy auto-filled emergency contact name. */
export function isEmergencyNamePlaceholder(
  value: string | null | undefined,
): boolean {
  const text = (value ?? "").trim();
  return !text || EMERGENCY_NAME_PLACEHOLDERS.has(text.toLowerCase());
}

/** Normalize phone fields for PATCH — placeholders become null. */
export function usablePhoneOrNull(
  value: string | null | undefined,
): string | null {
  return isPhonePlaceholder(value) ? null : (value ?? "").trim();
}

/** Drop display placeholders from a companies option list. */
export function filterRealCompanies(
  companies: readonly string[],
): string[] {
  return companies.filter((name) => isUsableCompanyName(name));
}

/** Hide the company picker when this tenant has at most one real company. */
export function shouldShowCompanyPicker(
  companies: readonly string[],
): boolean {
  return filterRealCompanies(companies).length > 1;
}

/**
 * Resolve company for create / invite / draft writes.
 * Prefer explicit form value, then actor company, then first real list entry,
 * then ``Default`` (backend seed fallback).
 */
export function resolveCreateCompany(input: {
  readonly company: string | null | undefined;
  readonly companies?: readonly string[];
  readonly actorCompany?: string | null | undefined;
  readonly fallback?: string;
}): string {
  if (isUsableCompanyName(input.company)) {
    return input.company!.trim();
  }
  if (isUsableCompanyName(input.actorCompany)) {
    return input.actorCompany!.trim();
  }
  const fromList = filterRealCompanies(input.companies ?? [])[0];
  if (fromList) {
    return fromList;
  }
  const fallback = (input.fallback ?? "Default").trim();
  return fallback || "Default";
}

/** Form fields needed to build a create / invite / draft payload. */
export interface BuildCreateEmployeeInputParams {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string;
  readonly workEmail: string;
  readonly personalEmail: string;
  readonly department: string;
  readonly departmentId: string;
  readonly locationId: string;
  readonly designationId: string;
  readonly workMode: string;
  readonly nationalIdDocumentTypeId: string;
  readonly nationalIdNumber?: string;
  readonly nationalIdTypes?: readonly NationalIdDocumentTypeOption[];
  readonly skillIds: readonly string[];
  readonly title: string;
  readonly role: string;
  readonly supervisorId: string;
  readonly projectIds: readonly string[];
  readonly accessFlags: EmployeeAccessFlags;
  readonly startDate: string;
  readonly company: string;
  readonly companies: readonly string[];
  readonly actorCompany?: string;
  readonly employmentType: EmploymentType | "";
  readonly workerType?: WorkerType;
  readonly workSchedule?: WorkSchedule | null;
  readonly employmentCategory?: EmploymentCategory;
  readonly vendorId: string;
  readonly jobRank: JobRank;
  readonly jobDescription: string;
  readonly gradeBand?: string;
  readonly emergencyContactName?: string;
  readonly emergencyContactPhone?: string;
  readonly emergencyContactRelation?: string;
  readonly emergencyContactEmail?: string;
  readonly asDraft: boolean;
  readonly employeeId?: string;
  readonly middleName?: string;
  readonly gender?: string;
  readonly nationality?: string;
  readonly ethnicity?: string;
  readonly maritalStatus?: string;
  readonly payrollStartDate?: string | null;
  readonly timesheetRequired?: boolean;
  readonly leavePolicyId?: string | null;
  readonly phone?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country?: string;
}

export type BuildCreateEmployeeInputResult =
  | { readonly ok: true; readonly input: CreateEmployeeInput }
  | { readonly ok: false; readonly error: string };

/**
 * Pure create/invite/draft payload builder used by EmployeeAccessPanel.
 * Invite (`asDraft=false`) and draft both allow optional Gov ID at create time.
 */
export function buildCreateEmployeeInput(
  params: BuildCreateEmployeeInputParams,
): BuildCreateEmployeeInputResult {
  const company = resolveCreateCompany({
    company: params.company,
    companies: params.companies,
    actorCompany: params.actorCompany,
  });

  const rawNationalIdNumber = params.nationalIdNumber?.trim() ?? "";
  if (
    rawNationalIdNumber &&
    !isMaskedNationalIdNumber(rawNationalIdNumber)
  ) {
    const numberError = nationalIdNumberError({
      nationalIdNumber: rawNationalIdNumber,
      documentTypeId: params.nationalIdDocumentTypeId || null,
      types: params.nationalIdTypes ?? [],
      nationality: params.nationality,
    });
    if (numberError) {
      return { ok: false, error: numberError };
    }
  }

  // Hire/create always stores EMPLOYEE; role assignment is deferred to RBAC.
  const access = syncAccessRoleFields("EMPLOYEE", "EMPLOYEE");
  const designationTitle = params.title.trim();
  const input: CreateEmployeeInput = {
    firstName: params.firstName.trim(),
    lastName: params.lastName.trim(),
    dateOfBirth: params.dateOfBirth.trim() || undefined,
    workEmail: params.workEmail.trim(),
    personalEmail: params.personalEmail.trim() || undefined,
    department: access.department,
    departmentId: params.departmentId || null,
    locationId: params.locationId || null,
    designationId: params.designationId || null,
    workMode: params.workMode || null,
    nationalIdDocumentTypeId: params.nationalIdDocumentTypeId || null,
    nationalIdNumber: (() => {
      const number = params.nationalIdNumber?.trim() ?? "";
      if (isMaskedNationalIdNumber(number)) {
        return null;
      }
      if (!number) {
        return params.nationalIdDocumentTypeId?.trim() ? "" : null;
      }
      const type =
        params.nationalIdTypes?.find(
          (row) => row.documentTypeId === params.nationalIdDocumentTypeId,
        ) ?? null;
      return normalizeNationalIdNumber(type?.documentTypeCode, number) || null;
    })(),
    skillIds: params.skillIds,
    title: designationTitle || "New hire",
    role: access.role,
    supervisorId: params.supervisorId || null,
    projectIds: params.projectIds,
    accessFlags: params.accessFlags,
    startDate: params.startDate,
    company,
    employmentType: params.employmentType || undefined,
    ...(params.employmentType
      ? {
          workerType: params.workerType,
          workSchedule: params.workSchedule,
          employmentCategory: params.employmentCategory,
        }
      : {}),
    vendorId: isVendorRequired(params.employmentType)
      ? params.vendorId || null
      : null,
    jobRank: params.jobRank,
    jobDescription: params.jobDescription.trim() || designationTitle,
    gradeBand: params.gradeBand?.trim() || undefined,
    emergencyContactName: params.emergencyContactName?.trim() || undefined,
    emergencyContactPhone: params.emergencyContactPhone?.trim() || undefined,
    emergencyContactRelation:
      params.emergencyContactRelation?.trim() || undefined,
    emergencyContactEmail: params.emergencyContactEmail?.trim() || undefined,
    asDraft: params.asDraft,
    middleName: params.middleName?.trim() || undefined,
    gender: params.gender?.trim() || undefined,
    nationality: params.nationality?.trim() || undefined,
    ethnicity: params.ethnicity?.trim() || undefined,
    maritalStatus: params.maritalStatus?.trim() || undefined,
    payrollStartDate: params.payrollStartDate,
    timesheetRequired: Boolean(params.timesheetRequired),
    leavePolicyId: params.leavePolicyId?.trim() || null,
    phone: params.phone?.trim() || undefined,
    addressLine1: params.addressLine1?.trim() || undefined,
    addressLine2: params.addressLine2?.trim() || undefined,
    city: params.city?.trim() || undefined,
    state: params.state?.trim() || undefined,
    postalCode: params.postalCode?.trim() || undefined,
    country: params.country?.trim() || undefined,
    ...(params.employeeId ? { id: params.employeeId } : {}),
  };
  return { ok: true, input };
}

/** Extra hire-wizard fields mapped onto create / draft / invite API bodies. */
export function hireProfileWriteFields(input: {
  readonly middleName?: string;
  readonly gender?: string;
  readonly nationality?: string;
  readonly ethnicity?: string;
  readonly maritalStatus?: string;
  readonly payrollStartDate?: string | null;
  readonly timesheetRequired?: boolean;
  readonly leavePolicyId?: string | null;
  readonly phone?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly emergencyContactName?: string;
  readonly emergencyContactPhone?: string;
  readonly emergencyContactRelation?: string;
  readonly emergencyContactEmail?: string;
  readonly gradeBand?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const optionalStrings: ReadonlyArray<readonly [string, string | undefined]> = [
    ["gradeBand", input.gradeBand],
    ["middleName", input.middleName],
    ["gender", input.gender],
    ["nationality", input.nationality],
    ["ethnicity", input.ethnicity],
    ["maritalStatus", input.maritalStatus],
    ["phoneNumber", input.phone],
    ["addressLine1", input.addressLine1],
    ["addressLine2", input.addressLine2],
    ["city", input.city],
    ["state", input.state],
    ["postalCode", input.postalCode],
    ["country", input.country],
  ];
  for (const [key, value] of optionalStrings) {
    const text = value?.trim();
    if (text) {
      body[key] = text;
    }
  }
  if (input.payrollStartDate !== undefined) {
    body.payrollStartDate = input.payrollStartDate;
  }
  body.timesheetRequired = Boolean(input.timesheetRequired);
  const leavePolicyId = input.leavePolicyId?.trim();
  if (leavePolicyId) {
    body.leavePolicyId = leavePolicyId;
  }
  Object.assign(
    body,
    emergencyContactBodyFromForm({
      name: input.emergencyContactName ?? "",
      phone: input.emergencyContactPhone ?? "",
      relation: input.emergencyContactRelation ?? "",
      email: input.emergencyContactEmail,
    }),
  );
  return body;
}

/**
 * Map the form's Work Email onto the employee write contract.
 *
 * Storage key is ``emailId``; ``officialEmail`` is the documented alias.
 * The UI field is ``workEmail`` and must never be sent as-is.
 * Whitespace-only values are treated as absent.
 */
export function officialEmailFieldsFromWorkEmail(
  workEmail: string | null | undefined,
): { readonly officialEmail: string; readonly emailId: string } | Record<string, never> {
  const officialEmail = (workEmail ?? "").trim();
  if (!officialEmail) {
    return {};
  }
  return { officialEmail, emailId: officialEmail };
}
