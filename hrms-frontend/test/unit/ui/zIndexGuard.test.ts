import {
  SCALE_ALLOWLIST,
  scanSource,
  scanSrcTree,
} from "../../../scripts/check-z-index.mjs";

describe("z-index source guard", () => {
  it("flags arbitrary Tailwind z-[…] and numeric zIndex outside the scale", () => {
    const source = [
      'const overlay = "fixed z-[1000]";',
      "const style = { zIndex: 80 };",
      "const menu = <ul style={{ zIndex: 12 }} />;",
      'const local = "z-20 absolute";',
    ].join("\n");

    const violations = scanSource(source, "modules/example/Widget.tsx");
    expect(violations.map((row) => `${row.line}:${row.match}`)).toEqual([
      "1:z-[",
      "2:zIndex: 80",
      "3:zIndex: 12",
      "4:z-20",
    ]);
  });

  it("allows Z / zClass usage, z-auto, z-0, and token CSS vars", () => {
    const source = [
      'import { Z, zClass } from "../../ui/zIndex";',
      "const overlay = zClass.modal;",
      "const menuZ = Z.menu;",
      'const auto = "z-auto";',
      'const behind = "z-0";',
      "const toast = { zIndex: Z.toast };",
      "/* leftover: z-[80] zIndex: 3 */",
      "// also z-50 in a comment",
      ".host { z-index: var(--z-modal, 1000); }",
    ].join("\n");

    expect(scanSource(source, "modules/example/Ok.tsx")).toEqual([]);
  });

  it("skips the scale file and flags numeric z-index in any CSS", () => {
    expect(SCALE_ALLOWLIST.has("ui/zIndex.ts")).toBe(true);
    expect(
      scanSource('export const zClass = { menu: "z-[1200]" };', "ui/zIndex.ts"),
    ).toEqual([]);

    const css = ".row-actions { z-index: 40; }";
    expect(scanSource(css, "modules/employees/newOverlay.css")).toEqual([
      {
        file: "modules/employees/newOverlay.css",
        line: 1,
        name: "CSS z-index number",
        match: "z-index: 40",
      },
    ]);
  });

  it("finds no raw stacking tokens in src/", () => {
    expect(scanSrcTree()).toEqual([]);
  });
});
