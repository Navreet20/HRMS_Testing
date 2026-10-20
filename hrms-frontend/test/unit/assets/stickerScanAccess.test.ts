import { resolveEnabledModules } from "@/shared";
import {
  ASSET_STICKER_NO_ACCESS_COPY,
  ASSET_STICKER_NO_ACCESS_TITLE,
  allocationMatchesStickerQuery,
  hrefWithoutAssetStickerQuery,
  isAssetStickerScanPath,
  resolvePostSignInLocation,
} from "@/modules/assets/stickerScanAccess";

const enabled = resolveEnabledModules("full");

describe("sticker scan access", () => {
  it("uses the agreed no-access copy with no person name", () => {
    expect(ASSET_STICKER_NO_ACCESS_COPY).toBe(
      "You don't have access to this asset.",
    );
    expect(ASSET_STICKER_NO_ACCESS_COPY).not.toMatch(/assigned to/i);
    expect(ASSET_STICKER_NO_ACCESS_TITLE).toBe("Access denied");
  });

  it("strips sticker q and keeps other search params", () => {
    expect(hrefWithoutAssetStickerQuery("/profile", "?q=COG-LAP-0001")).toBe(
      "/profile",
    );
    expect(
      hrefWithoutAssetStickerQuery("/profile", "?sku=full&q=COG-LAP-0001"),
    ).toBe("/profile?sku=full");
    expect(hrefWithoutAssetStickerQuery("/profile", "?sku=full")).toBe(
      "/profile?sku=full",
    );
    expect(hrefWithoutAssetStickerQuery("", "?q=COG-LAP-0001")).toBe("/");
  });

  it("detects /assets?q= sticker scans only", () => {
    expect(isAssetStickerScanPath("/assets", "?q=COG-LAP-0001")).toBe(true);
    expect(isAssetStickerScanPath("/assets", "?q=")).toBe(false);
    expect(isAssetStickerScanPath("/assets", "")).toBe(false);
    expect(isAssetStickerScanPath("/profile", "?q=COG-LAP-0001")).toBe(false);
    expect(isAssetStickerScanPath("/", "?q=COG-LAP-0001")).toBe(false);
  });

  it("matches assigned Asset IDs case-insensitively", () => {
    expect(
      allocationMatchesStickerQuery(
        [{ assetId: "COG-LAP-0001" }],
        "  cog-lap-0001  ",
      ),
    ).toBe(true);
    expect(
      allocationMatchesStickerQuery([{ assetId: "COG-LAP-0001" }], "COG-KEY-0001"),
    ).toBe(false);
    expect(allocationMatchesStickerQuery([{ assetId: "COG-LAP-0001" }], "")).toBe(
      false,
    );
    expect(
      allocationMatchesStickerQuery([{ assetId: null }], "COG-LAP-0001"),
    ).toBe(false);
  });

  it("resumes Asset management for HR after a sticker scan login", () => {
    expect(
      resolvePostSignInLocation({
        role: "HR",
        enabledModules: enabled,
        pathname: "/assets",
        search: "?q=COG-LAP-0001",
      }),
    ).toEqual({ nav: "assets" });
    expect(
      resolvePostSignInLocation({
        role: "ADMIN",
        enabledModules: enabled,
        pathname: "/assets",
        search: "?q=COG-LAP-0001",
      }),
    ).toEqual({ nav: "assets" });
  });

  it("sends employees to Dashboard instead of Asset management", () => {
    expect(
      resolvePostSignInLocation({
        role: "EMPLOYEE",
        enabledModules: enabled,
        pathname: "/assets",
        search: "?q=COG-LAP-0001",
      }),
    ).toEqual({ nav: "dashboard" });
  });

  it("sends incomplete Employee My Profiles to /profile instead of Dashboard", () => {
    expect(
      resolvePostSignInLocation({
        role: "EMPLOYEE",
        enabledModules: enabled,
        pathname: "/",
        search: "",
        myProfileComplete: false,
      }),
    ).toEqual({ nav: "profile" });
  });

  it("never redirects non-Employee roles to Profile for incomplete profiles", () => {
    for (const role of [
      "HR",
      "ADMIN",
      "SUPERADMIN",
      "ACCOUNTANT",
      "IMMIGRATION",
      "ONBOARDING",
    ] as const) {
      expect(
        resolvePostSignInLocation({
          role,
          enabledModules: enabled,
          pathname: "/",
          search: "",
          myProfileComplete: false,
        }),
      ).toEqual({ nav: "dashboard" });
    }
  });

  it("keeps sticker deep-links ahead of incomplete-profile landing", () => {
    expect(
      resolvePostSignInLocation({
        role: "HR",
        enabledModules: enabled,
        pathname: "/assets",
        search: "?q=COG-LAP-0001",
        myProfileComplete: false,
      }),
    ).toEqual({ nav: "assets" });
  });

  it("uses role home when My Profile is complete", () => {
    expect(
      resolvePostSignInLocation({
        role: "EMPLOYEE",
        enabledModules: enabled,
        pathname: "/",
        search: "",
        myProfileComplete: true,
      }),
    ).toEqual({ nav: "dashboard" });
  });

  it("keeps the usual role home when there is no sticker q", () => {
    expect(
      resolvePostSignInLocation({
        role: "HR",
        enabledModules: enabled,
        pathname: "/assets",
        search: "",
      }),
    ).toEqual({ nav: "dashboard" });
    expect(
      resolvePostSignInLocation({
        role: "EMPLOYEE",
        enabledModules: enabled,
        pathname: "/",
        search: "?q=COG-LAP-0001",
      }),
    ).toEqual({ nav: "dashboard" });
  });
});
