import {
  canShowPersonaSwitcher,
  isPersonaSelectorRole,
  PERSONA_SELECTOR_LABELS,
  PERSONA_SELECTOR_ROLES,
} from "@/shared";

describe("sidebar switcher helpers", () => {
  it("lists the offline roles with labels", () => {
    expect(PERSONA_SELECTOR_ROLES).toEqual(["SUPERADMIN", "ADMIN", "HR"]);
    expect(PERSONA_SELECTOR_LABELS.SUPERADMIN).toBe("Superadmin");
    expect(isPersonaSelectorRole("HR")).toBe(true);
    expect(isPersonaSelectorRole("EMPLOYEE")).toBe(false);
  });

  it("shows the role switcher in offline dev shells only", () => {
    expect(
      canShowPersonaSwitcher({
        isDevBuild: true,
        liveApi: false,
        liveSession: false,
        viewCount: 0,
      }),
    ).toBe(true);
    expect(
      canShowPersonaSwitcher({
        isDevBuild: false,
        liveApi: false,
        liveSession: false,
        viewCount: 0,
      }),
    ).toBe(false);
  });

  it("shows the view switcher only for a live session with both views", () => {
    const live = { isDevBuild: false, liveApi: true, liveSession: true };
    expect(canShowPersonaSwitcher({ ...live, viewCount: 2 })).toBe(true);
    expect(canShowPersonaSwitcher({ ...live, viewCount: 0 })).toBe(false);
    expect(
      canShowPersonaSwitcher({ ...live, liveSession: false, viewCount: 2 }),
    ).toBe(false);
  });
});
