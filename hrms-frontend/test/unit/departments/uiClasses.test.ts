import { CATALOG_CONTROL, catalogUi as ui } from "@/shared/ui/catalogUi";

const LIGHT_ONLY_HEX = ["#e7f1f0", "#d1d5db"];

describe("departments uiClasses theme tokens", () => {
  it("does not use hardcoded light-only hex in shared catalog classes", () => {
    const values = [
      CATALOG_CONTROL,
      ui.table,
      ui.tableRowsHover,
      ui.dataRow,
      ui.errorBanner,
      ui.statusInactive,
      ui.iconBtnDelete,
      ui.overlay,
      ui.selectTrigger,
      ui.selectSearch,
    ];

    for (const value of values) {
      for (const hex of LIGHT_ONLY_HEX) {
        expect(value.toLowerCase()).not.toContain(hex);
      }
    }
  });

  it("applies explicit tbody text color on tables", () => {
    expect(ui.table).toContain("[&_tbody_td]:text-emp-text");
    expect(ui.table).toContain("[&_tbody_th]:text-emp-text");
  });
});
