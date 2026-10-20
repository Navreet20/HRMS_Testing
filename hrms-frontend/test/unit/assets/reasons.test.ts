import {
  RETURN_REASON_SELECT_OPTIONS,
  SWAP_REASON_SELECT_OPTIONS,
} from "@/modules/assets/constants";
import { assetStatusAfterReturn } from "@/modules/assets/selectors";
import { RETURN_REASONS, SWAP_REASONS } from "@/modules/assets/types";

describe("asset return vs swap reasons", () => {
  it("keeps Employee terminated on return only", () => {
    expect(RETURN_REASONS).toEqual(["Employee terminated", "Broken", "Other"]);
    expect(SWAP_REASONS).toEqual(["Broken", "Upgrade", "Other"]);
  });

  it("feeds AppSelect options from the matching reason set", () => {
    expect(RETURN_REASON_SELECT_OPTIONS.map((option) => option.value)).toEqual([
      ...RETURN_REASONS,
    ]);
    const swapValues: readonly string[] = SWAP_REASON_SELECT_OPTIONS.map(
      (option) => option.value,
    );
    expect(swapValues).toEqual([...SWAP_REASONS]);
    expect(swapValues).not.toContain("Employee terminated");
  });
});

describe("assetStatusAfterReturn", () => {
  it("sends Broken to Under Repair and other reasons to In Stock", () => {
    expect(assetStatusAfterReturn("Broken")).toBe("Under Repair");
    expect(assetStatusAfterReturn("broken")).toBe("Under Repair");
    expect(assetStatusAfterReturn("Other")).toBe("In Stock");
    expect(assetStatusAfterReturn("Employee terminated")).toBe("In Stock");
    expect(assetStatusAfterReturn("Upgrade")).toBe("In Stock");
  });
});
