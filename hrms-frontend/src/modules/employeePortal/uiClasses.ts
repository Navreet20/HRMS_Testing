/**
 * Request dialogs portal to `document.body`, so these reach into shared
 * controls by structure; `!` beats the controls' own utilities.
 */
const REQUEST_FORM = [
  "w-full",
  "[&_.emp-field>p]:m-0! [&_.emp-field>p]:text-[0.92rem]! [&_.emp-field>p]:font-normal! [&_.emp-field>p]:tracking-[0.01em]! [&_.emp-field>p]:leading-[1.35]! [&_.emp-field>p]:normal-case! [&_.emp-field>p]:text-[color:var(--employees-text,var(--app-text))]!",
  "[&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:h-[2.35rem]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:min-h-[2.35rem]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:leading-[1.35]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:px-[0.7rem]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:py-[0.45rem]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:rounded-[0.5rem]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:[font-family:inherit]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:[font-style:inherit]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:[font-variant:inherit]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:[font-stretch:inherit]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:text-[0.92rem]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:font-normal! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:tracking-[0.01em]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:normal-case! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:text-[color:var(--employees-text,var(--app-text))]! [&_.emp-form_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:[-webkit-text-fill-color:var(--employees-text,var(--app-text))]!",
  "[&_.emp-form_input::placeholder]:text-[color:var(--employees-text-muted,var(--app-text-muted))]! [&_.emp-form_input::placeholder]:[-webkit-text-fill-color:var(--employees-text-muted,var(--app-text-muted))]! [&_.emp-form_input::placeholder]:font-normal! [&_.emp-form_input::placeholder]:opacity-100!",
  "[&_.emp-search-combobox]:w-full! [&_.emp-search-combobox_input]:w-full!",
  "[&_.app-select]:w-full! [&_.app-select]:text-[color:var(--employees-text,var(--app-text))]!",
  "[&_.app-select>button]:min-h-[2.35rem]! [&_.app-select>button]:px-[0.7rem]! [&_.app-select>button]:py-[0.45rem]! [&_.app-select>button]:rounded-[0.5rem]! [&_.app-select>button]:[font-family:inherit]! [&_.app-select>button]:[font-style:inherit]! [&_.app-select>button]:[font-variant:inherit]! [&_.app-select>button]:[font-stretch:inherit]! [&_.app-select>button]:text-[0.92rem]! [&_.app-select>button]:font-normal! [&_.app-select>button]:tracking-[0.01em]! [&_.app-select>button]:leading-[1.35]! [&_.app-select>button]:normal-case! [&_.app-select>button]:text-[color:var(--employees-text,var(--app-text))]! [&_.app-select>button]:bg-[var(--app-surface,#fff)]! [&_.app-select>button]:[border:1px_solid_var(--employees-control-border,var(--employees-line,var(--app-border)))]! [&_.app-select>button]:[box-shadow:none]!",
  "[&_.app-select>button:hover]:border-[color:var(--employees-accent,var(--app-accent))]! [&_.app-select>button[aria-expanded=true]]:border-[color:var(--employees-accent,var(--app-accent))]! [&_.app-select>button[aria-expanded=true]]:[box-shadow:0_0_0_2px_var(--employees-focus-ring,color-mix(in_srgb,var(--app-accent)_28%,transparent))]!",
  "[&_.app-select>button>span:first-child]:[font-size:inherit]! [&_.app-select>button>span:first-child]:[font-weight:inherit]! [&_.app-select>button>span:first-child]:[letter-spacing:inherit]! [&_.app-select>button>span:first-child]:normal-case! [&_.app-select>button>span:first-child]:[color:inherit]!",
  "[&_.app-select>button>span:first-child[class*=placeholder]]:text-[color:var(--app-text-muted,#737373)]! [&_.app-select>button>span:first-child[class*=placeholder]]:font-normal!",
].join(" ");

export const portalUi = {
  /** Hugs its content instead of stretching down the viewport-tall main column. */
  root: "h-auto min-h-0 w-full flex-[0_0_auto] font-['Segoe_UI','Source_Sans_3',system-ui,sans-serif] text-app-text [&_:focus-visible]:[outline-width:2px]!",
  self: "grid h-auto min-h-0 gap-[0.75rem]",
  panel: "grid h-auto min-h-0 gap-[0.5rem] px-0 pt-[0.5rem] pb-0",
  unavailable:
    "rounded-[0.85rem] border border-app-border bg-app-surface px-[1rem] pt-[2.25rem] pb-[2.75rem]",
  panelTitle: "m-0 text-[1rem] font-bold",
  muted: "m-0 text-[0.9rem] leading-[1.45] text-app-muted",
  requests: "grid w-full gap-[0.5rem]",
  myRequests: "grid w-full gap-[0.45rem]",

  requestDialog:
    "w-[min(36rem,calc(100vw-2rem))]! overflow-visible! [&>div]:overflow-visible! [&>footer]:relative!",
  requestForm: REQUEST_FORM,
  requestFormGrid: "grid-cols-[1fr]! gap-[0.65rem]!",
  fieldWide: "col-span-full",
} as const;
