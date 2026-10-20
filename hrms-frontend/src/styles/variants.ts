/**
 * Named selectors for native control chrome (see src/shared/ui/fieldChrome.ts).
 * Order matters: equal-specificity ties resolve in the order these are declared.
 * Multi-selector variants emit one rule with a selector list, like `@custom-variant`.
 */
export const controlVariants: readonly (readonly [name: string, selector: string | readonly string[]])[] = [
  ["emp-module-focus-visible", "& :focus-visible:not(input):not(select):not(textarea)"],
  [
    "emp-control-focus",
    [
      "& :is(input, select, textarea):focus",
      "& :is(input, select, textarea):focus-visible",
    ],
  ],
  [
    "emp-field-control",
    [
      '& input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-multi-picker__input):not(.app-search-field__input)',
      "& select",
    ],
  ],
  [
    "emp-field-disabled",
    [
      '& input:disabled:not(.emp-field-input--system):not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-multi-picker__input)',
      "& select:disabled",
      "& textarea:disabled",
    ],
  ],
  ["emp-field-textarea", "& textarea"],
  ["emp-field-select", "& select"],
  [
    "emp-module-dark-select",
    [
      '&[data-theme="dark"] .emp-field select',
      '&[data-theme="dark"] .emp-form select',
    ],
  ],
  ["emp-field-select-disabled", "& select:disabled"],
  [
    "emp-module-dark-select-disabled",
    [
      '&[data-theme="dark"] .emp-field select:disabled',
      '&[data-theme="dark"] .emp-form select:disabled',
    ],
  ],
  [
    "emp-field-catalog-locked",
    [
      '& input.catalog-control:is(:disabled, :read-only):not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& select.catalog-control:disabled",
    ],
  ],
  [
    "emp-field-catalog-locked-rest",
    [
      '& input.catalog-control:is(:disabled, :read-only):not(:focus):not(:focus-visible):not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& select.catalog-control:disabled:not(:focus):not(:focus-visible)",
    ],
  ],
  [
    "emp-combobox-closed-focus",
    [
      '&:focus:not([data-menu-open="true"])',
      '&:focus-visible:not([data-menu-open="true"])',
    ],
  ],
  [
    "emp-combobox-open-focus",
    [
      '&[data-menu-open="true"]:focus',
      '&[data-menu-open="true"]:focus-visible',
    ],
  ],
  [
    "emp-field-invalid",
    [
      '& input[aria-invalid="true"]:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-multi-picker__input)',
      '& select[aria-invalid="true"]',
    ],
  ],
  [
    "emp-profile-field-control",
    [
      '& .emp-field input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-react-phone-input__field)',
      "& .emp-field select",
      '& .emp-form input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-react-phone-input__field)',
      "& .emp-form select",
    ],
  ],
  [
    "emp-profile-field-hover",
    [
      '& .emp-field input:hover:not(:disabled):not([readonly]):not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-react-phone-input__field)',
      "& .emp-field select:hover:not(:disabled)",
    ],
  ],
  [
    "emp-profile-field-focus",
    [
      '& .emp-field input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-react-phone-input__field):focus',
      '& .emp-field input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-react-phone-input__field):focus-visible',
      "& .emp-field select:focus",
      "& .emp-field select:focus-visible",
    ],
  ],
  [
    "emp-profile-field-invalid",
    [
      '& .emp-field input[aria-invalid="true"]:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not(.emp-react-phone-input__field)',
      '& .emp-field select[aria-invalid="true"]',
    ],
  ],
  ["emp-profile-combobox", "& .emp-search-combobox__input"],
  [
    "emp-field-system",
    [
      '& input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      '& input.emp-search-combobox__input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
    ],
  ],
  [
    "emp-scope-field-system",
    [
      '& .emp-field input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      '& .emp-field input.emp-search-combobox__input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
    ],
  ],
  ["emp-field-system-combobox-disabled", "& input.emp-search-combobox__input.emp-field-input--system:disabled"],
  ["emp-scope-field-system-combobox-disabled", "& .emp-field input.emp-search-combobox__input.emp-field-input--system:disabled"],
  [
    "emp-field-system-active",
    [
      '& input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):hover',
      '& input.emp-search-combobox__input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):hover',
      '& input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus',
      '& input.emp-search-combobox__input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus',
    ],
  ],
  [
    "emp-scope-field-system-active",
    [
      '& .emp-field input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):hover',
      '& .emp-field input.emp-search-combobox__input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):hover',
      '& .emp-field input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus',
      '& .emp-field input.emp-search-combobox__input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus',
      '& .emp-field input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus-visible',
      '& .emp-field input.emp-search-combobox__input.emp-field-input--system:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus-visible',
    ],
  ],
  [
    "emp-review-locked",
    [
      '& .emp-create-review .emp-field input:disabled:not(.emp-field-input--system):not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& .emp-create-review .emp-field textarea:disabled",
      '& .emp-create-review .emp-field button[aria-haspopup="listbox"]:disabled',
      "& .emp-create-review .emp-field input.emp-search-combobox__input:disabled",
    ],
  ],
  ["emp-review-locked-label", '& .emp-create-review .emp-field button[aria-haspopup="listbox"]:disabled span'],
  ["emp-date-input", '& input[type="date"]'],
  ["emp-date-input-dark", '[data-theme="dark"] & input[type="date"]'],
  ["emp-date-picker-indicator", '& input[type="date"]::-webkit-calendar-picker-indicator'],
  [
    "emp-toolbar-field-control",
    [
      '& .emp-field input:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& .emp-field select",
    ],
  ],
  [
    "emp-toolbar-field-focus",
    [
      "& .emp-field input:focus",
      "& .emp-field input:focus-visible",
      "& .emp-field select:focus",
      "& .emp-field select:focus-visible",
    ],
  ],
  [
    "emp-overlay-field-control",
    [
      '& .emp-field input:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& .emp-field select",
      '& .emp-form input:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& .emp-form select",
    ],
  ],
  [
    "emp-overlay-control-chrome",
    [
      '& .emp-field button[aria-haspopup="listbox"]',
      "& .emp-phone-field",
      "& .emp-field .emp-react-phone-input.react-tel-input .form-control",
      "& .emp-field .emp-react-phone-input.react-tel-input .emp-react-phone-input__field",
    ],
  ],
  ["emp-overlay-select-hover", '& .emp-field button[aria-haspopup="listbox"]:hover:not(:disabled)'],
  ["emp-overlay-select-open", '& .emp-field button[aria-haspopup="listbox"][aria-expanded="true"]'],
  ["emp-overlay-phone-select", '& .emp-phone-field button[aria-haspopup="listbox"]'],
  ["emp-overlay-readonly", '& .emp-field input[readonly]:not([type="checkbox"]):not([type="file"]):not([type="hidden"])'],
  [
    "emp-overlay-field-hover",
    [
      '& .emp-field input:hover:not(:disabled):not([readonly]):not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& .emp-field select:hover:not(:disabled)",
      '& .emp-form input:hover:not(:disabled):not([readonly]):not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      "& .emp-form select:hover:not(:disabled)",
    ],
  ],
  [
    "emp-overlay-field-focus",
    [
      '& .emp-field input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus',
      '& .emp-field input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus-visible',
      "& .emp-field select:focus",
      "& .emp-field select:focus-visible",
      '& .emp-form input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus',
      '& .emp-form input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]):focus-visible',
      "& .emp-form select:focus",
      "& .emp-form select:focus-visible",
    ],
  ],
  [
    "emp-overlay-combobox-closed-focus",
    [
      '& .emp-search-combobox__input:focus:not([data-menu-open="true"])',
      '& .emp-search-combobox__input:focus-visible:not([data-menu-open="true"])',
    ],
  ],
  [
    "emp-overlay-combobox-open-focus",
    [
      '& .emp-search-combobox__input[data-menu-open="true"]:focus',
      '& .emp-search-combobox__input[data-menu-open="true"]:focus-visible',
    ],
  ],
  [
    "emp-overlay-field-invalid",
    [
      '& .emp-field input[aria-invalid="true"]:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      '& .emp-form input[aria-invalid="true"]:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
      '& .emp-field select[aria-invalid="true"]',
      '& .emp-form select[aria-invalid="true"]',
    ],
  ],
  ["emp-overlay-date", '& .emp-date input[type="date"]'],
  ["emp-phone-field-input", '& input:not([type="checkbox"]):not([type="file"]):not([type="hidden"])'],
  ["emp-phone-field-input-disabled", '& input:disabled:not([type="checkbox"]):not([type="file"]):not([type="hidden"])'],
  ["emp-phone-field-select", "& .app-select"],
  ["emp-phone-field-select-field", "& .app-select__field"],
  [
    "emp-phone-field-select-field-active",
    [
      "& .app-select__field:hover",
      '& .app-select__field[aria-expanded="true"]',
    ],
  ],
  ["emp-skill-dialog-input", '&& input:not([type="checkbox"]):not([type="file"]):not([type="hidden"])'],
  ["emp-skill-dialog-date", '&& input[type="date"]'],
  ["emp-skill-dialog-date-dark", '[data-theme="dark"] && input[type="date"]'],
  [
    "emp-skill-dialog-date-edit",
    [
      '&& input[type="date"]::-webkit-datetime-edit',
      '&& input[type="date"]::-webkit-datetime-edit-fields-wrapper',
    ],
  ],
  ["emp-skill-dialog-date-indicator", '&& input[type="date"]::-webkit-calendar-picker-indicator'],
  ["emp-skill-dialog-invalid", '&& input[aria-invalid="true"]:not([type="checkbox"]):not([type="file"]):not([type="hidden"])'],
  // react-phone-input-2 internals, hosted on the `.react-tel-input` container.
  ["emp-phone-root", "&.react-tel-input"],
  [
    "emp-phone-hidden",
    [
      "&.react-tel-input .special-label",
      "&.react-tel-input .invalid-number-message",
    ],
  ],
  ["emp-phone-dropdown", "&.react-tel-input .flag-dropdown"],
  [
    "emp-phone-dropdown-active",
    [
      "&.react-tel-input .emp-react-phone-input__button",
      "&.react-tel-input .flag-dropdown.open",
      "&.react-tel-input .flag-dropdown:hover",
      "&.react-tel-input .flag-dropdown:focus",
    ],
  ],
  ["emp-phone-selected-flag", "&.react-tel-input .selected-flag"],
  [
    "emp-phone-selected-flag-active",
    [
      "&.react-tel-input .selected-flag:hover",
      "&.react-tel-input .selected-flag:focus",
      "&.react-tel-input .selected-flag.open",
    ],
  ],
  ["emp-phone-flag", "&.react-tel-input .selected-flag .flag"],
  ["emp-phone-list-flag", "&.react-tel-input .country-list .flag"],
  ["emp-phone-arrow", "&.react-tel-input .selected-flag .arrow"],
  [
    "emp-phone-number",
    [
      "&.react-tel-input .form-control",
      "&.react-tel-input .emp-react-phone-input__field",
    ],
  ],
  [
    "emp-module-phone-number",
    [
      "& .emp-field .emp-react-phone-input.react-tel-input .form-control",
      "& .emp-field .emp-react-phone-input.react-tel-input .emp-react-phone-input__field",
    ],
  ],
  [
    "emp-phone-number-focus",
    [
      "&.react-tel-input .emp-react-phone-input__field:focus",
      "&.react-tel-input .emp-react-phone-input__field:focus-visible",
    ],
  ],
  ["emp-phone-number-invalid", '&.react-tel-input .emp-react-phone-input__field[aria-invalid="true"]'],
  [
    "emp-phone-number-invalid-focus",
    [
      '&.react-tel-input .emp-react-phone-input__field[aria-invalid="true"]:focus',
      '&.react-tel-input .emp-react-phone-input__field[aria-invalid="true"]:focus-visible',
    ],
  ],
  ["emp-phone-list", "&.react-tel-input .emp-react-phone-input__dropdown.country-list"],
  ["emp-phone-list-fixed", "&.react-tel-input .emp-react-phone-input__dropdown.country-list.emp-react-phone-input__dropdown--fixed"],
  [
    "emp-phone-open",
    [
      "&.react-tel-input:has(.flag-dropdown.open)",
      "&.react-tel-input:has(.country-list.emp-react-phone-input__dropdown--fixed)",
    ],
  ],
  ["emp-phone-search", "&.react-tel-input .country-list .search"],
  ["emp-phone-search-emoji", "&.react-tel-input .country-list .search-emoji"],
  ["emp-phone-search-box", "&.react-tel-input .country-list .search-box"],
  ["emp-phone-search-box-focus", "&.react-tel-input .country-list .search-box:focus"],
  ["emp-phone-first-country", "&.react-tel-input .country-list .search + .country"],
  ["emp-phone-country", "&.react-tel-input .country-list .country"],
  [
    "emp-phone-country-active",
    [
      "&.react-tel-input .country-list .country.highlight",
      "&.react-tel-input .country-list .country:hover",
    ],
  ],
  // Profile forms: one outline around flag + number, hosted on the form.
  ["emp-profile-phone", "& .emp-react-phone-input.react-tel-input"],
  [
    "emp-profile-phone-open",
    [
      "& .emp-react-phone-input.react-tel-input:has(.flag-dropdown.open)",
      "& .emp-react-phone-input.react-tel-input:focus-within",
    ],
  ],
  ["emp-profile-phone-hover", '& .emp-react-phone-input:hover:not(:has(.emp-react-phone-input__field[aria-invalid="true"]))'],
  ["emp-profile-phone-focus", "& .emp-react-phone-input:focus-within"],
  ["emp-profile-phone-invalid", '& .emp-react-phone-input:has(.emp-react-phone-input__field[aria-invalid="true"])'],
  ["emp-profile-phone-invalid-focus", '& .emp-react-phone-input:has(.emp-react-phone-input__field[aria-invalid="true"]):focus-within'],
  [
    "emp-profile-phone-number",
    [
      "& .emp-react-phone-input .form-control",
      "& .emp-react-phone-input .emp-react-phone-input__field",
    ],
  ],
  [
    "emp-profile-phone-number-active",
    [
      "& .emp-react-phone-input .emp-react-phone-input__field:hover:not(:disabled):not([readonly])",
      "& .emp-react-phone-input .emp-react-phone-input__field:focus",
      "& .emp-react-phone-input .emp-react-phone-input__field:focus-visible",
      '& .emp-react-phone-input .emp-react-phone-input__field[aria-invalid="true"]',
      '& .emp-react-phone-input .emp-react-phone-input__field[aria-invalid="true"]:focus',
      '& .emp-react-phone-input .emp-react-phone-input__field[aria-invalid="true"]:focus-visible',
    ],
  ],
  [
    "emp-profile-phone-flag",
    [
      "& .emp-react-phone-input .flag-dropdown",
      "& .emp-react-phone-input .flag-dropdown.open",
      "& .emp-react-phone-input .flag-dropdown:hover",
      "& .emp-react-phone-input .flag-dropdown:focus",
      "& .emp-react-phone-input .emp-react-phone-input__button",
      "& .emp-react-phone-input .selected-flag",
      "& .emp-react-phone-input .selected-flag:hover",
      "& .emp-react-phone-input .selected-flag:focus",
      "& .emp-react-phone-input .selected-flag.open",
    ],
  ],
  // `inline` so utilities read module tokens on the element, not at :root.
  // Global UI scale: 90% of the browser default (typically 16px → 14.4px).
  // Almost all layout, type, and spacing use rem, so this shrinks the app ~10%.
];
