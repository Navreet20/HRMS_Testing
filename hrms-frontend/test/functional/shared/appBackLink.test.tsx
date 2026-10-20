import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppBackLink, AppBreadcrumb } from "@/shared/ui";
import { APP_SHELL_NAV_TRAIL_ID } from "@/shared/ui/shellNavTrail";

describe("AppBackLink", () => {
  it("is a text control labeled Back to the parent view", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<AppBackLink onClick={onClick}>Employees</AppBackLink>);

    const back = screen.getByRole("button", { name: "Back to Employees" });
    expect(back).toHaveTextContent("Employees");
    expect(back).toHaveClass("app-back-link");
    expect(back.className).not.toMatch(/border-emp-line|min-h-\[2/);
    await user.click(back);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders into the shell header trail when the host exists", () => {
    const host = document.createElement("div");
    host.id = APP_SHELL_NAV_TRAIL_ID;
    document.body.appendChild(host);
    const { unmount } = render(
      <AppBackLink onClick={jest.fn()}>Employees</AppBackLink>,
    );
    expect(host.querySelector(".app-back-link")).toHaveTextContent("Employees");
    unmount();
    host.remove();
  });
});

describe("AppBreadcrumb", () => {
  it("collapses two levels to a back link", () => {
    render(
      <AppBreadcrumb
        items={[
          { label: "Assets", onClick: jest.fn() },
          { label: "COG-LAP-0001" },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Back to Assets" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  it("shows a hierarchy trail for three levels", async () => {
    const user = userEvent.setup();
    const onClients = jest.fn();
    const onClient = jest.fn();
    render(
      <AppBreadcrumb
        items={[
          { label: "Clients", onClick: onClients },
          { label: "Nexus Healthcare", onClick: onClient },
          { label: "Platform Modernization" },
        ]}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to Clients" }));
    expect(onClients).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Back to Nexus Healthcare" }),
    );
    expect(onClient).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Platform Modernization")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
