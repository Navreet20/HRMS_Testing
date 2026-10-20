import {
  VIEW_ONLY_ACCESS_FLAGS,
} from "@/modules/employees/constants";
import {
  buildCreateEmployeeInput,
  combinePhoneParts,
  contactPhoneError,
  contactPhoneNationalNumberError,
  defaultCountryFromStoredPhone,
  formatContactPhoneNational,
  formatStoredPhoneDisplay,
  fromReactPhoneInputChange,
  sanitizeContactPhoneNationalInput,
  toReactPhoneInputDisplayValue,
  toReactPhoneInputValue,
  emergencyContactBodyFromForm,
  filterDocumentTypesForCountry,
  filterRealCompanies,
  govIdFormFromEmployee,
  initialCreateWizardStep,
  identityBodyFromCatalog,
  maskedNationalIdFromLast4,
  nationalIdLast4ForSelectedType,
  isUsableCompanyName,
  usablePhoneOrNull,
  dateOfBirthError,
  hireDraftSaveError,
  hirePersonalStepError,
  isValidDateOfBirth,
  nameBasedCodeStem,
  allocateNameBasedEmployeeCode,
  isValidEmergencyPhone,
  isValidPersonalEmail,
  personalEmailFieldError,
  mapEmployeeSkillEntries,
  nationalIdCatalogError,
  nationalIdNumberError,
  normalizeNationalIdNumber,
  clampNationalIdNumberInput,
  nationalIdMaxInputLength,
  officialEmailFieldsFromWorkEmail,
  hireProfileWriteFields,
  resolveNationalIdDocumentTypeId,
  nationalityForDocumentTypes,
  resolveNationalIdFormatPattern,
  formatSkillExperience,
  isFutureCertificateExpiry,
  tomorrowIsoDate,
  todayIsoDate,
  payrollStartDateError,
  yearsExperienceToNumber,
  resolveCreateCompany,
  resolvePayrollStartDate,
  isPayrollStartApplicable,
  hireEmergencyStepError,
  hireEmploymentStepError,
  hireGovIdStepError,
  shouldShowCompanyPicker,
  splitPhoneParts,
  withSkillEntries,
  persistableSkillEntries,
  isCompleteSkillEntry,
  type BuildCreateEmployeeInputParams,
} from "@/modules/employees/employeeCatalog";
import type { EmployeeRecord, NationalIdDocumentTypeOption } from "@/modules/employees/types";

const TYPES: readonly NationalIdDocumentTypeOption[] = [
  {
    documentTypeId: "nid-ssn",
    documentTypeCode: "SSN",
    documentTypeLabel: "Social Security Number",
    countryCode: "US",
    format: null,
    status: "Active",
  },
  {
    documentTypeId: "nid-passport",
    documentTypeCode: "PASSPORT",
    documentTypeLabel: "Passport",
    countryCode: null,
    format: null,
    status: "Active",
  },
  {
    documentTypeId: "nid-aadhaar",
    documentTypeCode: "AADHAAR",
    documentTypeLabel: "Aadhaar",
    countryCode: "IN",
    format: null,
    status: "Active",
  },
  {
    documentTypeId: "nid-pan",
    documentTypeCode: "PAN",
    documentTypeLabel: "PAN",
    countryCode: "IN",
    format: null,
    status: "Active",
  },
  {
    documentTypeId: "nid-dl",
    documentTypeCode: "DRIVERS_LICENSE",
    documentTypeLabel: "Driver's license",
    countryCode: "US",
    format: null,
    status: "Active",
  },
  {
    documentTypeId: "nid-old",
    documentTypeCode: "OLD",
    documentTypeLabel: "Retired type",
    countryCode: "US",
    format: null,
    status: "Inactive",
  },
];

function validCreateParams(
  overrides: Partial<BuildCreateEmployeeInputParams> = {},
): BuildCreateEmployeeInputParams {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    dateOfBirth: "1990-05-05",
    workEmail: "ada@example.com",
    personalEmail: "ada.personal@example.com",
    department: "HR",
    departmentId: "dept-1",
    locationId: "loc-1",
    designationId: "des-1",
    workMode: "HYBRID",
    nationalIdDocumentTypeId: "nid-ssn",
    nationalIdNumber: "",
    nationality: "US",
    skillIds: ["skill-1"],
    title: "Engineer",
    role: "HR",
    supervisorId: "sup-1",
    projectIds: ["proj-1"],
    accessFlags: VIEW_ONLY_ACCESS_FLAGS,
    startDate: "2026-01-15",
    company: "Acme",
    companies: ["Acme", "Other"],
    employmentType: "FULL_TIME",
    vendorId: "",
    jobRank: "RANK_7",
    jobDescription: "Build things",
    asDraft: false,
    ...overrides,
  };
}

describe("employeeCatalog", () => {
  it("derives national ID types from nationality, including global passport", () => {
    expect(nationalityForDocumentTypes("us")).toBe("US");
    expect(nationalityForDocumentTypes("")).toBeNull();
    expect(nationalityForDocumentTypes("OTHER")).toBe("OTHER");
    expect(
      filterDocumentTypesForCountry(TYPES, "US").map(
        (row) => row.documentTypeCode,
      ),
    ).toEqual(["SSN", "PASSPORT", "DRIVERS_LICENSE"]);
    expect(
      filterDocumentTypesForCountry(TYPES, "IN").map(
        (row) => row.documentTypeCode,
      ),
    ).toEqual(["PASSPORT", "AADHAAR", "PAN"]);
    expect(
      filterDocumentTypesForCountry(TYPES, "OTHER").map(
        (row) => row.documentTypeCode,
      ),
    ).toEqual(["PASSPORT"]);
    expect(filterDocumentTypesForCountry(TYPES, null)).toEqual([]);
  });

  it("shows that country's types plus global passport, hiding inactive", () => {
    const filtered = filterDocumentTypesForCountry(TYPES, "US");
    expect(filtered.map((row) => row.documentTypeCode)).toEqual([
      "SSN",
      "PASSPORT",
      "DRIVERS_LICENSE",
    ]);
  });

  it("blocks a national ID type until nationality is selected", () => {
    expect(
      nationalIdCatalogError({
        nationality: null,
        documentTypeId: "nid-ssn",
      }),
    ).toMatch(/nationality first/i);
    expect(
      nationalIdCatalogError({
        nationality: "US",
        documentTypeId: "nid-ssn",
      }),
    ).toBeNull();
    expect(
      identityBodyFromCatalog({
        workMode: "REMOTE",
        nationalIdDocumentTypeId: "nid-ssn",
        nationalIdNumber: "123-45-6789",
      }),
    ).toEqual({
      workMode: "REMOTE",
      nationalIdDocumentTypeId: "nid-ssn",
      nationalIdNumber: "123-45-6789",
    });
    expect(
      identityBodyFromCatalog({
        workMode: "REMOTE",
        nationalIdDocumentTypeId: "nid-pan",
        nationalIdNumber: "abcde1234f",
        nationalIdTypes: TYPES,
      }),
    ).toEqual({
      workMode: "REMOTE",
      nationalIdDocumentTypeId: "nid-pan",
      nationalIdNumber: "ABCDE1234F",
    });
    expect(
      identityBodyFromCatalog({
        workMode: "ONSITE",
        nationalIdDocumentTypeId: "nid-ssn",
        nationalIdNumber: "••••6789",
      }),
    ).toEqual({
      workMode: "ONSITE",
      nationalIdDocumentTypeId: "nid-ssn",
    });
    expect(
      identityBodyFromCatalog({
        workMode: "REMOTE",
        nationalIdDocumentTypeId: "nid-ssn",
        nationalIdNumber: "123-45-6789",
      }),
    ).not.toHaveProperty("nationalIdCountry");
  });

  it("govIdFormFromEmployee restores type id from code and masks last4", () => {
    const employee = {
      personal: {
        nationality: "IN",
        nationalIdDocumentTypeId: "",
        nationalIdDocumentType: "PAN",
        nationalIdLast4: "1234",
      },
    } as EmployeeRecord;
    expect(govIdFormFromEmployee(employee, TYPES)).toEqual({
      nationality: "IN",
      nationalIdDocumentTypeId: "nid-pan",
      nationalIdNumber: "••••1234",
    });
  });

  it("maskedNationalIdFromLast4 keeps letters for passport-style IDs", () => {
    expect(maskedNationalIdFromLast4("DHFK")).toBe("••••DHFK");
    expect(maskedNationalIdFromLast4("0000")).toBe("••••0000");
    expect(maskedNationalIdFromLast4("")).toBe("");
  });

  it("govIdFormFromEmployee reveals full number when editing with permission", () => {
    const employee = {
      personal: {
        nationality: "IN",
        nationalIdDocumentTypeId: "nid-passport",
        nationalIdDocumentType: "PASSPORT",
        nationalIdLast4: "4567",
        nationalIdNumber: "A1234567",
      },
    } as EmployeeRecord;
    expect(
      govIdFormFromEmployee(employee, TYPES, { revealFullNumber: true }),
    ).toEqual({
      nationality: "IN",
      nationalIdDocumentTypeId: "nid-passport",
      nationalIdNumber: "A1234567",
    });
    expect(
      govIdFormFromEmployee(employee, TYPES, { revealFullNumber: false }),
    ).toMatchObject({ nationalIdNumber: "••••4567" });
  });

  it("identityBodyFromCatalog omits masked national ID numbers on draft save", () => {
    expect(
      identityBodyFromCatalog({
        workMode: "REMOTE",
        nationalIdDocumentTypeId: "nid-pan",
        nationalIdNumber: "••••1234",
        nationalIdTypes: TYPES,
      }),
    ).toEqual({
      workMode: "REMOTE",
      nationalIdDocumentTypeId: "nid-pan",
    });
  });

  it("identityBodyFromCatalog clears stored number when field is emptied after type change", () => {
    expect(
      identityBodyFromCatalog({
        workMode: "REMOTE",
        nationalIdDocumentTypeId: "nid-aadhaar",
        nationalIdNumber: "",
        nationalIdTypes: TYPES,
      }),
    ).toEqual({
      workMode: "REMOTE",
      nationalIdDocumentTypeId: "nid-aadhaar",
      nationalIdNumber: "",
    });
  });

  it("nationalIdLast4ForSelectedType hides on-file hint when type no longer matches", () => {
    expect(
      nationalIdLast4ForSelectedType({
        selectedTypeCode: "PAN",
        storedTypeCode: "AADHAAR",
        last4: "5692",
      }),
    ).toBe("");
    expect(
      nationalIdLast4ForSelectedType({
        selectedTypeCode: "PAN",
        storedTypeCode: "PAN",
        last4: "5692",
      }),
    ).toBe("5692");
  });

  it("does not block Save when national ID last4 is on file and number is unchanged", () => {
    expect(
      nationalIdCatalogError({
        nationality: null,
        documentTypeId: "nid-drivers",
        nationalIdLast4: "2000",
        nationalIdNumber: "",
      }),
    ).toBeNull();
    expect(
      nationalIdCatalogError({
        nationality: null,
        documentTypeId: "nid-drivers",
        nationalIdLast4: "2000",
        nationalIdNumber: "••••2000",
      }),
    ).toBeNull();
    expect(
      nationalIdCatalogError({
        nationality: null,
        documentTypeId: "nid-ssn",
        nationalIdLast4: "2000",
        nationalIdNumber: "123-45-6789",
      }),
    ).toMatch(/nationality first/i);
  });

  it("resolves national ID catalog UUID from API type code", () => {
    expect(
      resolveNationalIdDocumentTypeId({
        documentTypeId: "",
        documentTypeCode: "SSN",
        types: TYPES,
      }),
    ).toBe("nid-ssn");
    expect(
      resolveNationalIdDocumentTypeId({
        documentTypeId: "SSN",
        documentTypeCode: "",
        types: TYPES,
      }),
    ).toBe("nid-ssn");
    expect(
      resolveNationalIdDocumentTypeId({
        documentTypeId: "nid-ssn",
        documentTypeCode: "PASSPORT",
        types: TYPES,
      }),
    ).toBe("nid-ssn");
  });
});

describe("company placeholders", () => {
  it("rejects em dash and select labels as usable company names", () => {
    expect(isUsableCompanyName("—")).toBe(false);
    expect(isUsableCompanyName("Select company")).toBe(false);
    expect(isUsableCompanyName("")).toBe(false);
    expect(isUsableCompanyName("  ")).toBe(false);
    expect(isUsableCompanyName("EAOVA")).toBe(true);
  });

  it("treats em-dash phones as empty for PATCH payloads", () => {
    expect(usablePhoneOrNull("—")).toBeNull();
    expect(usablePhoneOrNull("–")).toBeNull();
    expect(usablePhoneOrNull("-")).toBeNull();
    expect(usablePhoneOrNull("")).toBeNull();
    expect(usablePhoneOrNull("+15551234567")).toBe("+15551234567");
  });

  it("hides the company picker when only one real company exists", () => {
    expect(shouldShowCompanyPicker(["EAOVA"])).toBe(false);
    expect(shouldShowCompanyPicker(["EAOVA", "—"])).toBe(false);
    expect(shouldShowCompanyPicker(["EAOVA Inc", "EAOVA Consulting LLC"])).toBe(
      true,
    );
  });

  it("filters placeholders out of the companies option list", () => {
    expect(filterRealCompanies(["—", "EAOVA", "", "Select company", "Acme"])).toEqual([
      "EAOVA",
      "Acme",
    ]);
  });

  it("prefers actor company over em-dash list entries", () => {
    expect(
      resolveCreateCompany({
        company: "",
        companies: ["—", "Select company"],
        actorCompany: "EAOVA",
      }),
    ).toBe("EAOVA");
    expect(
      resolveCreateCompany({
        company: "—",
        companies: ["—"],
        actorCompany: "",
      }),
    ).toBe("Default");
    expect(
      resolveCreateCompany({
        company: "",
        companies: ["—", "Acme"],
      }),
    ).toBe("Acme");
  });
});

describe("buildCreateEmployeeInput", () => {
  it("returns a defined invite payload when inputs are valid (asDraft=false)", () => {
    const result = buildCreateEmployeeInput(validCreateParams({ asDraft: false }));
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input).toBeDefined();
    expect(result.input.asDraft).toBe(false);
    expect(result.input.department).toBe("EMPLOYEE");
    expect(result.input.role).toBe("EMPLOYEE");
    expect(result.input.workEmail).toBe("ada@example.com");
    expect(officialEmailFieldsFromWorkEmail(result.input.workEmail)).toEqual({
      officialEmail: "ada@example.com",
      emailId: "ada@example.com",
    });
    expect(officialEmailFieldsFromWorkEmail(result.input.workEmail)).not.toHaveProperty(
      "workEmail",
    );
  });

  it("returns a defined draft payload when inputs are valid (asDraft=true)", () => {
    const result = buildCreateEmployeeInput(validCreateParams({ asDraft: true }));
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input).toBeDefined();
    expect(result.input.asDraft).toBe(true);
    expect(result.input.department).toBe("EMPLOYEE");
    expect(result.input.role).toBe("EMPLOYEE");
  });

  it("buildCreateEmployeeInput rejects invalid SSN format", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({
        nationalIdNumber: "12345",
        nationalIdTypes: TYPES,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toMatch(/Social Security Number must match/i);
  });

  it("nationalIdNumberError accepts dashed SSN via catalog fallback", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "123-45-6789",
        documentTypeId: "nid-ssn",
        types: TYPES,
      }),
    ).toBeNull();
  });

  it("nationalIdNumberError accepts lowercase PAN and normalizes format", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "abcde1234f",
        documentTypeId: "nid-pan",
        types: TYPES,
      }),
    ).toBeNull();
    expect(normalizeNationalIdNumber("PAN", "abcde1234f")).toBe("ABCDE1234F");
  });

  it("nationalIdNumberError rejects invalid PAN length", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "ABC123",
        documentTypeId: "nid-pan",
        types: TYPES,
      }),
    ).toMatch(/PAN must match/i);
  });

  it("nationalIdNumberError rejects invalid Aadhaar", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "12345",
        documentTypeId: "nid-aadhaar",
        types: TYPES,
        nationality: "IN",
      }),
    ).toMatch(/Aadhaar must match/i);
  });

  it("clampNationalIdNumberInput stops SSN at 9 digits", () => {
    expect(
      clampNationalIdNumberInput("SSN", "123456789012", "US"),
    ).toBe("123-45-6789");
    expect(clampNationalIdNumberInput("SSN", "123-45-6789", "US")).toBe(
      "123-45-6789",
    );
    expect(clampNationalIdNumberInput("SSN", "123456789", "US")).toBe(
      "123-45-6789",
    );
  });

  it("nationalIdNumberError rejects SSN with more than 9 digits", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "1234567890",
        documentTypeId: "nid-ssn",
        types: TYPES,
      }),
    ).toMatch(/Social Security Number must match/i);
  });

  it("clampNationalIdNumberInput stops Aadhaar at 12 digits", () => {
    expect(
      clampNationalIdNumberInput(
        "AADHAAR",
        "123412232424334232313131",
        "IN",
      ),
    ).toBe("123412232424");
    expect(nationalIdMaxInputLength("AADHAAR", "IN")).toBe(12);
  });

  it("clampNationalIdNumberInput stops PAN at 10 characters", () => {
    expect(
      clampNationalIdNumberInput("PAN", "abcde1234fxyz", "IN"),
    ).toBe("ABCDE1234F");
  });

  it("nationalIdNumberError validates US passport format", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "123456789",
        documentTypeId: "nid-passport",
        types: TYPES,
        nationality: "US",
      }),
    ).toBeNull();
    expect(
      nationalIdNumberError({
        nationalIdNumber: "ABC12",
        documentTypeId: "nid-passport",
        types: TYPES,
        nationality: "US",
      }),
    ).toMatch(/Passport must match/i);
  });

  it("nationalIdNumberError validates Indian passport format", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "a1234567",
        documentTypeId: "nid-passport",
        types: TYPES,
        nationality: "IN",
      }),
    ).toBeNull();
    expect(
      nationalIdNumberError({
        nationalIdNumber: "1234567890",
        documentTypeId: "nid-passport",
        types: TYPES,
        nationality: "IN",
      }),
    ).toMatch(/Passport must match/i);
  });

  it("nationalIdNumberError validates US driver's license format", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "d123-4567",
        documentTypeId: "nid-dl",
        types: TYPES,
        nationality: "US",
      }),
    ).toBeNull();
    expect(normalizeNationalIdNumber("DRIVERS_LICENSE", "d123-4567")).toBe(
      "D1234567",
    );
    expect(
      nationalIdNumberError({
        nationalIdNumber: "ABC",
        documentTypeId: "nid-dl",
        types: TYPES,
        nationality: "US",
      }),
    ).toMatch(/Driver's license must match/i);
  });

  it("resolveNationalIdFormatPattern uses country for passport", () => {
    const passport = TYPES.find((row) => row.documentTypeCode === "PASSPORT")!;
    expect(resolveNationalIdFormatPattern(passport, "US")?.test("123456789")).toBe(
      true,
    );
    expect(resolveNationalIdFormatPattern(passport, "IN")?.test("A1234567")).toBe(
      true,
    );
    expect(resolveNationalIdFormatPattern(passport, "GB")?.test("AB123456")).toBe(
      true,
    );
    expect(resolveNationalIdFormatPattern(passport, null)).toBeNull();
  });

  it("nationalIdNumberError validates passport for non-US/IN nationalities", () => {
    expect(
      nationalIdNumberError({
        nationalIdNumber: "AB123456",
        documentTypeId: "nid-passport",
        types: TYPES,
        nationality: "GB",
      }),
    ).toBeNull();
    expect(
      nationalIdNumberError({
        nationalIdNumber: "AB12",
        documentTypeId: "nid-passport",
        types: TYPES,
        nationality: "GB",
      }),
    ).toMatch(/Passport must match/i);
  });

  it("resolveNationalIdFormatPattern uses catalog regex when set", () => {
    const pattern = resolveNationalIdFormatPattern({
      ...TYPES[0],
      format: "^\\d{4}$",
    });
    expect(pattern?.test("1234")).toBe(true);
    expect(pattern?.test("12345")).toBe(false);
  });

  it("does not block invite when national ID work mode is unset (Gov ID optional)", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({
        asDraft: false,
        workMode: "",
        nationalIdDocumentTypeId: "nid-ssn",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("does not block invite when national ID number is masked on file", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({
        asDraft: false,
        nationality: "US",
        nationalIdDocumentTypeId: "nid-passport",
        nationalIdNumber: "••••6789",
        nationalIdTypes: TYPES,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input.nationalIdNumber).toBeNull();
  });

  it("still returns a defined draft payload when national ID would block invite", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({
        asDraft: true,
        workMode: "",
        nationalIdDocumentTypeId: "nid-ssn",
      }),
    );
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input.asDraft).toBe(true);
  });

  it("draft as Admin without Employment uses actor company and EMPLOYEE dual-write", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({
        asDraft: true,
        department: "EMPLOYEE",
        role: "EMPLOYEE",
        company: "",
        companies: ["—"],
        actorCompany: "EAOVA",
        workEmail: "",
        title: "",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input.company).toBe("EAOVA");
    expect(result.input.company).not.toBe("—");
    expect(result.input.role).toBe("EMPLOYEE");
    expect(result.input.department).toBe("EMPLOYEE");
  });

  it("never persists em-dash company even when it is first in companies list", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({
        asDraft: true,
        company: "—",
        companies: ["—", "EAOVA"],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input.company).toBe("EAOVA");
  });

  it("maps attached skills into profile rows and keeps ids in sync", () => {
    const entries = mapEmployeeSkillEntries([
      {
        skillId: "skill-sql",
        skillName: "SQL",
        proficiency: "expert",
        yearsExperience: 4,
      },
      { skillId: "", skillName: "Ignored" },
    ]);
    expect(entries).toEqual([
      {
        id: "skill-sql",
        skillId: "skill-sql",
        skillName: "SQL",
        kind: "catalog",
        status: "Active",
        proficiency: "EXPERT",
        yearsExperience: "3-5",
        hasCertificate: false,
      },
    ]);

    const next = withSkillEntries(
      {
        education: [],
        skills: [],
        skillIds: [],
        skillEntries: [],
      },
      [
        ...entries,
        {
          id: "pending-skill",
          skillId: "",
          skillName: "",
          kind: "catalog",
          status: "Active",
          proficiency: "",
          yearsExperience: "",
          hasCertificate: false,
        },
      ],
    );
    expect(next.skillIds).toEqual(["skill-sql"]);
    expect(next.skills).toEqual(["SQL"]);
    expect(next.skillEntries).toHaveLength(2);
  });

  it("maps a saved skill certificate file name and object key", () => {
    expect(
      mapEmployeeSkillEntries([
        {
          skillId: "skill-sql",
          skillName: "SQL",
          proficiency: "INTERMEDIATE",
          yearsExperience: 5,
          hasCertificate: true,
          certificateFileName: "sql-cert.pdf",
          certificateObjectKey: "employees/1/skills/sql/certificate/sql-cert.pdf",
          certificateName: "AWS Certified Developer",
          certificateExpiresOn: "2027-06-15",
        },
      ]),
    ).toEqual([
      {
        id: "skill-sql",
        skillId: "skill-sql",
        skillName: "SQL",
        kind: "catalog",
        status: "Active",
        proficiency: "INTERMEDIATE",
        yearsExperience: "3-5",
        hasCertificate: true,
        certificateFileName: "sql-cert.pdf",
        certificateObjectKey: "employees/1/skills/sql/certificate/sql-cert.pdf",
        certificateName: "AWS Certified Developer",
        certificateExpiresOn: "2027-06-15",
      },
    ]);
  });

  it("treats certificate expiry as optional but only accepts future dates", () => {
    const now = new Date(2026, 7, 31);
    expect(todayIsoDate(now)).toBe("2026-08-31");
    expect(tomorrowIsoDate(now)).toBe("2026-09-01");
    expect(isFutureCertificateExpiry("", now)).toBe(true);
    expect(isFutureCertificateExpiry(undefined, now)).toBe(true);
    expect(isFutureCertificateExpiry("2026-08-31", now)).toBe(false);
    expect(isFutureCertificateExpiry("2026-08-30", now)).toBe(false);
    expect(isFutureCertificateExpiry("2026-09-01", now)).toBe(true);
  });

  it("maps skill experience onto frontend year ranges", () => {
    expect(formatSkillExperience("0-1")).toBe("0-1");
    expect(formatSkillExperience(0)).toBe("0-1");
    expect(formatSkillExperience("4 Years")).toBe("3-5");
    expect(formatSkillExperience(12)).toBe("10+");
    expect(yearsExperienceToNumber("3-5")).toBe(5);
    expect(yearsExperienceToNumber("10+")).toBe(11);
    expect(yearsExperienceToNumber("")).toBeUndefined();
  });

  it("does not treat incomplete skill rows as persistable", () => {
    expect(
      isCompleteSkillEntry({
        id: "skill-sql-entry",
        skillId: "skill-sql",
        skillName: "SQL",
        kind: "catalog",
        status: "Active",
        proficiency: "",
        yearsExperience: "3-5",
        hasCertificate: false,
      }),
    ).toBe(false);
    expect(
      persistableSkillEntries([
        {
          id: "",
          skillId: "",
          skillName: "",
          kind: "catalog",
          status: "Active",
          proficiency: "",
          yearsExperience: "",
          hasCertificate: false,
        },
        {
          id: "skill-sql-entry",
          skillId: "skill-sql",
          skillName: "SQL",
          kind: "catalog",
          status: "Active",
          proficiency: "INTERMEDIATE",
          yearsExperience: "3-5",
          hasCertificate: false,
        },
      ]),
    ).toEqual([
      {
        id: "skill-sql-entry",
        skillId: "skill-sql",
        skillName: "SQL",
        kind: "catalog",
        status: "Active",
        proficiency: "INTERMEDIATE",
        yearsExperience: "3-5",
        hasCertificate: false,
      },
    ]);
  });
});

describe("hire wizard field helpers", () => {
  it("accepts personal email on blur-style validation and rejects junk", () => {
    expect(isValidPersonalEmail("ada.personal@example.com")).toBe(true);
    expect(isValidPersonalEmail("not-an-email")).toBe(false);
    expect(isValidPersonalEmail("ellemc@123com")).toBe(false);
    expect(isValidPersonalEmail("")).toBe(false);
    expect(personalEmailFieldError("")).toBeNull();
    expect(personalEmailFieldError("ada.personal@example.com")).toBeNull();
    expect(personalEmailFieldError("ellemc@123com")).toBe(
      "Enter a valid personal email address.",
    );
  });

  it("keeps date of birth within the 18–100 year hire window", () => {
    const today = "2026-08-28";
    expect(isValidDateOfBirth("1990-05-05", today)).toBe(true);
    expect(isValidDateOfBirth("1900-01-01", today)).toBe(false);
    expect(dateOfBirthError("1900-01-01", today)).toMatch(/100 years ago/i);
    expect(isValidDateOfBirth("2099-01-01", today)).toBe(false);
  });

  it("builds name-based employee code stems and collision suffixes", () => {
    expect(nameBasedCodeStem("Jane", "Doe")).toBe("JAN_DOE");
    expect(nameBasedCodeStem("Satya", "Hegde")).toBe("SAT_HEG");
    expect(allocateNameBasedEmployeeCode("Jane", "Doe", [])).toBe("JAN_DOE");
    expect(allocateNameBasedEmployeeCode("Jane", "Doe", ["JAN_DOE"])).toBe(
      "JAN_DOE-2",
    );
  });

  it("treats year 0009 as an over-age employee DOB, not a future date", () => {
    expect(isValidDateOfBirth("0009-03-15")).toBe(false);
    expect(dateOfBirthError("0009-03-15")).toBe(
      "Date of birth cannot be more than 100 years ago.",
    );
    expect(dateOfBirthError("0009-03-15")).not.toMatch(/future/i);
    expect(
      hirePersonalStepError({
        firstName: "Ada",
        lastName: "Lovelace",
        dateOfBirth: "0009-03-15",
        workEmail: "ada@example.com",
      }),
    ).toBe("Date of birth cannot be more than 100 years ago.");
    expect(
      hirePersonalStepError({
        firstName: "Ada",
        lastName: "Lovelace",
        dateOfBirth: "2099-01-01",
        workEmail: "ada@example.com",
      }),
    ).toBe("Date of birth cannot be in the future.");
  });

  it("names only the missing personal fields when Save & Continue is blocked", () => {
    expect(
      hirePersonalStepError({
        firstName: "",
        lastName: "Lovelace",
        dateOfBirth: "1990-05-05",
        workEmail: "ada@example.com",
      }),
    ).toBe("First name is required to continue.");
    expect(
      hirePersonalStepError({
        firstName: "Ada",
        lastName: "",
        dateOfBirth: "1990-05-05",
        workEmail: "ada@example.com",
      }),
    ).toBe("Last name is required to continue.");
    expect(
      hirePersonalStepError({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
      }),
    ).toBe(
      "First name, last name, date of birth, and official email are required to continue.",
    );
    expect(
      hirePersonalStepError({
        firstName: "Ada",
        lastName: "Lovelace",
        dateOfBirth: "1990-05-05",
        workEmail: "",
      }),
    ).toBe("Official email is required to continue.");
    expect(
      hirePersonalStepError({
        firstName: "Ada",
        lastName: "Lovelace",
        dateOfBirth: "1990-05-05",
        workEmail: "not-an-email",
      }),
    ).toBe("Enter a valid official email address.");
  });

  it("does not proceed with draft save when filled DOB is invalid", () => {
    expect(hireDraftSaveError({ dateOfBirth: "" })).toBeNull();
    expect(hireDraftSaveError({ dateOfBirth: "1990-05-05" })).toBeNull();
    expect(hireDraftSaveError({ dateOfBirth: "0009-03-15" })).toBe(
      "Date of birth cannot be more than 100 years ago.",
    );
    expect(hireDraftSaveError({ dateOfBirth: "2099-01-01" })).toBe(
      "Date of birth cannot be in the future.",
    );
  });

  it("maps emergency contact fields onto create/draft body keys", () => {
    expect(
      emergencyContactBodyFromForm({
        name: "Pat Yale",
        phone: "+1 (555) 012-3456",
        relation: "Spouse",
        email: "pat@example.com",
      }),
    ).toEqual({
      emergencyContactName: "Pat Yale",
      emergencyContactPhone: "+15550123456",
      emergencyContactRelation: "Spouse",
      emergencyContactEmail: "pat@example.com",
    });
    expect(isValidEmergencyPhone("+15550123456")).toBe(true);
    expect(isValidEmergencyPhone("123")).toBe(false);
  });

  it("includes emergency contact on the invite payload", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({
        emergencyContactName: "Pat Yale",
        emergencyContactPhone: "+15550123456",
        emergencyContactRelation: "Spouse",
        emergencyContactEmail: "pat@example.com",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input.emergencyContactName).toBe("Pat Yale");
    expect(result.input.emergencyContactPhone).toBe("+15550123456");
    expect(result.input.emergencyContactRelation).toBe("Spouse");
    expect(result.input.emergencyContactEmail).toBe("pat@example.com");
  });

  it("defaults timesheetRequired to false and maps it onto hire write fields", () => {
    const defaultResult = buildCreateEmployeeInput(validCreateParams());
    expect(defaultResult.ok).toBe(true);
    if (!defaultResult.ok) {
      return;
    }
    expect(defaultResult.input.timesheetRequired).toBe(false);
    expect(hireProfileWriteFields(defaultResult.input)).toMatchObject({
      timesheetRequired: false,
    });

    const checkedResult = buildCreateEmployeeInput(
      validCreateParams({ timesheetRequired: true }),
    );
    expect(checkedResult.ok).toBe(true);
    if (!checkedResult.ok) {
      return;
    }
    expect(checkedResult.input.timesheetRequired).toBe(true);
    expect(hireProfileWriteFields(checkedResult.input)).toMatchObject({
      timesheetRequired: true,
    });
  });

  it("maps leavePolicyId onto create input and hire write fields", () => {
    const result = buildCreateEmployeeInput(
      validCreateParams({ leavePolicyId: "policy-standard" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.input.leavePolicyId).toBe("policy-standard");
    expect(hireProfileWriteFields(result.input)).toMatchObject({
      leavePolicyId: "policy-standard",
    });
  });

  it("rejects payroll start before joining and treats unpaid intern as not applicable", () => {
    expect(
      payrollStartDateError({
        joiningDate: "2026-09-01",
        payrollStartDate: "2026-08-01",
        sameAsJoining: false,
        employmentType: "FULL_TIME",
      }),
    ).toMatch(/cannot be before/i);
    expect(
      resolvePayrollStartDate({
        joiningDate: "2026-09-01",
        payrollStartDate: "2026-09-15",
        sameAsJoining: true,
        employmentType: "FULL_TIME",
      }),
    ).toBe("2026-09-01");
    expect(isPayrollStartApplicable("INTERN")).toBe(true);
    expect(isPayrollStartApplicable("UNPAID_INTERN")).toBe(false);
    expect(
      payrollStartDateError({
        joiningDate: "2026-09-01",
        payrollStartDate: "",
        sameAsJoining: false,
        employmentType: "FULL_TIME",
      }),
    ).toBe("Enter a payroll start date.");
    expect(
      resolvePayrollStartDate({
        joiningDate: "2026-09-01",
        payrollStartDate: "2026-09-15",
        sameAsJoining: false,
        employmentType: "INTERN",
      }),
    ).toBe("2026-09-15");
    expect(
      resolvePayrollStartDate({
        joiningDate: "2026-09-01",
        payrollStartDate: "2026-09-01",
        sameAsJoining: true,
        employmentType: "UNPAID_INTERN",
      }),
    ).toBeNull();
  });

  it("names only the missing employment fields when Save & Continue is blocked", () => {
    const filled = {
      departmentId: "dept-1",
      designationId: "des-1",
      locationId: "loc-1",
      startDate: "2026-09-01",
      employmentType: "FULL_TIME" as const,
      vendorId: "",
      payrollStartDate: "2026-09-01",
      payrollSameAsJoining: true,
      leavePolicyId: "policy-1",
    };
    expect(hireEmploymentStepError({ ...filled, designationId: "" })).toBe(
      "Designation is required to continue.",
    );
    expect(
      hireEmploymentStepError({
        ...filled,
        departmentId: "",
        designationId: "",
      }),
    ).toBe("Department and designation are required to continue.");
    expect(
      hireEmploymentStepError({
        ...filled,
        departmentId: "",
        designationId: "",
        locationId: "",
        startDate: "",
      }),
    ).toBe(
      "Department, designation, location, and date of joining are required to continue.",
    );
    expect(hireEmploymentStepError({ ...filled, employmentType: "" })).toBe(
      "Employment type is required to continue.",
    );
    expect(hireEmploymentStepError({ ...filled, leavePolicyId: "" })).toBe(
      "Leave policy is required to continue.",
    );
    expect(
      hireEmploymentStepError({
        ...filled,
        payrollSameAsJoining: false,
        payrollStartDate: "",
      }),
    ).toBe("Enter a payroll start date.");
  });

  it("does not block hire continue when gov ID and emergency are empty", () => {
    expect(
      hireEmploymentStepError({
        departmentId: "dept-1",
        designationId: "des-1",
        locationId: "loc-1",
        startDate: "2026-09-01",
        employmentType: "FULL_TIME",
        vendorId: "",
        payrollStartDate: "2026-09-01",
        payrollSameAsJoining: true,
        leavePolicyId: "policy-1",
      }),
    ).toBeNull();
    expect(
      hireEmergencyStepError({
        name: "",
        phone: "",
        relation: "",
        email: "",
      }),
    ).toBeNull();
  });

  it("requires nationality to continue from Gov ID, not document type or number", () => {
    expect(hireGovIdStepError({ nationality: "" })).toBe(
      "Nationality is required to continue.",
    );
    expect(hireGovIdStepError({ nationality: "   " })).toBe(
      "Nationality is required to continue.",
    );
    expect(hireGovIdStepError({ nationality: "US" })).toBeNull();
  });

  it("hireGovIdStepError blocks invalid national ID numbers when entered", () => {
    expect(
      hireGovIdStepError({
        nationality: "IN",
        nationalIdDocumentTypeId: "nid-pan",
        nationalIdNumber: "BAD123",
        nationalIdTypes: TYPES,
      }),
    ).toMatch(/PAN must match/i);
    expect(
      hireGovIdStepError({
        nationality: "IN",
        nationalIdDocumentTypeId: "nid-pan",
        nationalIdNumber: "ABCDE1234F",
        nationalIdTypes: TYPES,
      }),
    ).toBeNull();
  });

  it("keeps personal continue errors free of nationality", () => {
    expect(
      hirePersonalStepError({
        firstName: "Ada",
        lastName: "Lovelace",
        dateOfBirth: "1990-05-05",
        workEmail: "ada@example.com",
      }),
    ).toBeNull();
  });
});

describe("officialEmailFieldsFromWorkEmail", () => {
  it("maps Work Email onto officialEmail and emailId for invite/create", () => {
    expect(
      officialEmailFieldsFromWorkEmail("ada.work@gmail.com"),
    ).toEqual({
      officialEmail: "ada.work@gmail.com",
      emailId: "ada.work@gmail.com",
    });
  });

  it("trims whitespace so a filled Work Email is treated as present", () => {
    expect(
      officialEmailFieldsFromWorkEmail("  hire@arohak.com  "),
    ).toEqual({
      officialEmail: "hire@arohak.com",
      emailId: "hire@arohak.com",
    });
  });

  it("omits API email keys when Work Email is empty or whitespace-only", () => {
    expect(officialEmailFieldsFromWorkEmail("")).toEqual({});
    expect(officialEmailFieldsFromWorkEmail("   ")).toEqual({});
    expect(officialEmailFieldsFromWorkEmail(null)).toEqual({});
    expect(officialEmailFieldsFromWorkEmail(undefined)).toEqual({});
  });

  it("splits and combines phone dial code with national number", () => {
    expect(splitPhoneParts("+1-555-0100")).toEqual({
      dialCode: "+1",
      nationalNumber: "5550100",
    });
    expect(splitPhoneParts("+91 98765 43210")).toEqual({
      dialCode: "+91",
      nationalNumber: "9876543210",
    });
    expect(splitPhoneParts("")).toEqual({
      dialCode: "+1",
      nationalNumber: "",
    });
    expect(combinePhoneParts("+1", "5550100")).toBe("+15550100");
    expect(combinePhoneParts("+91", "98765 43210")).toBe("+919876543210");
    expect(combinePhoneParts("+1", "")).toBe("");
  });

  it("limits contact phone national input to the selected country's max digits", () => {
    expect(sanitizeContactPhoneNationalInput("736-538-9369")).toBe("7365389369");
    expect(sanitizeContactPhoneNationalInput("12345678901")).toBe("1234567890");
    expect(sanitizeContactPhoneNationalInput("12345678901", "us")).toBe(
      "1234567890",
    );
    expect(contactPhoneNationalNumberError("7365389369")).toBeNull();
    expect(contactPhoneNationalNumberError("", { required: true })).toBe(
      "Phone number is required.",
    );
    expect(contactPhoneNationalNumberError("55512", { country: "us" })).toMatch(
      /too short/i,
    );
  });

  it("formats national numbers with regional grouping", () => {
    expect(formatContactPhoneNational("9165551234", "us")).toBe("(916) 555-1234");
    expect(formatContactPhoneNational("9876543210", "in")).toBe("98765 43210");
    expect(formatContactPhoneNational("2079460958", "gb")).toMatch(/7946/);
  });

  it("validates stored phones against country length and format", () => {
    expect(contactPhoneError("+19165551234", { country: "us" })).toBeNull();
    expect(contactPhoneError("+919876543210", { country: "in" })).toBeNull();
    expect(contactPhoneError("+1916555", { country: "us" })).toMatch(/too short/i);
    expect(
      contactPhoneNationalNumberError("91655512345", { country: "us" }),
    ).toMatch(/too long|required length/i);
    expect(contactPhoneError("", { required: true })).toBe(
      "Phone number is required.",
    );
    expect(contactPhoneError("")).toBeNull();
  });

  it("maps stored phones to react-phone-input-2 values and back", () => {
    expect(toReactPhoneInputValue("+17638678888")).toBe("17638678888");
    expect(toReactPhoneInputDisplayValue("+17638678888")).toBe("17638678888");
    expect(toReactPhoneInputValue("")).toBe("1");
    expect(toReactPhoneInputValue("", "91")).toBe("91");
    expect(defaultCountryFromStoredPhone("+17638678888")).toBe("us");
    expect(defaultCountryFromStoredPhone("+919876543210")).toBe("in");
    expect(formatStoredPhoneDisplay("+17638678888")).toBe("+1 763 867 8888");
    expect(
      fromReactPhoneInputChange("17638678888", { dialCode: "1" }),
    ).toBe("+17638678888");
    expect(
      fromReactPhoneInputChange("191655512345", {
        dialCode: "1",
        countryCode: "us",
      }),
    ).toBe("+19165551234");
    expect(
      fromReactPhoneInputChange("919876543210", { dialCode: "91" }),
    ).toBe("+919876543210");
    expect(fromReactPhoneInputChange("1", { dialCode: "1" })).toBe("");
    expect(toReactPhoneInputValue("+19165551234999999", "1")).toBe("19165551234");
  });

  it("keeps US +1 when the national number starts with 9", () => {
    expect(fromReactPhoneInputChange("19", { dialCode: "1" })).toBe("+19");
    expect(toReactPhoneInputValue("+19", "1")).toBe("19");
    expect(defaultCountryFromStoredPhone("+19")).toBe("us");
    expect(fromReactPhoneInputChange("9", { dialCode: "1" })).toBe("+19");
    expect(toReactPhoneInputValue("+19", "1")).toBe("19");
    expect(
      fromReactPhoneInputChange("19165551234", { dialCode: "1" }),
    ).toBe("+19165551234");
    expect(toReactPhoneInputValue("+19165551234", "1")).toBe("19165551234");
  });

  it("does not re-prepend dial codes missing from PHONE_DIAL_CODES", () => {
    // Angola (+244) is in react-phone-input-2 but not PHONE_DIAL_CODES.
    expect(
      fromReactPhoneInputChange("2449", {
        dialCode: "244",
        countryCode: "ao",
      }),
    ).toBe("+2449");
    expect(toReactPhoneInputValue("+2449", "244", "ao")).toBe("2449");
    expect(toReactPhoneInputValue("", "244", "ao")).toBe("244");
    expect(
      fromReactPhoneInputChange("244923456789", {
        dialCode: "244",
        countryCode: "ao",
      }),
    ).toBe("+244923456789");
    expect(toReactPhoneInputValue("+244923456789", "244", "ao")).toBe(
      "244923456789",
    );
  });

  it("initialCreateWizardStep opens gov id when employment is saved", () => {
    expect(
      initialCreateWizardStep({
        id: "emp-1",
        firstName: "Ada",
        lastName: "Lovelace",
        personal: {
          dateOfBirth: "1990-05-05",
          nationality: "",
          nationalIdDocumentType: "",
          nationalIdLast4: "",
        },
        departmentId: "dept-1",
        locationId: "loc-1",
        designationId: "des-1",
      } as EmployeeRecord),
    ).toBe(3);
  });
});
