import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createDefaultActor,
  FULL_ACCESS_FLAGS,
} from "@/modules/employees/constants";
import { EmployeesModule } from "@/modules/employees/EmployeesModule";
import { Z } from "@/ui/zIndex";
import {
  createFixtureEmployeesGateway,
  FIXTURE_EMPLOYEES_DATA,
} from "../../support/employees/fixtures";
import {
  continueCreateEmployeeWizard,
  createEmployeeForm,
  fillCreateEmployeePersonalStep,
  openCreateEmployeeWizard,
} from "../../support/employees/testUtils";

jest.setTimeout(25_000 );


const ARBITRARY_Z = /\bz-\[(\d+)\]/;
const STANDARD_Z = /\bz-(0|10|20|30|40|50|60|70)\b/;

/** z-index taken from the node's own classes/inline style — not from Z. */
function stackingZIndex(element: HTMLElement): number {
  const inline = element.style.zIndex.trim();
  if (/^-?\d+$/.test(inline)) {
    return Number(inline);
  }
  const className =
    typeof element.className === "string" ? element.className : "";
  const arbitrary = className.match(ARBITRARY_Z);
  if (arbitrary) {
    return Number(arbitrary[1]);
  }
  const standard = className.match(STANDARD_Z);
  if (standard) {
    return Number(standard[1]);
  }
  const computed = Number.parseInt(getComputedStyle(element).zIndex, 10);
  return Number.isFinite(computed) ? computed : 0;
}

function effectiveStackingZ(element: HTMLElement): number {
  let current: HTMLElement | null = element;
  while (current) {
    const z = stackingZIndex(current);
    if (z !== 0) {
      return z;
    }
    current = current.parentElement;
  }
  return 0;
}

function mockBox(
  element: HTMLElement,
  box: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
): void {
  const rect = {
    x: box.left,
    y: box.top,
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON() {
      return this;
    },
  } as DOMRect;
  element.getBoundingClientRect = () => rect;
}

let restoreElementFromPoint: (() => void) | undefined;

/**
 * jsdom does not composite CSS stacking. Replace elementFromPoint with a
 * stacking-context walk that reads each node's own z-index so a menu at
 * z-[80] loses to an overlay at z-[1000].
 */
function installStackingElementFromPoint(): void {
  const previous = document.elementFromPoint;
  document.elementFromPoint = (x: number, y: number) => {
    const candidates = Array.from(
      document.body.querySelectorAll<HTMLElement>("*"),
    );
    const covering = candidates.filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        x >= rect.left &&
        x < rect.right &&
        y >= rect.top &&
        y < rect.bottom
      );
    });
    covering.sort((left, right) => {
      const zDiff = effectiveStackingZ(left) - effectiveStackingZ(right);
      if (zDiff !== 0) {
        return zDiff;
      }
      const position = left.compareDocumentPosition(right);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    if (covering.length > 0) {
      return covering.at(-1) ?? null;
    }
    if (typeof previous === "function") {
      return previous.call(document, x, y);
    }
    return null;
  };
  restoreElementFromPoint = () => {
    if (typeof previous === "function") {
      document.elementFromPoint = previous;
      return;
    }
    Reflect.deleteProperty(document, "elementFromPoint");
  };
}

afterEach(() => {
  restoreElementFromPoint?.();
  restoreElementFromPoint = undefined;
});

function paintOverlappingStack(
  overlay: HTMLElement,
  menu: HTMLElement,
  option: HTMLElement,
): { readonly x: number; readonly y: number } {
  const overlayBox = { left: 0, top: 0, width: 800, height: 600 };
  const menuBox = { left: 200, top: 180, width: 240, height: 200 };
  const optionBox = { left: 200, top: 180, width: 240, height: 40 };
  mockBox(overlay, overlayBox);
  mockBox(menu, menuBox);
  mockBox(option, optionBox);

  overlay.style.position = "fixed";
  overlay.style.zIndex = String(stackingZIndex(overlay));
  menu.style.position = "fixed";
  menu.style.zIndex = String(stackingZIndex(menu));

  return {
    x: optionBox.left + optionBox.width / 2,
    y: optionBox.top + optionBox.height / 2,
  };
}

describe("Add Employee overlay vs EmployeesSelect stacking", () => {
  it("hit-tests the overlay when a menu is z-[80] under a z-[1000] overlay", () => {
    installStackingElementFromPoint();

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[1000]";
    const menu = document.createElement("ul");
    menu.className = "fixed z-[80]";
    const option = document.createElement("button");
    option.type = "button";
    option.setAttribute("role", "option");
    option.textContent = "Delivery";
    menu.appendChild(option);
    document.body.append(overlay, menu);

    const point = paintOverlappingStack(overlay, menu, option);
    const hit = document.elementFromPoint(point.x, point.y);

    expect(Number(getComputedStyle(menu).zIndex)).toBeLessThan(
      Number(getComputedStyle(overlay).zIndex),
    );
    expect(hit === overlay || overlay.contains(hit)).toBe(true);
    expect(menu.contains(hit)).toBe(false);

    overlay.remove();
    menu.remove();
  });

  it("opens the Department menu above the Add Employee overlay", async () => {
    const user = userEvent.setup();
    render(
      <EmployeesModule
        actor={createDefaultActor("ADMIN", { accessFlags: FULL_ACCESS_FLAGS })}
        defaultData={FIXTURE_EMPLOYEES_DATA}
        gateway={createFixtureEmployeesGateway()}
        theme="light"
      />,
    );

    await openCreateEmployeeWizard(user);
    await fillCreateEmployeePersonalStep(user);
    await continueCreateEmployeeWizard(user);

    const form = createEmployeeForm();
    const department = await form.findByRole("combobox", { name: /^department$/i });
    await user.click(department);

    const overlay = document.querySelector<HTMLElement>(
      "[data-create-employee-overlay]",
    );
    expect(overlay).toBeTruthy();
    const menu = await screen.findByRole("listbox", { name: /^department$/i });
    const option = await screen.findByRole("option", { name: /delivery/i });
    // Inline cascade portals the listbox directly to body.
    expect(menu.parentElement).toBe(document.body);
    expect(overlay?.contains(menu)).toBe(false);

    const menuZ = stackingZIndex(menu);
    const overlayZ = stackingZIndex(overlay as HTMLElement);
    expect(overlayZ).toBe(Z.modal);
    expect(menuZ).toBe(Z.menu);
    expect(menuZ).toBeGreaterThan(overlayZ);

    installStackingElementFromPoint();
    const point = paintOverlappingStack(
      overlay as HTMLElement,
      menu,
      option,
    );
    expect(Number(getComputedStyle(menu).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(overlay as HTMLElement).zIndex),
    );

    const hit = document.elementFromPoint(point.x, point.y);
    expect(hit).toBeTruthy();
    expect(menu.contains(hit) || hit === menu).toBe(true);
    expect(
      hit === overlay ||
        (overlay?.contains(hit) && !menu.contains(hit)),
    ).toBe(false);
  });
});
