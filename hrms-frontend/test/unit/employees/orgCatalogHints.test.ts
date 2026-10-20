import { emptyOrgCatalogHint } from "@/modules/employees/orgCatalogHints";

describe("emptyOrgCatalogHint", () => {
  it("tells HR to ask an admin when a catalog is empty", () => {
    expect(emptyOrgCatalogHint("department")).toMatch(/ask an admin/i);
    expect(emptyOrgCatalogHint("location")).toMatch(/office locations/i);
    expect(emptyOrgCatalogHint("designation")).toMatch(/job titles/i);
    expect(emptyOrgCatalogHint("skill")).toMatch(/skills/i);
    expect(emptyOrgCatalogHint("nationalIdType")).toMatch(/government id types/i);
  });
});
