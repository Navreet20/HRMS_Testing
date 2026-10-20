import type { ReactNode } from "react";

import { clientsUi as ui } from "../uiClasses";

/**
 * Field label chrome matching Basic information / catalog fields:
 * uppercase bold name; required adds red *; optional adds muted (optional).
 */
export function ClientsFieldLabel({
  children,
  required = false,
  optional = false,
}: {
  readonly children: ReactNode;
  readonly required?: boolean;
  readonly optional?: boolean;
}) {
  return (
    <span className={ui.fieldLabel}>
      {children}
      {required ? (
        <span className={ui.requiredMark} aria-hidden="true">
          {" *"}
        </span>
      ) : optional ? (
        <span className={ui.fieldOptional}>{" (optional)"}</span>
      ) : null}
    </span>
  );
}
