/**
 * Tailwind class strings for unauthenticated auth surfaces (login, invite).
 * Keep as complete literals so Tailwind can see them.
 * Login is always light: ~70/30 brand / fixed-width form on large screens.
 * Colors are `ds-*` utilities mapped to `--ds-*` in src/styles/tokens.ts — no extra palette.
 */
export const AUTH_SHELL_CLASS =
  "grid min-h-dvh min-h-screen grid-cols-1 grid-rows-[auto_1fr] overflow-x-hidden bg-ds-surface text-ds-ink lg:grid-rows-none lg:overflow-visible lg:grid-cols-[minmax(0,1fr)_minmax(28rem,32rem)]";

export const AUTH_BRAND_PANEL_CLASS =
  "relative flex h-[70dvh] max-h-[calc(100dvh-13.5rem)] min-h-[16rem] flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,var(--ds-accent-soft)_0%,color-mix(in_srgb,var(--ds-accent)_5%,var(--ds-paper))_55%,var(--ds-paper)_100%)] px-5 pb-10 pt-5 lg:h-full lg:max-h-none lg:min-h-0 lg:border-r lg:border-ds-border lg:px-12 lg:py-16";

/** Phone: illustration on top, sign-in in a white sheet anchored to the bottom. */

/** Wordmark and tagline sit above the sign-in form. */
export const AUTH_WORDMARK_CLASS =
  "m-0 text-[1.35rem] font-extrabold leading-none tracking-[-0.04em] text-ds-ink lg:text-[1.6rem]";

export const AUTH_BRAND_LINE_CLASS =
  "m-0 mt-3 text-[0.95rem] leading-relaxed text-ds-ink-muted max-lg:hidden";

export const AUTH_BRAND_STACK_CLASS = "mb-3 text-center lg:mb-10";

/** Wraps wordmark and form. On phones it sits directly on the backdrop, with no card. */
export const AUTH_FORM_CARD_CLASS =
  "flex w-full max-w-[24rem] flex-col items-center";

export const AUTH_CAROUSEL_CLASS =
  "flex w-full min-h-0 flex-col items-center justify-center";

export const AUTH_CAROUSEL_SLIDES_CLASS = "grid w-full max-w-[34rem]";

export const AUTH_CAROUSEL_SLIDE_CLASS =
  "col-start-1 row-start-1 m-0 grid justify-items-center text-center transition-opacity duration-300 motion-reduce:duration-0";

export const AUTH_CAROUSEL_SLIDE_ACTIVE_CLASS = "opacity-100";

export const AUTH_CAROUSEL_SLIDE_INACTIVE_CLASS =
  "pointer-events-none opacity-0";

/** Flat illustration above the slide text. Decorative. */
export const AUTH_CAROUSEL_IMAGE_CLASS =
  "block h-auto w-full max-w-[30rem] select-none max-lg:max-h-[40dvh] max-lg:w-auto max-lg:max-w-full";

export const AUTH_CAROUSEL_HEADLINE_CLASS =
  "m-0 mt-4 max-w-[22rem] text-[1.1rem] lg:mt-6 lg:text-[1.6rem] font-semibold leading-snug tracking-[-0.02em] text-ds-ink";

export const AUTH_CAROUSEL_BODY_CLASS =
  "m-0 mt-2 max-w-[26rem] max-lg:hidden text-[0.95rem] leading-relaxed text-ds-ink-muted lg:text-[1rem]";

export const AUTH_CAROUSEL_DOTS_CLASS =
  "mt-4 flex items-center gap-1 lg:mt-7";

export const AUTH_CAROUSEL_DOT_CLASS =
  "inline-flex h-6 shrink-0 items-center justify-center rounded-full border-0 bg-transparent px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent";

/** The current slide's dot stretches into a short bar. */
export const AUTH_CAROUSEL_DOT_MARK_ACTIVE_CLASS =
  "block h-2 w-7 rounded-full bg-ds-accent transition-[width] duration-300 motion-reduce:transition-none";

export const AUTH_CAROUSEL_DOT_MARK_INACTIVE_CLASS =
  "block h-2 w-2 rounded-full bg-[color-mix(in_srgb,var(--ds-ink-muted)_45%,var(--ds-paper))] transition-[width] duration-300 motion-reduce:transition-none";

export const AUTH_FORM_PANEL_CLASS =
  "relative -mt-7 flex flex-col items-center justify-center rounded-t-[1.75rem] bg-ds-paper px-6 pb-6 pt-6 shadow-[0_-10px_28px_rgba(15,23,42,0.07)] sm:px-10 lg:mt-0 lg:rounded-none lg:px-16 lg:py-16 lg:shadow-none";

export const AUTH_SECTION_CLASS = "w-full max-w-[22.5rem]";

/** Centered stack for the Microsoft sign-in panel. */
export const AUTH_SIGN_IN_SECTION_CLASS =
  "w-full max-w-[22.5rem] text-center";

export const AUTH_TITLE_CLASS =
  "m-0 text-[1.85rem] font-bold leading-tight tracking-[-0.03em] text-ds-ink sm:text-[2rem]";

export const AUTH_HINT_CLASS =
  "mb-0 mt-2 text-[0.95rem] leading-relaxed text-ds-ink-muted";

export const AUTH_HINT_CODE_CLASS =
  "rounded-[0.3rem] bg-ds-nested px-[0.3em] py-[0.05em] text-[0.88em] text-ds-ink";

export const AUTH_FORM_CLASS = "mt-9 grid gap-5 max-lg:mt-5";

export const AUTH_FIELD_CLASS =
  "grid gap-1.5 text-[0.85rem] font-medium text-ds-ink";

export const AUTH_FIELD_LABEL_ROW_CLASS =
  "flex items-center justify-between gap-3";

export const AUTH_INPUT_CLASS =
  "h-11 w-full rounded-md border border-ds-border bg-ds-paper px-3 text-[0.95rem] font-normal text-ds-ink shadow-[var(--ds-shadow-sm)] transition-[border-color,box-shadow] duration-150 hover:enabled:border-[color-mix(in_srgb,var(--ds-ink)_22%,var(--ds-border))] focus:border-ds-accent-focus focus:outline-none focus-visible:border-ds-accent-focus focus-visible:shadow-[0_0_0_3px_var(--ds-accent-ring)] disabled:cursor-wait disabled:opacity-70";

export const AUTH_INPUT_INVALID_CLASS =
  "h-11 w-full rounded-md border border-ds-danger bg-ds-paper px-3 text-[0.95rem] font-normal text-ds-ink shadow-[var(--ds-shadow-sm)] transition-[border-color,box-shadow] duration-150 focus:border-ds-danger focus:outline-none focus-visible:border-ds-danger focus-visible:shadow-[0_0_0_3px_var(--ds-danger-ring)] disabled:cursor-wait disabled:opacity-70";

export const AUTH_PASSWORD_WRAP_CLASS = "relative block min-w-0";

export const AUTH_PASSWORD_TOGGLE_CLASS =
  "absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-md border-0 bg-transparent p-0 text-ds-ink-muted hover:enabled:bg-[color-mix(in_srgb,var(--ds-ink-muted)_10%,transparent)] hover:enabled:text-ds-ink focus-visible:shadow-[0_0_0_3px_var(--ds-accent-ring)] focus-visible:outline-none disabled:cursor-wait disabled:opacity-70";

export const AUTH_FORGOT_BUTTON_CLASS =
  "shrink-0 border-0 bg-transparent p-0 text-[0.85rem] font-medium text-ds-link underline-offset-2 hover:text-ds-link-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent";

export const AUTH_ERROR_CLASS =
  "m-0 text-[0.85rem] font-medium leading-snug text-ds-danger";

/** Filled accent CTA — invite accept / password forms. */
export const AUTH_SUBMIT_CLASS =
  "mt-1 inline-flex h-11 w-full items-center justify-center rounded-md border-0 bg-ds-accent px-4 text-ds-on-accent no-underline transition-[background-color,transform] duration-150 hover:not-disabled:bg-ds-accent-hover active:not-disabled:bg-ds-accent-active active:not-disabled:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent-focus disabled:cursor-wait disabled:bg-ds-accent-disabled disabled:text-ds-on-accent";

/** Outlined Microsoft SSO button on the sign-in panel. */
export const AUTH_MICROSOFT_BUTTON_CLASS =
  "mt-1 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-md border-[1.5px] border-[color-mix(in_srgb,var(--ds-ink)_32%,var(--ds-border))] bg-ds-paper px-4 text-[0.98rem] font-semibold text-ds-ink no-underline shadow-[var(--ds-shadow-sm)] transition-[border-color,background-color,transform,box-shadow] duration-150 hover:not-disabled:border-ds-accent hover:not-disabled:bg-ds-accent-soft active:not-disabled:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent-focus disabled:cursor-wait disabled:opacity-70";

export const AUTH_MICROSOFT_ICON_CLASS = "size-5 shrink-0";
