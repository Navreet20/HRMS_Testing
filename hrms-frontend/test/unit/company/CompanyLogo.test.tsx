import { fireEvent, render, screen } from "@testing-library/react";

import { CompanyLogo } from "@/modules/company/components/CompanyLogo";
import { companyInitialsHue } from "@/modules/company/companyInitials";

describe("CompanyLogo", () => {
  it("renders the image only when logoUrl loads", () => {
    const { container } = render(
      <CompanyLogo
        logoUrl="blob:http://test/logo"
        companyName="Cognivance"
        companyId="co-1"
        size="medium"
      />,
    );

    const image = screen.getByRole("img", { name: "Cognivance" });
    expect(image).toHaveAttribute("src", "blob:http://test/logo");
    expect(image).toHaveAttribute("title", "Cognivance");
    expect(image).toHaveAttribute("alt", "Cognivance");
    expect(container.querySelector('[data-tile="contrast"]')).not.toBeNull();
    expect(
      container.querySelector('[data-slot="company-logo-name"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="company-logo-initials"]'),
    ).toBeNull();
  });

  it("renders the company name in the same slot when logoUrl is missing", () => {
    const { container } = render(
      <CompanyLogo companyName="Cognivance" companyId="co-1" />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    const name = container.querySelector('[data-slot="company-logo-name"]');
    expect(name).toHaveTextContent("Cognivance");
    expect(container.firstChild).toHaveAttribute("title", "Cognivance");
    expect(
      container.querySelector('[data-tile="contrast"]'),
    ).toBeNull();
  });

  it("uses initials in compact slots when there is no logo", () => {
    const { container } = render(
      <CompanyLogo
        companyName="Cognivance"
        companyId="co-1"
        size="small"
        compact
      />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    const initials = container.querySelector('[data-slot="company-logo-initials"]');
    expect(initials).toHaveTextContent("CO");
    expect(initials).toHaveAttribute("aria-label", "Cognivance");
    expect(initials).toHaveStyle({
      background: `hsl(${companyInitialsHue("co-1")} 42% 38%)`,
    });
    expect(
      container.querySelector('[data-slot="company-logo-name"]'),
    ).toBeNull();
  });

  it("keeps the same initials color for the same company id", () => {
    const { rerender, container } = render(
      <CompanyLogo companyName="Cognivance" companyId="co-1" compact />,
    );
    const first = container.querySelector(
      '[data-slot="company-logo-initials"]',
    ) as HTMLElement;
    const firstBg = first.style.background;

    rerender(<CompanyLogo companyName="Renamed Co" companyId="co-1" compact />);
    const second = container.querySelector(
      '[data-slot="company-logo-initials"]',
    ) as HTMLElement;
    expect(second.style.background).toBe(firstBg);
  });

  it("renders an empty dash, not the company name, when emptyDisplay is empty", () => {
    const { container } = render(
      <CompanyLogo
        companyName="Cognivance"
        companyId="co-1"
        emptyDisplay="empty"
      />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    expect(
      container.querySelector('[data-slot="company-logo-empty"]'),
    ).toHaveTextContent("—");
    expect(
      container.querySelector('[data-slot="company-logo-name"]'),
    ).toBeNull();
    expect(container).not.toHaveTextContent("Cognivance");
    expect(
      container.querySelector('[data-tile="contrast"]'),
    ).toBeNull();
  });

  it("swaps to the empty dash when a profile logo fails to load", () => {
    const { container } = render(
      <CompanyLogo
        logoUrl="blob:http://test/broken"
        companyName="Cognivance"
        companyId="co-1"
        emptyDisplay="empty"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Cognivance" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(
      container.querySelector('[data-slot="company-logo-empty"]'),
    ).toHaveTextContent("—");
    expect(container).not.toHaveTextContent("Cognivance");
  });
});
