import { render, screen, within } from "@testing-library/react";
import { AuthPageFrame } from "@/shell/AuthPageFrame";

describe("AuthPageFrame", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    delete document.body.dataset.theme;
    document.documentElement.classList.remove("dark", "eaova-login");
    document.body.classList.remove("dark", "eaova-login");
  });

  it("is always light, shows the wordmark, and has no theme toggle", () => {
    document.documentElement.dataset.theme = "dark";
    document.body.dataset.theme = "dark";
    document.documentElement.classList.add("dark");

    const { container } = render(
      <AuthPageFrame>
        <p>Sign in</p>
      </AuthPageFrame>,
    );

    const shell = container.querySelector("[data-auth-page]");
    expect(shell).toHaveAttribute("data-theme", "light");
    expect(shell?.className).toContain(
      "lg:grid-cols-[minmax(0,1fr)_minmax(28rem,32rem)]",
    );
    expect(container.querySelector("aside")?.className).toContain(
      "items-center",
    );
    const brandStack = container.querySelector("[data-auth-brand-stack]");
    expect(brandStack).toBeTruthy();
    const tagline = within(brandStack as HTMLElement).getByText(
      "People operations, in one place.",
    );
    expect(tagline.className).toContain("text-ds-ink-muted");
    expect(shell?.className).toContain("bg-ds-surface");
    expect(screen.getByText("EAOVA")).toBeInTheDocument();
    expect(brandStack).toHaveTextContent("EAOVA");
    expect(brandStack).toHaveTextContent("People operations, in one place.");
    // The wordmark sits above the form, not in the illustrated panel.
    expect(container.querySelector("aside")).not.toContainElement(
      brandStack as HTMLElement,
    );
    expect(brandStack?.nextElementSibling).toHaveTextContent("Sign in");
    const carousel = container.querySelector("[data-login-feature-carousel]");
    expect(carousel).toBeInTheDocument();
    expect(container.querySelector("aside")).toContainElement(
      carousel as HTMLElement,
    );
    expect(
      screen.getByRole("button", { name: "Slide 1 of 4" }),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-auth-brand-footer]")).toBeNull();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /^theme$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /light theme/i }),
    ).not.toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.body.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("eaova-login")).toBe(true);
    expect(document.body.classList.contains("eaova-login")).toBe(true);
  });

  it("forces light even when a leftover in-app dark theme is on the document", () => {
    document.documentElement.dataset.theme = "dark";
    document.body.dataset.theme = "dark";
    document.documentElement.classList.add("dark");

    const { container } = render(
      <AuthPageFrame>
        <p>Sign in</p>
      </AuthPageFrame>,
    );

    expect(container.querySelector("[data-auth-page]")).toHaveAttribute(
      "data-theme",
      "light",
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.body.classList.contains("dark")).toBe(false);
  });
});
