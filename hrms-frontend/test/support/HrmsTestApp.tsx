import { AppChrome } from "@/shell/AppChrome";
import { HrmsProvider } from "@/shell/HrmsProvider";
import { ModuleOutlet } from "@/shell/ModuleOutlet";

/**
 * Jest-only host that simulates App Router page swaps in jsdom.
 * Production uses `ShellFrame` + `{children}` instead of `ModuleOutlet`.
 *
 * Tests mock live API off (`isLiveApiConfigured` → false). The shell still
 * shows the Dev account persona selector in that mock/offline mode so
 * persona-switch tests can use the same sidebar control as local UI.
 */
export function HrmsTestApp() {
  return (
    <HrmsProvider>
      <AppChrome>
        <ModuleOutlet />
      </AppChrome>
    </HrmsProvider>
  );
}
