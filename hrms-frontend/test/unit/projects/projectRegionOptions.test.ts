import { PROJECT_REGIONS } from "@/modules/projects/constants";
import { listProjectRegionOptions } from "@/modules/projects/projectRegionOptions";

describe("listProjectRegionOptions", () => {
  it("returns NA, EMEA, APAC, and LATAM without depending on a client", () => {
    expect(listProjectRegionOptions().map((option) => option.value)).toEqual([
      ...PROJECT_REGIONS,
    ]);
    expect(PROJECT_REGIONS).toEqual(["NA", "EMEA", "APAC", "LATAM"]);
  });
});
