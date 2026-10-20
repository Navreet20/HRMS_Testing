import { Z } from "../ui/zIndex";

type CssRule = Record<string, Record<string, string>>;

const Z_VARS = ["overlay", "dropdown", "toast", "modal", "overlayNested", "menu", "tooltip"] as const;

const zVars = Object.fromEntries(
  Z_VARS.map((key) => [`--z-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, String(Z[key])]),
);

/** Document defaults, emitted in order into `@layer base` after the design tokens. */
export const baseStyles: readonly CssRule[] = [
  // Global UI scale: 90% of the browser default (typically 16px → 14.4px).
  // Almost all layout, type, and spacing use rem, so this shrinks the app ~10%.
  { html: { "font-size": "90%" } },
  {
    ":root": {
      ...zVars,
      "font-family":
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: "var(--ds-ink)",
      background: "var(--ds-surface-gradient)",
      "font-synthesis": "none",
      "text-rendering": "optimizeLegibility",
      "color-scheme": "light",
    },
  },
  {
    'html[data-theme="dark"], body[data-theme="dark"]': {
      color: "var(--ds-ink)",
      background: "var(--ds-surface-gradient)",
      "color-scheme": "dark",
    },
  },
  {
    'html[data-theme="light"], body[data-theme="light"]': {
      color: "var(--ds-ink)",
      background: "var(--ds-surface-gradient)",
      "color-scheme": "light",
    },
  },
  { "*": { "box-sizing": "border-box" } },
  { "button, select": { font: "inherit" } },
  {
    body: {
      "min-width": "20rem",
      "min-height": "100vh",
      margin: "0",
      background: "var(--ds-surface-gradient)",
    },
  },
];
