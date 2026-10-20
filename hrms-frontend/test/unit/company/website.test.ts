import {
  COMPANY_WEBSITE_INVALID_MESSAGE,
  normalizeCompanyWebsite,
} from "../../../src/modules/company/website";

describe("normalizeCompanyWebsite", () => {
  it("accepts https, www, and host-only company URLs", () => {
    expect(normalizeCompanyWebsite("https://cognivance.com")).toBe(
      "https://cognivance.com",
    );
    expect(normalizeCompanyWebsite("http://www.cognivance.com")).toBe(
      "http://www.cognivance.com",
    );
    expect(normalizeCompanyWebsite("cognivance.com")).toBe(
      "https://cognivance.com",
    );
    expect(normalizeCompanyWebsite("www.cognivance.com")).toBe(
      "https://www.cognivance.com",
    );
    expect(normalizeCompanyWebsite("cognivance.com/about")).toBe(
      "https://cognivance.com/about",
    );
  });

  it("rejects nonsense, emails, and unsafe schemes", () => {
    expect(normalizeCompanyWebsite("asdf")).toBeNull();
    expect(normalizeCompanyWebsite("hello world")).toBeNull();
    expect(normalizeCompanyWebsite("ops@eaova.test")).toBeNull();
    expect(normalizeCompanyWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeCompanyWebsite("ftp://files.example.com")).toBeNull();
    expect(normalizeCompanyWebsite("")).toBeNull();
  });

  it("keeps the user-facing invalid message stable", () => {
    expect(COMPANY_WEBSITE_INVALID_MESSAGE).toMatch(/https:\/\/company\.com/);
  });
});
