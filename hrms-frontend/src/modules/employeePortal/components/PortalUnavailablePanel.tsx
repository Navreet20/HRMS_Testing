"use client";

import type { ReactNode } from "react";

import { DirectoryEmptyState } from "@/shared/ui";
import { portalUi } from "../uiClasses";

export interface PortalUnavailablePanelProps {
  readonly title: string;
  readonly message: string;
  readonly icon: ReactNode;
}

/** Placeholder body for Employee Portal sections that are not built yet. */
export function PortalUnavailablePanel({
  title,
  message,
  icon,
}: PortalUnavailablePanelProps) {
  return (
    <div className={portalUi.unavailable}>
      <DirectoryEmptyState icon={icon} title={title} message={message} />
    </div>
  );
}
