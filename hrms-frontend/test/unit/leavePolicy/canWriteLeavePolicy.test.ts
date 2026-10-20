import { canWriteLeavePolicy } from "@/modules/leavePolicy";
import type { SessionAccessGrant } from "@/shared";

const leavePolicy = (accessLevel: SessionAccessGrant["accessLevel"]): SessionAccessGrant => ({
  moduleKey: "companySetup",
  submoduleKey: "leavePolicy",
  accessLevel,
});

describe("canWriteLeavePolicy", () => {
  it("View only grant is read-only, even for HR / Admin roles", () => {
    expect(canWriteLeavePolicy("EMPLOYEE", [leavePolicy("read_only")])).toBe(false);
    expect(canWriteLeavePolicy("ADMIN", [leavePolicy("read_only")])).toBe(false);
  });

  it("Full access grant can write", () => {
    expect(canWriteLeavePolicy("EMPLOYEE", [leavePolicy("full_access")])).toBe(true);
  });

  it("without a Leave Policy grant, falls back to HR / Admin roles", () => {
    const otherGrant: SessionAccessGrant = {
      moduleKey: "companySetup",
      submoduleKey: "departments",
      accessLevel: "full_access",
    };
    expect(canWriteLeavePolicy("HR", [otherGrant])).toBe(true);
    expect(canWriteLeavePolicy("EMPLOYEE", [otherGrant])).toBe(false);
    expect(canWriteLeavePolicy("ADMIN", null)).toBe(true);
  });
});
