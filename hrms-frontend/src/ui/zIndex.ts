/**
 * Shared stacking scale for overlays, portaled menus, and chrome.
 *
 * Convention: never hardcode z-index values (no raw `z-[…]`, `z-10`/`z-50`,
 * or numeric `zIndex` / `z-index`). Always import `{ Z, zClass }` from this
 * module and use `Z.*` / `zClass.*`.
 *
 * Tailwind JIT needs complete class strings (`z-[1200]`), so consume `zClass`
 * in class lists rather than interpolating `Z` at the call site.
 *
 * Body-portaled menus always sit above modal and nested overlay. Raise `menu`
 * (not a one-off overlay) if a new body portal would otherwise bury dropdowns.
 *
 *   localRaised (2) → controls that must sit above a `local` sibling (project card actions)
 *   popoverLocal (5) → small popovers anchored inside a card (e.g. onboarding blockers)
 *   stickyActions (5) → sticky form action bars (FormActionFeedback `sticky`)
 *   pageSticky (25) → in-page sticky bars (e.g. Employee Portal tabs) under the header
 *   chrome (30) → sticky app header; page content scrolls underneath it
 *   overlay (40) → directory dimmers
 *   shellMenu (40) → user menu / Dev account menus anchored in the app shell
 *   dropdown (50) → in-flow AppSelect / local open state
 *   toast (60) → viewport-centered toast host (below full-viewport modals)
 *   modal (1000) → create overlay / shared dialog backdrop
 *   overlayNested (1100) → nested confirm on top of a modal
 *   menu (1200) → body-portaled dropdowns and row menus
 *   tooltip (1300) → reserved for tooltips
 */
export const Z = {
  local: 1,
  localRaised: 2,
  popoverLocal: 5,
  stickyActions: 5,
  dropdownLocal: 20,
  pageSticky: 25,
  chrome: 30,
  overlay: 40,
  shellMenu: 40,
  dropdown: 50,
  toast: 60,
  modal: 1000,
  overlayNested: 1100,
  menu: 1200,
  tooltip: 1300,
} as const;

/** Complete Tailwind z-index classes matching {@link Z}. */
export const zClass = {
  local: "z-[1]",
  localRaised: "z-[2]",
  popoverLocal: "z-[5]",
  stickyActions: "z-[5]",
  dropdownLocal: "z-20",
  pageSticky: "z-[25]",
  chrome: "z-30",
  overlay: "z-40",
  shellMenu: "z-40",
  dropdown: "z-50",
  toast: "z-[60]",
  modal: "z-[1000]",
  overlayNested: "z-[1100]",
  menu: "z-[1200]",
  tooltip: "z-[1300]",
} as const;
