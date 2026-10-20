import {
  accessFlagsForGrantLevel,
  grantAllowsWrite,
  mergeAccessFlagsWithGrant,
  resolveGrantAccessLevel,
} from "../../../src/shared/accessGrants";
import { canWriteAssets } from "../../../src/modules/assets/selectors";
import { canCreateClient } from "../../../src/modules/clients/selectors";
import { createDefaultActor as createClientsActor } from "../../../src/modules/clients/constants";
import { canManageOrgCatalogs } from "../../../src/modules/org/selectors";

describe("DATA-4 grant access levels", () => {
  it("maps read_only to view-only flags and full_access to mutate flags", () => {
    expect(accessFlagsForGrantLevel("read_only")).toEqual({
      createAccess: false,
      editAccess: false,
      viewAccess: true,
      fullAccess: false,
    });
    expect(accessFlagsForGrantLevel("full_access").fullAccess).toBe(true);
    expect(accessFlagsForGrantLevel(null).viewAccess).toBe(false);
  });

  it("mergeAccessFlagsWithGrant is grant-only once session has grants (DATA-8)", () => {
    const roleFlags = {
      createAccess: true,
      editAccess: true,
      viewAccess: true,
      fullAccess: true,
    };
    const readOnly = mergeAccessFlagsWithGrant(
      roleFlags,
      [{ moduleKey: "customers", accessLevel: "read_only" }],
      "customers",
    );
    expect(readOnly.createAccess).toBe(false);
    expect(readOnly.viewAccess).toBe(true);

    // Other module missing while session has grants → deny.
    const noCustomers = mergeAccessFlagsWithGrant(
      roleFlags,
      [{ moduleKey: "companySetup", accessLevel: "full_access" }],
      "customers",
    );
    expect(noCustomers.viewAccess).toBe(false);

    // Empty grants → keep role flags (offline soft cutover).
    const empty = mergeAccessFlagsWithGrant(roleFlags, [], "customers");
    expect(empty).toEqual(roleFlags);
  });

  it("hides client create when customers grant is read_only", () => {
    const actor = createClientsActor("HR", {
      accessFlags: mergeAccessFlagsWithGrant(
        {
          createAccess: true,
          editAccess: true,
          viewAccess: true,
          fullAccess: true,
        },
        [{ moduleKey: "customers", accessLevel: "read_only" }],
        "customers",
      ),
    });
    expect(canCreateClient(actor)).toBe(false);
  });

  it("blocks asset writes for read_only assets grant", () => {
    expect(
      canWriteAssets("HR", [
        { moduleKey: "assets", accessLevel: "read_only" },
      ]),
    ).toBe(false);
    expect(
      canWriteAssets("HR", [
        { moduleKey: "assets", accessLevel: "full_access" },
      ]),
    ).toBe(true);
    // Session grants loaded but empty → deny (DATA-8 grant-only).
    expect(canWriteAssets("HR", [])).toBe(false);
    // Grants omitted → legacy role (unit tests / soft cutover).
    expect(canWriteAssets("HR")).toBe(true);
  });

  it("blocks org catalog writes for companySetup read_only", () => {
    expect(
      canManageOrgCatalogs(
        { role: "SUPERADMIN" },
        [{ moduleKey: "companySetup", accessLevel: "read_only" }],
      ),
    ).toBe(false);
    expect(grantAllowsWrite(
      [{ moduleKey: "companySetup", accessLevel: "full_access" }],
      "companySetup",
    )).toBe(true);
    expect(
      resolveGrantAccessLevel(
        [
          {
            moduleKey: "employees",
            submoduleKey: "onboarding",
            accessLevel: "full_access",
          },
        ],
        "employees",
        "onboarding",
      ),
    ).toBe("full_access");
  });
});
