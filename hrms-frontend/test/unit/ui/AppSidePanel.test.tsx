import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppSidePanel } from "@/shared/ui";

describe("AppSidePanel", () => {
  it("renders nothing when closed", () => {
    render(
      <AppSidePanel open={false} title="Details" onClose={jest.fn()}>
        Body
      </AppSidePanel>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("is labelled by its title, takes focus, and closes via button or Escape", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <AppSidePanel open title="Details" onClose={onClose}>
        Body
      </AppSidePanel>,
    );

    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(panel).toHaveFocus();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close Details" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
