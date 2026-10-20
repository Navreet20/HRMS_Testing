/**
 * EAOVA design tokens.
 *
 * Forest green appears only on accent (buttons, focus, selected).
 * Light and dark surfaces stay cool neutrals — no green wash.
 */

export type TokenBlock = {
  selector: string;
  vars: Record<string, string>;
};

const LIGHT = ':root, [data-theme="light"]';
const DARK = '[data-theme="dark"]';
const THEMED = ':root, [data-theme="light"], [data-theme="dark"]';
const ROOT = ":root";

/** Emitted in order into `@layer base` by `tailwindPlugin.mts`. */
export const designTokens: readonly TokenBlock[] = [
  {
    selector: LIGHT,
    vars: {
      "--ds-shade-1": "#ffffff",
      "--ds-shade-2": "#f0f0ee",
      "--ds-ink": "#101c0d",
      "--ds-ink-muted": "#5c5c59",
      "--ds-accent": "#3f7d3a",
      "--ds-accent-hover": "#1e4620",
      "--ds-accent-active": "color-mix(in srgb, var(--ds-accent-hover) 82%, #000000)",
      "--ds-accent-disabled": "color-mix(in srgb, var(--ds-accent) 36%, var(--ds-shade-2))",
      "--ds-accent-focus": "color-mix(in srgb, var(--ds-accent) 42%, var(--ds-shade-1))",
      "--ds-accent-gradient": "linear-gradient(135deg, #3f7d3a, #1e4620)",
      "--ds-on-accent": "#ffffff",
      "--ds-accent-soft": "color-mix(in srgb, var(--ds-accent) 14%, var(--ds-shade-1))",
      "--ds-accent-ring": "color-mix(in srgb, var(--ds-accent) 28%, transparent)",
      "--ds-link": "var(--ds-accent)",
      "--ds-link-hover": "var(--ds-accent-hover)",
      "--ds-paper": "#ffffff",
      "--ds-border": "#e5e5e2",
      "--ds-surface-gradient": "#f7f7f5",
      "--ds-card-gradient": "#ffffff",
      "--ds-nested-gradient": "#f0f0ee",
      "--ds-danger": "#b42318",
      "--ds-danger-ring": "rgba(180, 35, 24, 0.18)",
      "--ds-shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.06)",
      "--ds-shadow-md": "0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 8px rgba(0, 0, 0, 0.05)",
      "--ds-shadow-lg": "0 1px 2px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.08)",
    },
  },
  {
    selector: DARK,
    vars: {
      "--ds-shade-1": "#262626",
      "--ds-shade-2": "#222222",
      "--ds-ink": "#ffffff",
      "--ds-ink-muted": "#a3a3a3",
      "--ds-accent": "#6fbf63",
      "--ds-accent-hover": "#3f7d3a",
      "--ds-accent-active": "color-mix(in srgb, var(--ds-accent-hover) 82%, #000000)",
      "--ds-accent-disabled": "color-mix(in srgb, var(--ds-accent) 36%, var(--ds-shade-2))",
      "--ds-accent-focus": "color-mix(in srgb, var(--ds-accent) 42%, var(--ds-shade-1))",
      "--ds-accent-gradient": "linear-gradient(135deg, #6fbf63, #3f7d3a)",
      "--ds-on-accent": "#0d1f0b",
      "--ds-accent-soft": "color-mix(in srgb, var(--ds-accent) 16%, var(--ds-shade-1))",
      "--ds-accent-ring": "color-mix(in srgb, var(--ds-accent) 34%, transparent)",
      "--ds-link": "var(--ds-accent)",
      "--ds-link-hover": "var(--ds-accent-hover)",
      "--ds-paper": "#262626",
      "--ds-border": "#3a3a3a",
      "--ds-surface-gradient": "#1a1a1a",
      "--ds-card-gradient": "#262626",
      "--ds-nested-gradient": "#222222",
      "--ds-danger": "#f97066",
      "--ds-danger-ring": "rgba(249, 112, 102, 0.28)",
      "--ds-shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.5)",
      "--ds-shadow-md": "0 1px 2px rgba(0, 0, 0, 0.55), 0 1px 8px rgba(0, 0, 0, 0.4)",
      "--ds-shadow-lg": "0 1px 2px rgba(0, 0, 0, 0.55), 0 12px 32px rgba(0, 0, 0, 0.65)",
    },
  },
  // Login / invite inherit light --ds-accent (#3f7d3a), not a third green.
  // Hover/active stay slightly darker mixes of that primary (app chrome keeps #1e4620).
  // html.eaova-login keeps first-paint / post-sign-out on the same light shades.
  {
    selector: 'html.eaova-login, body.eaova-login, [data-auth-page][data-theme="light"]',
    vars: {
      "--ds-accent-hover": "color-mix(in srgb, var(--ds-accent) 82%, #000000)",
      "--ds-accent-active": "color-mix(in srgb, var(--ds-accent) 68%, #000000)",
      "--ds-accent-disabled": "color-mix(in srgb, var(--ds-accent) 36%, var(--ds-shade-2))",
      "--ds-accent-focus": "color-mix(in srgb, var(--ds-accent) 42%, var(--ds-shade-1))",
      "--ds-accent-ring": "color-mix(in srgb, var(--ds-accent) 24%, transparent)",
    },
  },
  // Status colors shared by the record-workspace modules.
  {
    selector: LIGHT,
    vars: {
      "--module-success": "#15803d",
      "--module-warning": "#b45309",
      "--module-critical": "#b91c1c",
      "--module-info": "#0369a1",
    },
  },
  {
    selector: DARK,
    vars: {
      "--module-success": "#4ade80",
      "--module-warning": "#fbbf24",
      "--module-critical": "#f87171",
      "--module-info": "#38bdf8",
    },
  },
  // Dashboard module. Aliases resolve on each themed element, like --app-*.
  {
    selector: THEMED,
    vars: {
      "--dashboard-surface": "var(--app-surface)",
      "--dashboard-surface-raised": "var(--app-surface-raised)",
      "--dashboard-text": "var(--app-text)",
      "--dashboard-text-muted": "var(--app-text-muted)",
      "--dashboard-border": "var(--app-border-soft)",
      "--dashboard-accent": "var(--app-accent)",
      "--dashboard-accent-soft": "var(--app-accent-soft)",
      "--dashboard-chart-present": "var(--app-accent)",
      "--dashboard-chart-present-soft": "var(--app-accent-soft)",
    },
  },
  {
    selector: LIGHT,
    vars: {
      "--dashboard-success": "#15803d",
      "--dashboard-success-soft": "rgba(21, 128, 61, 0.1)",
      "--dashboard-warning": "#b45309",
      "--dashboard-warning-soft": "rgba(180, 83, 9, 0.1)",
      "--dashboard-chart-absent": "#c2410c",
      "--dashboard-chart-absent-soft": "rgba(194, 65, 12, 0.12)",
      "--dashboard-chart-leave": "#0369a1",
      "--dashboard-chart-leave-soft": "rgba(3, 105, 161, 0.12)",
      "--dashboard-line": "#d4d4d4",
    },
  },
  {
    selector: DARK,
    vars: {
      "--dashboard-success": "#4ade80",
      "--dashboard-success-soft": "rgba(74, 222, 128, 0.12)",
      "--dashboard-warning": "#fbbf24",
      "--dashboard-warning-soft": "rgba(251, 191, 36, 0.12)",
      "--dashboard-chart-absent": "#fb923c",
      "--dashboard-chart-absent-soft": "rgba(251, 146, 60, 0.14)",
      "--dashboard-chart-leave": "#38bdf8",
      "--dashboard-chart-leave-soft": "rgba(56, 189, 248, 0.14)",
      "--dashboard-line": "#3a3a3a",
    },
  },
  {
    selector: ROOT,
    vars: {
      "--ds-radius-sm": "0.375rem",
      "--ds-radius-md": "0.5rem",
      "--ds-radius-lg": "0.75rem",
      "--ds-radius-full": "999px",
      "--ds-space-1": "0.25rem",
      "--ds-space-2": "0.5rem",
      "--ds-space-3": "0.75rem",
      "--ds-space-4": "1rem",
      "--ds-space-5": "1.5rem",
      "--ds-space-6": "2rem",
      // Native select chevrons (light / dark stroke).
      "--emp-select-chevron": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      "--emp-select-chevron-dark": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23d4d4d4' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      // AppCheckbox checked tick.
      "--app-checkbox-check": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M3.5 8.2 6.4 11.1 12.5 4.5' stroke='%23ffffff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      // AppCheckbox indeterminate (mixed) dash.
      "--app-checkbox-dash": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 8h8' stroke='%23ffffff' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E\")",
    },
  },
  // App shell tokens, re-resolved on every themed subtree.
  {
    selector: THEMED,
    vars: {
      "--app-canvas": "var(--ds-surface-gradient)",
      "--app-surface": "var(--ds-paper)",
      "--app-surface-raised": "var(--ds-nested-gradient)",
      "--app-text": "var(--ds-ink)",
      "--app-text-muted": "var(--ds-ink-muted)",
      "--app-border": "var(--ds-border)",
      "--app-border-soft": "var(--ds-border)",
      "--app-accent": "var(--ds-accent)",
      "--app-accent-soft": "var(--ds-accent-soft)",
      "--app-accent-border": "var(--ds-accent-ring)",
      "--app-focus": "var(--ds-accent)",
      "--app-on-accent": "var(--ds-on-accent)",
      // Edit / pencil affordance — blue across HRMS (not brand accent green).
      "--app-edit-icon": "#2563eb",
      "--app-edit-icon-hover": "#1d4ed8",
      "--app-edit-icon-soft": "rgba(37, 99, 235, 0.1)",
      "--app-sidebar-bg": "var(--ds-nested-gradient)",
      "--app-nav-ink": "var(--ds-ink-muted)",
      "--app-nav-active": "var(--app-accent)",
      "--app-nav-active-soft": "var(--app-accent-soft)",
      "--app-nav-active-fill": "color-mix(in srgb, var(--app-nav-active) 18%, var(--app-sidebar-bg))",
      "--app-nav-scrollbar": "color-mix(in srgb, var(--app-text-muted) 45%, transparent)",
      "--app-elevated-shadow": "var(--ds-shadow-md)",
      // Module CSS historically used --emp-* names; keep them aliased to app tokens
      // so nested panels/menus don't fall back to hardcoded light hex.
      "--emp-text": "var(--app-text)",
      "--emp-muted": "var(--app-text-muted)",
      "--emp-surface": "var(--app-surface)",
      "--emp-raised": "var(--app-surface-raised)",
      "--emp-line": "var(--app-border)",
      "--emp-accent": "var(--app-accent)",
    },
  },
];
