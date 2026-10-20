"use client";

import { useCallback, useEffect, useState } from "react";

import { userFacingApiError } from "@/shared/http";
import type { CompanyHolidaysGateway } from "./gateway";
import { normalizeHolidays } from "./selectors";
import type { CompanyHoliday } from "./types";

export interface CompanyHolidaysState {
  readonly holidays: readonly CompanyHoliday[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
}

/** Loads one year's company holidays (sorted by date). */
export function useCompanyHolidays(
  gateway: CompanyHolidaysGateway | null,
  year: number,
): CompanyHolidaysState {
  const [holidays, setHolidays] = useState<readonly CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(Boolean(gateway));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!gateway) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = normalizeHolidays(await gateway.listHolidays(year));
      setHolidays(
        [...rows].sort((left, right) => left.holidayDate.localeCompare(right.holidayDate)),
      );
    } catch (loadError) {
      setError(userFacingApiError(loadError));
    } finally {
      setLoading(false);
    }
  }, [gateway, year]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { holidays, loading, error, reload };
}
