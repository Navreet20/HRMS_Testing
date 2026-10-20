"use client";

import type { ReactNode } from "react";

import { AppChrome } from "./AppChrome";
import { HrmsProvider } from "./HrmsProvider";

export function ShellFrame({ children }: { children: ReactNode }) {
  return (
    <HrmsProvider>
      <AppChrome>{children}</AppChrome>
    </HrmsProvider>
  );
}
