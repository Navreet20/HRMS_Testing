import { companyInitials, companyInitialsHue } from "@/modules/company/companyInitials";

describe("companyInitials", () => {
  it("strips symbols and builds initials from cleaned words", () => {
    expect(companyInitials("J&J")).toBe("JJ");
    expect(companyInitials("AT&T")).toBe("AT");
    expect(companyInitials("Cognivance")).toBe("CO");
    expect(companyInitials("Atlas Partners")).toBe("AP");
    expect(companyInitials(" venkata sai ")).toBe("VS");
    expect(companyInitials("")).toBe("?");
  });
});

describe("companyInitialsHue", () => {
  it("is deterministic for the same seed", () => {
    expect(companyInitialsHue("co-1")).toBe(companyInitialsHue("co-1"));
    expect(companyInitialsHue("co-1")).not.toBe(companyInitialsHue("co-2"));
  });
});
