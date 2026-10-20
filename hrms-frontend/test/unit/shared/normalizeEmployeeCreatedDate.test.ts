import { normalizeEmployeesModuleData } from "@/shared/live/normalizers";

describe("normalizeEmployeesModuleData createdDate", () => {
  it("keeps the API createdDate instead of substituting now()", () => {
    const seeded = "2024-03-15T12:00:00.000Z";
    const data = normalizeEmployeesModuleData([
      {
        employeeId: "sys-developer",
        firstName: "Superadmin",
        lastName: "",
        emailId: "developer@example.com",
        isSystemAccount: true,
        createdDate: seeded,
      },
    ]);

    expect(data.employees[0]?.createdDate).toBe(seeded);
  });

  it("leaves createdDate null when the API omits it", () => {
    const data = normalizeEmployeesModuleData([
      {
        employeeId: "sys-developer",
        firstName: "Superadmin",
        lastName: "",
        emailId: "developer@example.com",
        isSystemAccount: true,
      },
    ]);

    expect(data.employees[0]?.createdDate).toBeNull();
  });

  it("omits system accounts from supervisor options derived from live employees", () => {
    const data = normalizeEmployeesModuleData([
      {
        employeeId: "sys-developer",
        firstName: "Superadmin",
        lastName: "",
        emailId: "developer@example.com",
        role: "SUPERADMIN",
        department: "SUPERADMIN",
        isSystemAccount: true,
      },
      {
        employeeId: "emp-hr",
        firstName: "Blake",
        lastName: "Ortiz",
        emailId: "blake.ortiz@eaova.test",
        role: "HR",
        department: "HR",
        departmentName: "People Operations",
        isSystemAccount: false,
      },
      {
        employeeId: "emp-regular",
        firstName: "Casey",
        lastName: "Patel",
        emailId: "casey.patel@eaova.test",
        role: "EMPLOYEE",
        department: "EMPLOYEE",
        isSystemAccount: false,
      },
    ]);

    expect(data.employees).toHaveLength(3);
    expect(data.supervisors.map((row) => row.id)).toEqual([
      "emp-hr",
      "emp-regular",
    ]);
    expect(data.supervisors.some((row) => row.id === "sys-developer")).toBe(
      false,
    );
  });
});

describe("normalizeEmployeesModuleData personal/contact", () => {
  it("falls back to top-level fields when nested contact strings are empty", () => {
    const data = normalizeEmployeesModuleData([
      {
        employeeId: "emp-self",
        firstName: "Navreet",
        lastName: "Kaur",
        emailId: "navreet@eaova.test",
        personalEmail: "navreet.personal@example.test",
        phoneNumber: "+14155550100",
        alternatePhoneNumber: "+14155550199",
        gender: "FEMALE",
        maritalStatus: "SINGLE",
        nationality: "IN",
        ethnicity: "ASIAN",
        addressLine1: "42 Maple Ave",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
        contact: {
          personalEmail: "",
          phone: "",
          alternatePhone: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          postalCode: "",
          country: "",
          emergencyName: "Pat Kaur",
          emergencyPhone: "+14155550188",
          emergencyRelation: "Spouse",
        },
      },
    ]);

    const employee = data.employees[0];
    expect(employee?.personal.gender).toBe("FEMALE");
    expect(employee?.personal.maritalStatus).toBe("SINGLE");
    expect(employee?.personal.nationality).toBe("IN");
    expect(employee?.contact.personalEmail).toBe(
      "navreet.personal@example.test",
    );
    expect(employee?.contact.phone).toBe("+14155550100");
    expect(employee?.contact.alternatePhone).toBe("+14155550199");
    expect(employee?.contact.addressLine1).toBe("42 Maple Ave");
    expect(employee?.contact.city).toBe("Austin");
    expect(employee?.contact.country).toBe("US");
    expect(employee?.contact.emergencyName).toBe("Pat Kaur");
  });

  it("maps employee skills from the GET payload into skillEntries", () => {
    const data = normalizeEmployeesModuleData([
      {
        employeeId: "emp-navreet",
        firstName: "Navreet",
        lastName: "Kaur",
        emailId: "navreet@eaova.test",
        skills: [
          {
            skillId: "skill-python",
            skillName: "python",
            proficiency: "EXPERT",
            yearsExperience: 11,
            hasCertificate: true,
            certificateName: "Internship",
            certificateFileName: "Certificate-pdf.pdf",
            certificateObjectKey:
              "employees/emp-navreet/skills/skill-python/certificate/Certificate-pdf.pdf",
          },
        ],
      },
    ]);

    const employee = data.employees[0];
    expect(employee?.professional.skillIds).toEqual(["skill-python"]);
    expect(employee?.professional.skills).toEqual(["python"]);
    expect(employee?.professional.skillEntries).toEqual([
      expect.objectContaining({
        skillId: "skill-python",
        skillName: "python",
        proficiency: "EXPERT",
        yearsExperience: "10+",
        hasCertificate: true,
        certificateName: "Internship",
        certificateFileName: "Certificate-pdf.pdf",
      }),
    ]);
  });
});
