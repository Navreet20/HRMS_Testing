import type { Metadata } from "next";
import type { ReactNode } from "react";

import Script from "next/script";

import "@/index.css";
import { ShellFrame } from "@/shell/ShellFrame";
import { THEME_BOOTSTRAP_SCRIPT } from "@/shell/themePreferenceStorage";

export const metadata: Metadata = {
  title: "EAOVA HRMS",
  description: "EAOVA HRMS dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          id="eaova-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <div className="min-h-screen text-[color:var(--app-text)] [background:var(--app-canvas)]">
          <ShellFrame>{children}</ShellFrame>
        </div>
      </body>
    </html>
  );
}
