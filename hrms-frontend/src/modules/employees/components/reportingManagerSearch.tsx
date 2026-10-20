"use client";

import { createContext, useContext } from "react";

/**
 * How a reporting-manager picker finds people: the module searches the server
 * as the picker is used, so no form needs the whole directory.
 */
export interface ReportingManagerSearch {
  /** The typed text, or null once the picker closes. */
  readonly search: (query: string | null) => void;
  readonly loading: boolean;
}

export const ReportingManagerSearchContext =
  createContext<ReportingManagerSearch | null>(null);

export function useReportingManagerSearch(): ReportingManagerSearch | null {
  return useContext(ReportingManagerSearchContext);
}
