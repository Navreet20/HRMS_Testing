import { mapApiHttpError } from "@/shared/http/apiRequest";
import {
  toUserFacingApiMessage,
  userFacingApiError,
} from "@/shared/http/userFacingApiError";
import { mutationErrorMessage } from "@/shared/live/mutationError";

describe("toUserFacingApiMessage", () => {
  it("rewrites inactive org foreign keys without field names", () => {
    expect(toUserFacingApiMessage("400 departmentId is not Active")).toBe(
      "That department is not active. Pick another from the list.",
    );
    expect(toUserFacingApiMessage("locationId is not Active")).toBe(
      "That office location is not active. Pick another from the list.",
    );
    expect(toUserFacingApiMessage("designationId is not Active")).toBe(
      "That job title is not active. Pick another from the list.",
    );
  });

  it("maps national ID and skill hire errors without field names", () => {
    expect(
      toUserFacingApiMessage("400 nationality is required when setting national ID fields"),
    ).toBe("Select nationality before a government ID type.");
    expect(toUserFacingApiMessage("That skill was not found.")).toMatch(
      /pick another from the list/i,
    );
    expect(toUserFacingApiMessage("400 dateOfBirth cannot be in the future")).toBe(
      "Date of birth can't be in the future.",
    );
  });

  it("maps permanent-delete and system-account blocks", () => {
    expect(
      toUserFacingApiMessage(
        "409 Cannot permanently delete this employee because related records still reference them. Deactivate instead.",
      ),
    ).toMatch(/reassign their reports/i);
    expect(
      toUserFacingApiMessage("403 System accounts cannot be deactivated or deleted"),
    ).toBe("System accounts cannot be offboarded or deleted.");
    expect(
      toUserFacingApiMessage("403 System accounts cannot be offboarded or deleted"),
    ).toBe("System accounts cannot be offboarded or deleted.");
  });

  it("passes through hard-delete blocks for reports and department head", () => {
    const reports =
      "409 Cannot permanently delete this employee because 2 employee(s) still report to them (Ada Lovelace, Grace Hopper). Reassign those employees to another manager, then try deleting again.";
    expect(toUserFacingApiMessage(reports)).toMatch(
      /reassign those employees to another manager/i,
    );
    expect(mutationErrorMessage(new Error(reports))).toMatch(
      /Ada Lovelace.*Grace Hopper/i,
    );

    const deptHead =
      "409 Cannot permanently delete this employee because they are the head of 1 department(s) (Engineering). Assign another department head first, then try deleting again.";
    expect(toUserFacingApiMessage(deptHead)).toMatch(
      /assign another department head first/i,
    );
    expect(mutationErrorMessage(new Error(deptHead))).not.toMatch(
      /something went wrong/i,
    );
  });

  it("surfaces login 429 copy instead of a generic 500", () => {
    expect(
      toUserFacingApiMessage(
        "429 Too many failed sign-in attempts. Try again in 15 minutes.",
      ),
    ).toBe("Too many failed sign-in attempts. Try again in 15 minutes.");
    expect(
      userFacingApiError(
        new Error("429 Too many failed sign-in attempts. Try again in 15 minutes."),
      ),
    ).toBe("Too many failed sign-in attempts. Try again in 15 minutes.");
    expect(
      toUserFacingApiMessage(
        "429 Too many failed sign-in attempts. Try again in 15 minutes.",
      ),
    ).not.toMatch(/something went wrong/i);
  });
});

describe("mapApiHttpError", () => {
  it("keeps the admin-only sentence from a 403 body", () => {
    const error = mapApiHttpError(
      new Error("403 You do not have access to create or change this. Ask an admin."),
    );
    expect(error.message).toBe(
      "You do not have access to create or change this. Ask an admin.",
    );
  });

  it("does not surface CSRF as a permission string", () => {
    const error = mapApiHttpError(new Error("403 CSRF validation failed"));
    expect(error.message).toMatch(/refresh the page/i);
    expect(error.message).not.toMatch(/csrf/i);
  });

  it("keeps login 429 detail instead of a generic failure", () => {
    const error = mapApiHttpError(
      new Error("429 Too many failed sign-in attempts. Try again in 15 minutes."),
    );
    expect(error.message).toBe(
      "Too many failed sign-in attempts. Try again in 15 minutes.",
    );
  });
});

describe("mutationErrorMessage", () => {
  it("maps gateway errors for hire-form toasts", () => {
    expect(
      mutationErrorMessage(new Error("400 departmentId is not Active")),
    ).toBe("That department is not active. Pick another from the list.");
  });

  it("surfaces invite SMTP failures instead of a generic 502", () => {
    expect(
      mutationErrorMessage(
        new Error(
          "502 Could not send the invite email. Mail server rejected the login. Check SMTP_USER and SMTP_PASS.",
        ),
      ),
    ).toMatch(/could not send the invite email/i);
    expect(
      mutationErrorMessage(
        new Error(
          "503 Invite email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL.",
        ),
      ),
    ).toMatch(/smtp settings/i);
  });
});

describe("userFacingApiError", () => {
  it("rewrites assigned-employee blocks without leaking stack text", () => {
    expect(
      toUserFacingApiMessage("400 Department is assigned to 3 employee(s)"),
    ).toMatch(/assigned to 3 employee/i);
    expect(toUserFacingApiMessage("Department has child departments")).toMatch(
      /child departments/i,
    );
    expect(toUserFacingApiMessage("500 Internal Server Error")).toMatch(
      /try again/i,
    );
    expect(toUserFacingApiMessage("403 CSRF validation failed")).toMatch(
      /refresh the page/i,
    );
  });

  it("passes through already-friendly backend sentences", () => {
    expect(
      userFacingApiError(new Error("A department with this name already exists.")),
    ).toBe("A department with this name already exists.");
    expect(
      userFacingApiError(
        new Error("You do not have access to create or change this. Ask an admin."),
      ),
    ).toMatch(/ask an admin/i);
  });
});
