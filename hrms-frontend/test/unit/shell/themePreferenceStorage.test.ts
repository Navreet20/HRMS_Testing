import {
  DEFAULT_GUEST_THEME_PREFERENCE,
  LOGIN_DOCUMENT_THEME,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_PREFERENCE_STORAGE_KEY,
  applyDocumentTheme,
  applyLoginThemeToDocument,
  readStoredThemePreference,
  resolveStoredThemeForDocument,
  THEME_PREFERENCE_CHANGE_EVENT,
  writeStoredThemePreference,
} from "@/shell/themePreferenceStorage";

describe("themePreferenceStorage", () => {
  afterEach(() => {
    window.localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
    delete document.documentElement.dataset.theme;
    delete document.body.dataset.theme;
    document.documentElement.classList.remove("dark", "eaova-login");
    document.body.classList.remove("dark", "eaova-login");
  });

  it("defaults in-app guest preference to system", () => {
    expect(DEFAULT_GUEST_THEME_PREFERENCE).toBe("system");
  });

  it("forces login document theme to light", () => {
    expect(LOGIN_DOCUMENT_THEME).toBe("light");
  });

  it("persists and reads explicit theme choices", () => {
    expect(readStoredThemePreference()).toBeNull();
    writeStoredThemePreference("dark");
    expect(readStoredThemePreference()).toBe("dark");
  });

  it("does not clear stored preference when applying login light to the document", () => {
    writeStoredThemePreference("dark");
    applyLoginThemeToDocument();
    expect(readStoredThemePreference()).toBe("dark");
  });

  it("notifies listeners when preference is written", () => {
    let notified = false;
    window.addEventListener(THEME_PREFERENCE_CHANGE_EVENT, () => {
      notified = true;
    });
    writeStoredThemePreference("light");
    expect(notified).toBe(true);
  });

  it("resolves system preference from OS setting", () => {
    expect(resolveStoredThemeForDocument("system", true)).toBe("dark");
    expect(resolveStoredThemeForDocument("system", false)).toBe("light");
    expect(resolveStoredThemeForDocument("dark", false)).toBe("dark");
  });

  it("applies login light on html and body and strips the dark class", () => {
    document.documentElement.dataset.theme = "dark";
    document.body.dataset.theme = "dark";
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
    applyLoginThemeToDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.body.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.body.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("eaova-login")).toBe(true);
    expect(document.body.classList.contains("eaova-login")).toBe(true);
  });

  it("strips the login class when applying in-app dark", () => {
    applyLoginThemeToDocument();
    applyDocumentTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.body.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("eaova-login")).toBe(false);
  });

  it("bootstraps light without reading localStorage or system preference", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('dataset.theme="light"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('classList.add("eaova-login")');
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain("localStorage");
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain("prefers-color-scheme");
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain('dataset.theme="dark"');
  });
});
