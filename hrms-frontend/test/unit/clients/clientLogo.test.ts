import { validateClientLogoFile } from "@/modules/clients/clientLogo";

describe("validateClientLogoFile", () => {
  it("rejects disallowed MIME types", async () => {
    const file = new File(["x"], "logo.gif", { type: "image/gif" });
    const result = await validateClientLogoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/PNG|JPG|SVG/i);
    }
  });

  it("rejects files over 5MB", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([big], "logo.png", { type: "image/png" });
    const result = await validateClientLogoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/5 MB/i);
    }
  });

  it("accepts SVG without dimension check", async () => {
    const file = new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "logo.svg", {
      type: "image/svg+xml",
    });
    const result = await validateClientLogoFile(file);
    expect(result).toEqual({ ok: true });
  });
});
