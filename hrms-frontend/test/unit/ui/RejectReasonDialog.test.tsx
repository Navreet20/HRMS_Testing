import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppTextField, RejectReasonDialog } from "@/shared/ui";

describe("reject comment counter", () => {
  it("counts the characters used out of 255", async () => {
    const user = userEvent.setup();
    render(
      <RejectReasonDialog
        title="Reject timesheet"
        description="Rashmika"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("0 of 255 characters used")).toHaveTextContent("0/255");
    await user.type(screen.getByRole("textbox"), "Wrong project");
    expect(screen.getByLabelText("13 of 255 characters used")).toHaveTextContent("13/255");
  });

  it("turns amber near the limit and stops at 255", async () => {
    const user = userEvent.setup();
    render(<AppTextField label="Note" value={"x".repeat(240)} onChange={jest.fn()} maxLength={255} showCount />);
    expect(screen.getByLabelText("240 of 255 characters used")).toHaveClass("text-emp-warning");
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "255");
    void user;
  });

  it("shows no counter unless asked", () => {
    render(<AppTextField label="Note" value="abc" onChange={jest.fn()} maxLength={255} />);
    expect(screen.queryByText("3/255")).not.toBeInTheDocument();
  });
});
