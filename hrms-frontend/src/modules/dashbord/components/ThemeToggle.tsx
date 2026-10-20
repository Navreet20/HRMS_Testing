import type { DashboardTheme } from "../types";
import { MoonIcon, SunIcon } from "@/shared/ui/icons";

interface ThemeToggleProps {
  readonly theme: DashboardTheme;
  readonly onChange: (theme: DashboardTheme) => void;
  readonly compact?: boolean;
  readonly className?: string;
}

export function ThemeToggle({
  theme,
  onChange,
  compact = false,
  className,
}: ThemeToggleProps) {
  const nextTheme: DashboardTheme = theme === "light" ? "dark" : "light";
  const label =
    theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button
      type="button"
      className={className}
      aria-pressed={theme === "dark"}
      aria-label={label}
      title={label}
      onClick={() => onChange(nextTheme)}
    >
      {theme === "light" ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
      {!compact && (
        <span>
          {theme === "light" ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
}
