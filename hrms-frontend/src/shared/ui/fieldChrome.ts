/**
 * Native control chrome for employees-style forms. Each constant goes on the host
 * element named in its doc; the `emp-*` variants are declared in `src/styles/variants.ts`.
 * `emp-field`, `emp-form`, `emp-date`, `emp-phone-field`, `emp-create-review`,
 * `emp-search-combobox__input`, `emp-multi-picker__input` and
 * `emp-field-input--system` stay as hooks because those variants target them.
 */

/** Module root: `--employees-*` tokens, focus rings, dark select chevrons. */
export const EMPLOYEES_MODULE_ROOT =
  "[--employees-canvas:var(--ds-surface-gradient)] [--employees-surface:var(--ds-paper)] [--employees-surface-raised:var(--ds-nested-gradient)] [--employees-text:var(--ds-ink)] [--employees-text-muted:var(--ds-ink-muted)] [--employees-border:var(--ds-border)] [--employees-line:var(--ds-border)] [--employees-accent:var(--ds-accent)] [--employees-accent-soft:var(--ds-accent-soft)] [--employees-success:#15803d] [--employees-success-soft:rgba(21,128,61,0.1)] [--employees-warning:#b45309] [--employees-warning-soft:rgba(180,83,9,0.1)] [--employees-holiday:#6d28d9] [--employees-holiday-soft:rgba(109,40,217,0.1)] [--employees-critical:#b91c1c] [--employees-focus:var(--ds-accent)] [--employees-on-accent:var(--ds-on-accent)] [--employees-radius:0.5rem] [--employees-row-hover:var(--ds-accent-soft)] [--employees-control-border:var(--ds-border)] [--employees-overlay:rgba(15,23,42,0.45)] [--employees-critical-soft:rgba(185,28,28,0.12)] [--employees-focus-ring:var(--ds-accent-ring)] text-[color:var(--employees-text)] " +
  "data-[theme=dark]:[--employees-success:#4ade80] data-[theme=dark]:[--employees-success-soft:rgba(74,222,128,0.12)] data-[theme=dark]:[--employees-warning:#fbbf24] data-[theme=dark]:[--employees-warning-soft:rgba(251,191,36,0.12)] data-[theme=dark]:[--employees-holiday:#c4b5fd] data-[theme=dark]:[--employees-holiday-soft:rgba(196,181,253,0.14)] data-[theme=dark]:[--employees-critical:#f87171] data-[theme=dark]:[--employees-overlay:rgba(0,0,0,0.62)] data-[theme=dark]:[--employees-critical-soft:rgba(248,113,113,0.16)] " +
  "emp-module-focus-visible:[outline:3px_solid_var(--employees-focus)] emp-module-focus-visible:[outline-offset:2px] emp-control-focus:[outline:none] " +
  "emp-module-dark-select:[color-scheme:dark] emp-module-dark-select:bg-[image:var(--emp-select-chevron-dark)] emp-module-dark-select-disabled:bg-none emp-module-dark-select-disabled:pr-[0.65rem] " +
  "emp-module-phone-number:bg-[color:var(--employees-surface,var(--app-surface))]";

/** `.emp-field` / `.emp-form` host: inputs, selects, textareas and their states. */
export const FIELD_CHROME =
  "emp-field-control:w-full emp-field-control:min-w-0 emp-field-control:max-w-full emp-field-control:h-[2.35rem] emp-field-control:min-h-[2.35rem] emp-field-control:p-[0_0.65rem] emp-field-control:text-[color:var(--employees-text,var(--app-text))] emp-field-control:[font-family:inherit] emp-field-control:[font-style:inherit] emp-field-control:[font-variant:inherit] emp-field-control:[font-stretch:inherit] emp-field-control:text-[0.95rem] emp-field-control:font-semibold emp-field-control:leading-[2.35rem] emp-field-control:bg-[color:var(--employees-surface,var(--app-surface))] emp-field-control:[border:1px_solid_var(--employees-line,var(--app-border))] emp-field-control:rounded-[0.45rem] " +
  "emp-field-disabled:text-[color:var(--employees-text-muted,var(--app-text-muted))] emp-field-disabled:[-webkit-text-fill-color:var(--employees-text-muted,var(--app-text-muted))] emp-field-disabled:opacity-100 emp-field-disabled:cursor-not-allowed emp-field-disabled:bg-[color:var(--employees-surface-raised,var(--app-surface-raised))] " +
  "emp-field-textarea:w-full emp-field-textarea:min-h-[3.5rem] emp-field-textarea:p-[0.5rem_0.65rem] emp-field-textarea:resize-y emp-field-textarea:text-[color:var(--employees-text,var(--app-text))] emp-field-textarea:[font:inherit] emp-field-textarea:[background:var(--employees-surface,var(--app-surface))] emp-field-textarea:[border:1px_solid_var(--employees-line,var(--app-border))] emp-field-textarea:rounded-[0.45rem] " +
  "emp-field-select:appearance-none emp-field-select:pr-8 emp-field-select:[color-scheme:light] emp-field-select:bg-[image:var(--emp-select-chevron)] emp-field-select:bg-no-repeat emp-field-select:bg-[position:right_0.65rem_center] emp-field-select:bg-[length:0.75rem_0.5rem] " +
  "emp-field-select-disabled:bg-none emp-field-select-disabled:pr-[0.65rem] " +
  "emp-field-catalog-locked:[color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))]! emp-field-catalog-locked:[-webkit-text-fill-color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))]! emp-field-catalog-locked:opacity-100! emp-field-catalog-locked-rest:[box-shadow:none]! " +
  "emp-field-invalid:[box-shadow:inset_0_0_0_1.5px_var(--employees-critical,#b91c1c)] " +
  "emp-field-system:[color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-field-system:[-webkit-text-fill-color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-field-system:bg-[color:var(--employees-surface,var(--ds-paper))] emp-field-system:border-[color:var(--employees-line,var(--ds-border))] emp-field-system:[box-shadow:none] emp-field-system:cursor-default emp-field-system:opacity-100 " +
  "emp-field-system-combobox-disabled:bg-[color:var(--employees-surface,var(--ds-paper))]! emp-field-system-combobox-disabled:opacity-100! " +
  "emp-field-system-active:border-[color:var(--employees-line,var(--ds-border))] emp-field-system-active:[box-shadow:none] emp-field-system-active:[outline:none]";

/** Shared by the profile-form and create-employee overlay hosts. */
const SCOPED_SYSTEM_FIELD =
  "emp-scope-field-system:[color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-scope-field-system:[-webkit-text-fill-color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-scope-field-system:bg-[color:var(--employees-surface,var(--ds-paper))] emp-scope-field-system:border-[color:var(--employees-line,var(--ds-border))] emp-scope-field-system:[box-shadow:none] emp-scope-field-system:cursor-default emp-scope-field-system:opacity-100 " +
  "emp-scope-field-system-combobox-disabled:bg-[color:var(--employees-surface,var(--ds-paper))]! emp-scope-field-system-combobox-disabled:opacity-100! " +
  "emp-scope-field-system-active:border-[color:var(--employees-line,var(--ds-border))] emp-scope-field-system-active:[box-shadow:none] emp-scope-field-system-active:[outline:none]";

/** Profile page host (employee, company, asset, client/project edit): AppSelect-matched controls. */
export const PROFILE_FORM_CHROME =
  "emp-profile-field-control:bg-[color:var(--employees-surface,var(--ds-paper))] emp-profile-field-control:[border:1px_solid_var(--employees-control-border,var(--employees-line,#d4d4d4))] emp-profile-field-control:[box-shadow:none] " +
  "emp-profile-field-hover:border-[color:color-mix(in_srgb,var(--ds-accent)_35%,var(--employees-line,var(--ds-border)))] " +
  "emp-profile-field-focus:border-[color:var(--employees-accent,var(--ds-accent))] emp-profile-field-focus:[box-shadow:0_0_0_2px_var(--employees-focus-ring,var(--ds-accent-ring))] emp-profile-field-focus:[outline:none] " +
  "emp-profile-field-invalid:[box-shadow:inset_0_0_0_1.5px_var(--employees-critical,#b91c1c)] " +
  "emp-profile-combobox:bg-[color:var(--employees-surface,var(--ds-paper))]! " +
  `${SCOPED_SYSTEM_FIELD} ` +
  "emp-profile-phone:box-border emp-profile-phone:h-[2.35rem] emp-profile-phone:min-h-[2.35rem] emp-profile-phone:overflow-hidden emp-profile-phone:[background:var(--employees-surface,var(--ds-paper,#ffffff))] emp-profile-phone:[border:1px_solid_var(--employees-control-border,var(--employees-line,#d4d4d4))] emp-profile-phone:rounded-[0.45rem] " +
  "emp-profile-phone-open:overflow-visible " +
  "emp-profile-phone-hover:border-[color:color-mix(in_srgb,var(--ds-accent)_35%,var(--employees-line,var(--ds-border)))] " +
  "emp-profile-phone-focus:border-[color:var(--employees-accent,var(--ds-accent))] emp-profile-phone-focus:[box-shadow:0_0_0_2px_var(--employees-focus-ring,var(--ds-accent-ring))] " +
  "emp-profile-phone-invalid:border-[color:var(--employees-critical,#b91c1c)] emp-profile-phone-invalid:[box-shadow:inset_0_0_0_1.5px_var(--employees-critical,#b91c1c)] " +
  "emp-profile-phone-invalid-focus:border-[color:var(--employees-critical,#b91c1c)] emp-profile-phone-invalid-focus:[box-shadow:inset_0_0_0_1.5px_var(--employees-critical,#b91c1c),0_0_0_2px_var(--employees-focus-ring,var(--ds-accent-ring))] " +
  "emp-profile-phone-number:h-full! emp-profile-phone-number:min-h-0! emp-profile-phone-number:[background:var(--employees-surface,var(--ds-paper,#ffffff))]! emp-profile-phone-number:[border:0]! emp-profile-phone-number:[box-shadow:none]! " +
  "emp-profile-phone-number-active:[border:0]! emp-profile-phone-number-active:[box-shadow:none]! emp-profile-phone-number-active:[outline:none] " +
  "emp-profile-phone-flag:[background:var(--employees-surface,var(--ds-paper,#ffffff))]!";

/** Directory filter card host. */
export const TOOLBAR_FIELD_CHROME =
  "emp-toolbar-field-control:bg-[color:var(--employees-surface,var(--app-surface))] emp-toolbar-field-control:[border:1px_solid_var(--employees-control-border,var(--employees-line,#d4d4d4))] " +
  "emp-toolbar-field-focus:border-[color:var(--employees-accent,var(--ds-accent))] emp-toolbar-field-focus:[box-shadow:0_0_0_2px_var(--employees-focus-ring,var(--ds-accent-ring))] emp-toolbar-field-focus:[outline:none]";

/** `.emp-date` host: native date input sizing. */
export const DATE_FIELD_CHROME =
  "emp-date-input:box-border emp-date-input:w-full emp-date-input:h-[2.45rem] emp-date-input:min-h-[2.45rem] emp-date-input:p-[0.45rem_0.5rem_0.45rem_0.6rem] emp-date-input:text-[0.9rem] emp-date-input:leading-[1.25] emp-date-input:[color-scheme:light] " +
  "emp-date-input-dark:[color-scheme:dark] emp-date-picker-indicator:cursor-pointer emp-date-picker-indicator:opacity-70";

/** Create-employee overlay host (portaled outside the module root). */
export const CREATE_OVERLAY_CHROME =
  "emp-control-focus:[outline:none] " +
  `${SCOPED_SYSTEM_FIELD} ` +
  "emp-review-locked:[color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-review-locked:[-webkit-text-fill-color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-review-locked:bg-[color:var(--employees-surface,var(--ds-paper))]! emp-review-locked:border-[color:var(--employees-line,var(--ds-border))] emp-review-locked:[box-shadow:none] emp-review-locked:cursor-default emp-review-locked:opacity-100! " +
  "emp-review-locked-label:[color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] " +
  "emp-overlay-field-control:h-[2.65rem] emp-overlay-field-control:min-h-[2.65rem] emp-overlay-field-control:p-[0.55rem_0.8rem] emp-overlay-field-control:font-medium emp-overlay-field-control:leading-[1.3] emp-overlay-field-control:[background:var(--ds-paper)] emp-overlay-field-control:[border:1px_solid_var(--employees-line,var(--ds-border))] emp-overlay-field-control:rounded-[0.5rem] emp-overlay-field-control:[box-shadow:none] emp-overlay-field-control:[transition:border-color_120ms_ease,box-shadow_120ms_ease] " +
  "emp-overlay-control-chrome:h-[2.65rem] emp-overlay-control-chrome:min-h-[2.65rem] emp-overlay-control-chrome:[background:var(--ds-paper)] emp-overlay-control-chrome:[border:1px_solid_var(--employees-line,var(--ds-border))] emp-overlay-control-chrome:rounded-[0.5rem] emp-overlay-control-chrome:[box-shadow:none] " +
  "emp-overlay-select-hover:border-[color:color-mix(in_srgb,var(--ds-accent)_35%,var(--employees-line,var(--ds-border)))] " +
  "emp-overlay-select-open:border-[color:var(--ds-accent)] emp-overlay-select-open:[box-shadow:0_0_0_3px_var(--ds-accent-ring)] " +
  "emp-overlay-phone-select:h-full emp-overlay-phone-select:min-h-0 emp-overlay-phone-select:[background:transparent] emp-overlay-phone-select:[border:0] emp-overlay-phone-select:rounded-none emp-overlay-phone-select:[box-shadow:none] " +
  "emp-overlay-readonly:[color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-overlay-readonly:[-webkit-text-fill-color:color-mix(in_srgb,var(--employees-text-muted,var(--ds-ink-muted))_62%,var(--employees-surface,var(--ds-paper)))] emp-overlay-readonly:[background:var(--employees-surface,var(--ds-paper))] emp-overlay-readonly:cursor-default " +
  "emp-overlay-field-hover:border-[color:color-mix(in_srgb,var(--ds-accent)_35%,var(--employees-line,var(--ds-border)))] " +
  "emp-overlay-field-focus:border-[color:var(--ds-accent)] emp-overlay-field-focus:[box-shadow:0_0_0_3px_var(--ds-accent-ring)] emp-overlay-field-focus:[outline:none] " +
  "emp-overlay-combobox-closed-focus:border-[color:var(--employees-line,var(--ds-border))] emp-overlay-combobox-closed-focus:[box-shadow:none] emp-overlay-combobox-closed-focus:[outline:none] " +
  "emp-overlay-combobox-open-focus:border-[color:var(--ds-accent)] emp-overlay-combobox-open-focus:[box-shadow:0_0_0_3px_var(--ds-accent-ring)] emp-overlay-combobox-open-focus:[outline:none] " +
  "emp-overlay-field-invalid:border-[color:var(--employees-critical,#b91c1c)] emp-overlay-field-invalid:[box-shadow:0_0_0_3px_var(--employees-critical-soft,rgba(185,28,28,0.12))] " +
  "emp-overlay-date:h-[2.45rem] emp-overlay-date:min-h-[2.45rem] emp-overlay-date:pr-[0.7rem] emp-overlay-date:text-[0.9rem] emp-overlay-date:leading-[1.25]";

/** `.emp-phone-field` host: combined dial-code select + number box. */
export const PHONE_FIELD_CHROME =
  "emp-phone-field-input:h-full emp-phone-field-input:min-h-0 emp-phone-field-input:bg-transparent emp-phone-field-input:rounded-none emp-phone-field-input-disabled:bg-transparent " +
  "emp-phone-field-select:h-full emp-phone-field-select:w-full emp-phone-field-select:gap-0 " +
  "emp-phone-field-select-field:h-full emp-phone-field-select-field:min-h-0 emp-phone-field-select-field:p-[0_0.35rem] emp-phone-field-select-field:text-[0.88rem] emp-phone-field-select-field:[background:transparent] emp-phone-field-select-field:[border:0] emp-phone-field-select-field:rounded-none " +
  "emp-phone-field-select-field-active:border-transparent";

/** `react-phone-input-2` container (`containerClass`). */
export const PHONE_INPUT_CHROME =
  "emp-phone-root:w-full emp-phone-root:overflow-visible emp-phone-root:[font:inherit] emp-phone-hidden:hidden! " +
  "emp-phone-dropdown:absolute emp-phone-dropdown:top-0 emp-phone-dropdown:bottom-0 emp-phone-dropdown:left-0 emp-phone-dropdown:z-auto emp-phone-dropdown:w-[3.15rem] emp-phone-dropdown:overflow-visible emp-phone-dropdown:bg-[color:var(--employees-surface,var(--clients-surface,var(--app-surface,#ffffff)))] emp-phone-dropdown:[border-width:0_1px_0_0] emp-phone-dropdown:[border-style:none_solid_none_none] emp-phone-dropdown:[border-color:currentcolor_var(--create-project-control-border,var(--employees-control-border,var(--employees-line,var(--app-border,#c8ced8))))_currentcolor_currentcolor] emp-phone-dropdown:rounded-[0.45rem_0_0_0.45rem] " +
  "emp-phone-dropdown-active:bg-[color:var(--employees-surface,var(--clients-surface,var(--app-surface,#ffffff)))] " +
  "emp-phone-selected-flag:w-[3.15rem] emp-phone-selected-flag:p-[0_0_0_0.6rem] emp-phone-selected-flag:rounded-[0.45rem_0_0_0.45rem] emp-phone-selected-flag:bg-transparent emp-phone-selected-flag-active:bg-transparent " +
  "emp-phone-flag:absolute emp-phone-flag:top-[50%] emp-phone-flag:left-[0.55rem] emp-phone-flag:mt-[-5px] emp-phone-flag:[box-shadow:0_0_0_1px_var(--employees-line,var(--app-border,#c8ced8))] emp-phone-flag:rounded-[1px] " +
  "emp-phone-list-flag:[box-shadow:0_0_0_1px_var(--employees-line,var(--app-border,#c8ced8))] emp-phone-list-flag:rounded-[1px] " +
  "emp-phone-arrow:left-[1.85rem] emp-phone-arrow:border-t-[color:var(--employees-text-muted,var(--app-text-muted))] " +
  "emp-phone-number:w-full emp-phone-number:h-[2.35rem] emp-phone-number:min-h-[2.35rem] emp-phone-number:m-0 emp-phone-number:overflow-x-auto emp-phone-number:overflow-y-hidden emp-phone-number:p-[0_0.65rem_0_3.15rem] emp-phone-number:text-[color:var(--employees-text,var(--app-text))] emp-phone-number:[font-family:inherit] emp-phone-number:[font-style:inherit] emp-phone-number:[font-variant:inherit] emp-phone-number:[font-stretch:inherit] emp-phone-number:text-[0.95rem] emp-phone-number:font-semibold emp-phone-number:leading-[2.35rem] emp-phone-number:[letter-spacing:normal] emp-phone-number:bg-[color:var(--employees-surface-raised,var(--app-surface-raised))] emp-phone-number:[border:0] emp-phone-number:rounded-[0.45rem] " +
  "emp-phone-number-focus:border-[color:var(--ds-accent)] emp-phone-number-focus:[box-shadow:0_0_0_3px_var(--ds-accent-ring)] emp-phone-number-focus:[outline:none] " +
  "emp-phone-number-invalid:[box-shadow:inset_0_0_0_1.5px_var(--employees-critical,#b91c1c)] " +
  "emp-phone-number-invalid-focus:[box-shadow:inset_0_0_0_1.5px_var(--employees-critical,#b91c1c),0_0_0_3px_var(--ds-accent-ring)] " +
  "emp-phone-list:top-[calc(100%+0.25rem)] emp-phone-list:left-0 emp-phone-list:w-[18rem] emp-phone-list:min-w-[18rem] emp-phone-list:max-h-[14rem] emp-phone-list:m-0 emp-phone-list:p-0 emp-phone-list:overflow-x-hidden emp-phone-list:overflow-y-auto emp-phone-list:text-[color:var(--employees-text,var(--app-text))] emp-phone-list:[background:var(--employees-surface,var(--app-surface))] emp-phone-list:[border:1px_solid_var(--employees-line,var(--app-border))] emp-phone-list:rounded-[0.45rem] emp-phone-list:[box-shadow:var(--ds-shadow-md,0_8px_24px_rgba(15,23,42,0.12))] " +
  "emp-phone-list-fixed:fixed emp-phone-list-fixed:z-(--z-menu) emp-phone-open:z-(--z-menu) " +
  "emp-phone-search:sticky emp-phone-search:top-0 emp-phone-search:isolate emp-phone-search:h-auto emp-phone-search:m-0 emp-phone-search:p-[0.45rem_0.45rem_0.7rem] emp-phone-search:[background:var(--employees-surface,var(--app-surface))] emp-phone-search-emoji:hidden " +
  "emp-phone-search-box:block emp-phone-search-box:w-full emp-phone-search-box:h-[1.75rem] emp-phone-search-box:min-h-[1.75rem] emp-phone-search-box:m-0 emp-phone-search-box:p-[0_0.45rem] emp-phone-search-box:text-[color:var(--employees-text,var(--app-text))] emp-phone-search-box:[font-family:inherit] emp-phone-search-box:[font-style:inherit] emp-phone-search-box:[font-variant:inherit] emp-phone-search-box:[font-stretch:inherit] emp-phone-search-box:[font-weight:inherit] emp-phone-search-box:text-[0.82rem] emp-phone-search-box:leading-[1.75rem] emp-phone-search-box:[background:var(--employees-surface-raised,var(--app-surface-raised))] emp-phone-search-box:[border:1px_solid_var(--employees-line,var(--app-border))] emp-phone-search-box:rounded-[0.3rem] emp-phone-search-box:[outline:none] " +
  "emp-phone-search-box-focus:border-[color:var(--ds-accent)] emp-phone-search-box-focus:[box-shadow:0_0_0_3px_var(--ds-accent-ring)] " +
  "emp-phone-first-country:mt-[0.15rem] emp-phone-country:p-[0.45rem_0.65rem] emp-phone-country-active:[background:var(--employees-accent-soft,var(--ds-accent-soft,rgba(37,99,235,0.08)))]";

/** Employee search combobox input (`emp-search-combobox__input`). */
export const COMBOBOX_FOCUS =
  "emp-combobox-closed-focus:[outline:none] emp-combobox-open-focus:border-[color:var(--employees-accent,var(--ds-accent))] emp-combobox-open-focus:[box-shadow:0_0_0_2px_var(--employees-focus-ring,var(--ds-accent-ring))] emp-combobox-open-focus:[outline:none]";
