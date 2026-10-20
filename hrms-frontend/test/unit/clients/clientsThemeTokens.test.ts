import { clientsUi } from "@/modules/clients/uiClasses";
import { designTokens } from "@/styles/tokens";

const LIGHT_ONLY_HEX = ["#fff", "#ffffff", "#f3f4f6", "#f7f8f9", "#f8fafc"];

function expectNoLightOnlyFills(classes: string) {
  const lower = classes.toLowerCase();
  for (const hex of LIGHT_ONLY_HEX) {
    expect(lower).not.toMatch(new RegExp(`bg-\\[${hex}[\\]_,)]`));
  }
}

describe("clients nested projects panel theme", () => {
  it("uses app surface tokens instead of hardcoded light fills", () => {
    expect(clientsUi.projectSectionCard).toContain("bg-app-surface");
    expect(clientsUi.projectCardSelectable).toContain("bg-app-surface");

    expectNoLightOnlyFills(clientsUi.projectSectionCard);
    expectNoLightOnlyFills(clientsUi.projectCardSelectable);
  });

  it("aliases --emp-* onto app theme tokens on every themed subtree", () => {
    const shell = designTokens.find((block) => "--emp-surface" in block.vars);
    expect(shell?.selector).toBe(':root, [data-theme="light"], [data-theme="dark"]');
    expect(shell?.vars).toMatchObject({
      "--emp-surface": "var(--app-surface)",
      "--emp-raised": "var(--app-surface-raised)",
      "--emp-text": "var(--app-text)",
    });
  });
});
