import { render } from "@testing-library/react";

import { HrmsTestApp } from "../../support/HrmsTestApp";

describe("App header height for sticky bars", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE;
    window.history.replaceState(null, "", "/?sku=full");
  });

  it("publishes --app-header-height once the header is on screen, and clears it after", () => {
    const { unmount } = render(<HrmsTestApp />);
    // jsdom has no layout, so the height is 0px; what matters is that it's set.
    expect(document.documentElement.style.getPropertyValue("--app-header-height")).toBe("0px");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--app-header-height")).toBe("");
  });
});
