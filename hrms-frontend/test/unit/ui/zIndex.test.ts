import { catalogUi as departmentsUi } from "@/shared/ui/catalogUi";
import { ui as employeesUi } from "@/modules/employees/uiClasses";
import { Z, zClass } from "@/ui/zIndex";

describe("z-index scale", () => {
  it("keeps body-portaled menus above modal and nested overlay", () => {
    expect(Z.overlay).toBe(40);
    expect(Z.toast).toBe(60);
    expect(Z.modal).toBe(1000);
    expect(Z.overlayNested).toBe(1100);
    expect(Z.menu).toBe(1200);
    expect(Z.tooltip).toBe(1300);

    expect(Z.menu).toBeGreaterThan(Z.overlayNested);
    expect(Z.overlayNested).toBeGreaterThan(Z.modal);
    expect(Z.modal).toBeGreaterThan(Z.toast);
    expect(Z.toast).toBeGreaterThan(Z.overlay);
  });

  it("keeps the sticky app header above page content but below overlays", () => {
    // Page content (e.g. AppTabs buttons at `local`) scrolls under the header.
    expect(Z.chrome).toBeGreaterThan(Z.local);
    expect(Z.chrome).toBeGreaterThan(Z.dropdownLocal);
    expect(Z.chrome).toBeLessThan(Z.overlay);
    // In-page sticky bars (portal tabs) stay above content but under the header.
    expect(Z.pageSticky).toBeGreaterThan(Z.dropdownLocal);
    expect(Z.pageSticky).toBeLessThan(Z.chrome);
    expect(zClass.chrome).toBe("z-30");
  });

  it("wires employee create overlay and portaled menus to the scale", () => {
    expect(employeesUi.createOverlay).toContain(zClass.modal);
    expect(employeesUi.overlayNested).toContain(zClass.overlayNested);
    expect(employeesUi.selectMenu).toContain(zClass.menu);
    expect(employeesUi.rowMenuPanel).toContain(zClass.menu);
    expect(employeesUi.overlay).toContain(zClass.modal);
  });

  it("wires catalog portaled menus to the same menu layer", () => {
    expect(departmentsUi.selectMenu).toContain(zClass.menu);
    expect(departmentsUi.rowMenuPanel).toContain(zClass.menu);
    expect(departmentsUi.overlay).toContain(zClass.modal);
    expect(departmentsUi.overlayNested).toContain(zClass.overlayNested);
    expect(departmentsUi.createOverlay).toContain(zClass.modal);
  });
});
