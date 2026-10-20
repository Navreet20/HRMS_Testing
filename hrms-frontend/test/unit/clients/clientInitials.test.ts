import { initialsFor } from "@/modules/clients/clientInitials";

describe("initialsFor", () => {
  it("strips symbols and builds initials from cleaned words", () => {
    expect(initialsFor("J&J")).toBe("JJ");
    expect(initialsFor("AT&T")).toBe("AT");
    expect(initialsFor("arohak Inc")).toBe("AI");
    expect(initialsFor("costco")).toBe("CO");
    expect(initialsFor("venkata sai")).toBe("VS");
    expect(initialsFor(" Costco Wholesale ")).toBe("CW");
    expect(initialsFor("")).toBe("?");
  });
});
