import {
  estimateRowMenuHeight,
  placeRowMenuPanel,
} from "@/modules/assets/components/AssetRowActionsMenu";

function fakeRect(partial: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 28,
    height: 28,
    top: 0,
    left: 900,
    bottom: 28,
    right: 928,
    toJSON() {
      return this;
    },
    ...partial,
  };
}

function fakeTrigger(rect: Partial<DOMRect>, wrapBottom?: number): HTMLElement {
  const wrap =
    wrapBottom == null
      ? null
      : {
          getBoundingClientRect: () => fakeRect({ bottom: wrapBottom }),
        };
  return {
    getBoundingClientRect: () => fakeRect(rect),
    closest: (selector: string) =>
      selector === "[data-assets-table-wrap]" ? wrap : null,
  } as unknown as HTMLElement;
}

describe("placeRowMenuPanel", () => {
  const originalInnerHeight = window.innerHeight;
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
    document.body.innerHTML = "";
  });

  it("opens below the trigger when the table has room", () => {
    const trigger = fakeTrigger(
      { top: 80, bottom: 108, right: 928, left: 900 },
      700,
    );
    const pos = placeRowMenuPanel(trigger, null, 4);
    expect(pos.top).toBe(114);
  });

  it("flips above the trigger when the table/pagination would clip Decommission", () => {
    const pagination = document.createElement("div");
    pagination.setAttribute("role", "navigation");
    pagination.setAttribute("aria-label", "Assets pagination");
    pagination.getBoundingClientRect = () =>
      fakeRect({ top: 760, bottom: 800, left: 0, right: 1200 });
    document.body.appendChild(pagination);

    const trigger = fakeTrigger(
      { top: 720, bottom: 748, right: 928, left: 900 },
      756,
    );
    const height = estimateRowMenuHeight(5, { separator: true, hint: true });
    const pos = placeRowMenuPanel(trigger, null, 5, {
      separator: true,
      hint: true,
    });

    expect(pos.top + height).toBeLessThanOrEqual(748);
    expect(pos.top).toBeLessThan(720);
  });
});
