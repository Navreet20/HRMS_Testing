import { render, screen } from "@testing-library/react";

import {
  AppHoverHint,
  ClickToViewHint,
  CLICK_TO_VIEW_HINT,
} from "@/shared/ui";

describe("ClickToViewHint", () => {
  it("uses the shared Click to view copy inside a group card", () => {
    render(
      <article className="group relative">
        <ClickToViewHint />
        <p>Nexus Healthcare</p>
      </article>,
    );

    expect(screen.getByText(CLICK_TO_VIEW_HINT)).toHaveAttribute(
      "role",
      "tooltip",
    );
    expect(CLICK_TO_VIEW_HINT).toBe("Click to view");
  });

  it("renders a custom hover label with the same surface tooltip", () => {
    render(
      <div className="group relative">
        <AppHoverHint label="No assets in this category" align="start" />
      </div>,
    );

    expect(screen.getByText("No assets in this category")).toHaveAttribute(
      "role",
      "tooltip",
    );
  });
});
