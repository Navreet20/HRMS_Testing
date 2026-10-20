import { act, fireEvent, render, screen } from "@testing-library/react";

import { AppScrollRevealBar } from "@/shared/ui";

function setScroll(y: number, anchorTop: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ top: anchorTop, left: 0, width: 800, height: 40 } as DOMRect);
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

function bar() {
  return screen.getByRole("button", { name: "Leaves", hidden: true }).closest("div")!;
}

describe("AppScrollRevealBar", () => {
  beforeEach(() => {
    // Fake timers also drive requestAnimationFrame.
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("stays in place, tucks away after scrolling past, and comes back on scroll up", () => {
    setScroll(0, 100);
    render(
      <AppScrollRevealBar>
        <button type="button">Leaves</button>
      </AppScrollRevealBar>,
    );
    // In its normal place: a plain, visible bar.
    expect(screen.getByRole("button", { name: "Leaves" })).toBeVisible();
    expect(bar().className).not.toContain("fixed");

    // Scrolled past: floats under the header, hidden.
    setScroll(600, -300);
    expect(bar().className).toContain("fixed");
    expect(bar().className).toContain("-translate-y-full");

    // A small scroll up brings it back (after one frame, so it slides in).
    setScroll(560, -260);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(bar().className).toContain("translate-y-0");

    // Scrolling down tucks it away again.
    setScroll(700, -400);
    expect(bar().className).toContain("-translate-y-full");

    // Pointing at the strip under the header (mouse users) reveals it.
    const strip = document.querySelector('div[aria-hidden="true"].fixed.h-\\[1\\.25rem\\]')!;
    fireEvent.mouseEnter(strip);
    expect(bar().className).toContain("translate-y-0");

    // Back at the top: in its normal place again.
    setScroll(0, 100);
    expect(bar().className).not.toContain("fixed");
  });

  it("keeps the same bar element (no rebuild) when it starts and stops floating", () => {
    setScroll(0, 100);
    render(
      <AppScrollRevealBar>
        <button type="button">Leaves</button>
      </AppScrollRevealBar>,
    );
    const before = screen.getByRole("button", { name: "Leaves" });
    setScroll(600, -300);
    setScroll(0, 100);
    expect(screen.getByRole("button", { name: "Leaves" })).toBe(before);
  });
});
