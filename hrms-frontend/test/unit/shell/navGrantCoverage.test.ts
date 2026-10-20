import {
  GRANT_CATALOG_NAV_IDS,
  isGrantCatalogNavId,
} from "../../../src/shared/accessGrants";
import {
  NAV_CATALOG,
  ROLE_GATED_NAV_IDS,
  canAccessNavItem,
  type SidebarNavItemId,
} from "../../../src/shell/navPolicy";

const navIds = Object.keys(NAV_CATALOG) as SidebarNavItemId[];

describe("nav grant coverage", () => {
  it("classifies every sidebar item as grant-gated or role-gated", () => {
    const unclassified = navIds.filter(
      (id) => !isGrantCatalogNavId(id) && !ROLE_GATED_NAV_IDS.includes(id),
    );
    expect(unclassified).toEqual([]);
  });

  it("never lists an item as both grant-gated and role-gated", () => {
    expect(ROLE_GATED_NAV_IDS.filter((id) => isGrantCatalogNavId(id))).toEqual(
      [],
    );
    expect(new Set(ROLE_GATED_NAV_IDS).size).toBe(ROLE_GATED_NAV_IDS.length);
  });

  it("only has grant rules for real sidebar items", () => {
    expect(
      GRANT_CATALOG_NAV_IDS.filter((id) => !(id in NAV_CATALOG)),
    ).toEqual([]);
  });

  it("hides every grant-gated item (except Dashboard) when the session has no grants", () => {
    const visible = GRANT_CATALOG_NAV_IDS.filter((id) =>
      canAccessNavItem("ADMIN", id, []),
    );
    expect(visible).toEqual(["dashboard"]);
  });
});
