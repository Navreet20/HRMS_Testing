import { resolveEnabledModules } from "@/shared";
import {
  pickRoleLandingNav,
  resolveRoleHomeLocation,
} from "@/shell/navPolicy";

describe("resolveRoleHomeLocation", () => {
  it("sends EMPLOYEE to Dashboard after sign-in", () => {
    const enabled = resolveEnabledModules("full");
    expect(resolveRoleHomeLocation("EMPLOYEE", enabled)).toEqual({
      nav: "dashboard",
    });
    expect(pickRoleLandingNav("EMPLOYEE", enabled)).toBe("dashboard");
  });

  it("keeps staff roles on their normal landing module", () => {
    const enabled = resolveEnabledModules("full");
    expect(resolveRoleHomeLocation("HR", enabled)).toEqual({
      nav: "dashboard",
    });
    expect(resolveRoleHomeLocation("ADMIN", enabled)).toEqual({
      nav: "dashboard",
    });
  });
});
