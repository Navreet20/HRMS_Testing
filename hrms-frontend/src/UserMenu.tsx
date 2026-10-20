import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { AppTheme, HrmsRole, ThemePreference } from "@/shared";
import {
  CheckIcon,
  MoonIcon,
  ProfileIcon,
  SignOutIcon,
  SunIcon,
  SystemIcon,
} from "@/shared/ui/icons";
import { shellFocusRing } from "@/shell/shellUi";
import { zClass } from "@/ui/zIndex";

export type { ThemePreference };

/**
 * Host-owned session. Access JWT is httpOnly (server cookie).
 * Modules must not read/write auth cookies or localStorage.
 */
export interface SessionUser {
  readonly displayName: string;
  readonly employeeId?: string;
  readonly department?: string;
  readonly role?: HrmsRole;
  readonly email?: string;
  readonly token?: string;
}

interface UserMenuProps {
  readonly user: SessionUser | null;
  readonly themePreference: ThemePreference;
  readonly resolvedTheme: AppTheme;
  readonly onThemePreferenceChange: (preference: ThemePreference) => void;
  readonly onProfile?: () => void;
  readonly onSignOut?: () => void;
  /** Object URL for the signed-in employee's profile photo (optional). */
  readonly photoSrc?: string | null;
}

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}

function AvatarMark({
  photoSrc,
  displayName,
}: {
  readonly photoSrc?: string | null;
  readonly displayName?: string | null;
}) {
  return (
    <span
      className="grid size-[2rem] place-items-center overflow-hidden rounded-[999px] text-[color:var(--app-accent)] [background:var(--app-accent-soft)] [border:1px_solid_var(--app-accent-border)]"
      aria-hidden="true"
    >
      {photoSrc ? (
        <img
          src={photoSrc}
          alt=""
          className="app-user-menu__avatar-img block size-full object-cover"
        />
      ) : (
        <span className="app-user-menu__avatar-initials select-none text-[0.72rem] font-extrabold uppercase leading-none tracking-[0.02em]">
          {initialsFor(displayName ?? "")}
        </span>
      )}
    </span>
  );
}

const USER_MENU_PANEL_ID = "app-user-menu-panel";

const SECTION =
  "app-user-menu__section grid gap-[0.1rem] p-[0.3rem_0.15rem] not-first:mt-[0.15rem] not-first:pt-[0.45rem] not-first:[border-top:1px_solid_var(--app-border)]";

const ITEM_BASE =
  "grid w-full cursor-pointer grid-cols-[1.25rem_1fr_auto] items-center gap-[0.7rem] rounded-[0.7rem] p-[0.55rem_0.65rem] text-left [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] [line-height:inherit] text-[0.9rem] font-semibold [border:0] hover:[background:var(--app-surface-raised)]";

const ITEM = `${ITEM_BASE} text-[color:var(--app-text)] [background:transparent]`;
const ITEM_SELECTED = `${ITEM_BASE} text-[color:var(--app-text)] [background:var(--app-surface-raised)]`;
const ITEM_DANGER = `${ITEM_BASE} text-[color:#b91c1c] [background:transparent]`;

const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "light", label: "Light", icon: <SunIcon /> },
  { id: "dark", label: "Dark", icon: <MoonIcon /> },
  { id: "system", label: "System", icon: <SystemIcon /> },
];

function MenuGlyph({ children }: { readonly children: ReactNode }) {
  return (
    <span className="grid size-[1.125rem] place-items-center [color:currentColor] [&_svg]:block">
      {children}
    </span>
  );
}

export function UserMenu({
  user,
  themePreference,
  resolvedTheme,
  onThemePreferenceChange,
  onProfile,
  onSignOut,
  photoSrc,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = USER_MENU_PANEL_ID;
  const isLoggedIn = user !== null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      className={`relative shrink-0 ${shellFocusRing}`}
      ref={rootRef}
      data-theme={resolvedTheme}
    >
      <button
        type="button"
        className={`app-user-menu__trigger inline-flex min-h-[2.55rem] max-w-[14rem] cursor-pointer items-center gap-[0.55rem] rounded-[999px] [font:inherit] text-[color:var(--app-text)] [background:var(--app-surface)] [border:1px_solid_var(--app-border)] [box-shadow:0_1px_2px_rgba(0,0,0,0.04)] hover:border-[color:var(--app-accent-border)] ${
          isLoggedIn ? "p-[0.28rem_0.55rem_0.28rem_0.28rem]" : "p-[0.28rem]"
        }`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={isLoggedIn ? user.displayName : "Account menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <AvatarMark
          photoSrc={photoSrc}
          displayName={isLoggedIn ? user.displayName : null}
        />
        {isLoggedIn && (
          <span className="app-user-menu__name mr-[0.35rem] max-w-[7.5rem] truncate text-[0.88rem] font-bold">{user.displayName}</span>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          className={`absolute right-0 top-[calc(100%+0.55rem)] ${zClass.shellMenu} flex w-[min(18.5rem,calc(100vw-2rem))] flex-col rounded-[1rem] p-[0.4rem] [background:var(--app-surface)] [border:1px_solid_var(--app-border)] [box-shadow:var(--app-elevated-shadow)]`}
          role="menu"
        >
          {isLoggedIn && (
            <div className={SECTION}>
              <button
                type="button"
                className={ITEM}
                role="menuitem"
                onClick={() => {
                  onProfile?.();
                  setOpen(false);
                }}
              >
                <MenuGlyph>
                  <ProfileIcon />
                </MenuGlyph>
                <span>My Profile</span>
              </button>
            </div>
          )}

          <div className={SECTION}>
            <p className="m-[0.1rem_0.55rem_0.3rem] text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[color:var(--app-text-muted)]">
              Theme
            </p>
            {THEME_OPTIONS.map((option) => {
              const selected = themePreference === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={selected ? ITEM_SELECTED : ITEM}
                  onClick={() => onThemePreferenceChange(option.id)}
                >
                  <MenuGlyph>{option.icon}</MenuGlyph>
                  <span>{option.label}</span>
                  {selected && (
                    <span className="grid place-items-center text-[color:var(--app-text-muted)]">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isLoggedIn && onSignOut ? (
            <div className={`${SECTION} app-user-menu__section--footer`}>
              <button
                type="button"
                className={ITEM_DANGER}
                role="menuitem"
                onClick={() => {
                  onSignOut();
                  setOpen(false);
                }}
              >
                <MenuGlyph>
                  <SignOutIcon />
                </MenuGlyph>
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): AppTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}
