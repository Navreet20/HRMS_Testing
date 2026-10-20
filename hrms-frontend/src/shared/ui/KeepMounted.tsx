import type { ReactNode } from "react";

interface KeepMountedProps {
  readonly show: boolean;
  readonly children: ReactNode;
}

/**
 * Keeps a directory (and its search/filter state) mounted while a detail view
 * is on screen. Hidden + inert so it is not in the a11y tree or tab order.
 */
export function KeepMounted({ show, children }: KeepMountedProps) {
  return (
    <div hidden={!show} inert={!show ? true : undefined}>
      {children}
    </div>
  );
}
