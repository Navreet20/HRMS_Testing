import {
  employeesNoticeDescription,
  employeesNoticeTitle,
  inferEmployeesNoticeVariant,
} from "@/modules/employees/employeesNoticeCopy";

describe("employeesNoticeCopy", () => {
  it("treats profile save as success", () => {
    expect(inferEmployeesNoticeVariant("Profile saved.")).toBe("success");
    expect(employeesNoticeTitle("Profile saved.")).toBe("Profile saved");
    expect(
      employeesNoticeDescription("Profile saved.", "Profile saved"),
    ).toBeUndefined();
  });

  it("treats gateway and not-found copy as errors", () => {
    expect(inferEmployeesNoticeVariant("Live API gateway is required.")).toBe(
      "error",
    );
    expect(employeesNoticeTitle("Live API gateway is required.")).toBe(
      "Connection unavailable",
    );
    expect(inferEmployeesNoticeVariant("Employee not found.")).toBe("error");
  });

  it("maps long success messages to titles with descriptions", () => {
    const message =
      "Role updated. Jane Doe will need to sign out and back in for the new permissions to take effect.";
    expect(employeesNoticeTitle(message)).toBe("Role updated");
    expect(employeesNoticeDescription(message, "Role updated")).toBe(message);
  });

  it("maps invite and draft notices", () => {
    expect(
      employeesNoticeTitle("Invited Alex Chen as Pending."),
    ).toBe("Invite sent");
    expect(
      employeesNoticeTitle(
        "Alex Chen is saved as draft with employee code EMP-001.",
      ),
    ).toBe("Draft saved");
  });
});
