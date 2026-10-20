import type { AppSelectOption } from "@/shared/ui/AppSelect";
import { PROJECT_REGIONS } from "./constants";

/** Standalone region options for create/edit project (not derived from the client). */
export function listProjectRegionOptions(): readonly AppSelectOption[] {
  return PROJECT_REGIONS.map((region) => ({ value: region, label: region }));
}
