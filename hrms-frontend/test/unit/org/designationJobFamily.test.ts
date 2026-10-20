import {
  designationToCreateBody,
  validateDesignationDraft,
} from "@/modules/org";

describe("designation job family (DEPT-DATA-5)", () => {
  it("requires job family", () => {
    expect(
      validateDesignationDraft({ title: "Engineer", jobFamily: "" }),
    ).toBe("Job family is required.");
  });

  it("rejects unknown job family", () => {
    expect(
      validateDesignationDraft({
        title: "Engineer",
        jobFamily: "Sales",
      }),
    ).toMatch(/Job family must be one of/);
  });

  it("maps the create body with trimmed title and job family", () => {
    const draft = {
      title: "  HR Partner  ",
      jobFamily: "Corporate",
    };
    expect(validateDesignationDraft(draft)).toBeNull();
    expect(designationToCreateBody(draft)).toEqual({
      title: "HR Partner",
      jobFamily: "Corporate",
    });
  });
});
