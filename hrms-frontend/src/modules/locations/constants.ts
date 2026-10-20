import {
  DEFAULT_APP_THEME,
  DEFAULT_HRMS_ROLE,
  type AppTheme,
  type HrmsRole,
} from "@/shared";
import {
  DEFAULT_ORG_PAGE_SIZE,
  ORG_LIST_ROLES,
  ORG_STATUS_VALUES,
  ORG_WRITE_ROLES,
} from "@/modules/org/constants";
import {
  DEFAULT_LOCATION_COUNTRY,
  type LocationDraft,
  type OrgMasterStatus,
} from "@/modules/org";
import type { DirectoryPageSize, LocationsActor } from "./types";

export const DEFAULT_LOCATIONS_ROLE: HrmsRole = DEFAULT_HRMS_ROLE;
export const DEFAULT_LOCATIONS_THEME: AppTheme = DEFAULT_APP_THEME;
export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE: DirectoryPageSize = DEFAULT_ORG_PAGE_SIZE;

export const LOCATION_STATUS_FILTER_OPTIONS: readonly OrgMasterStatus[] =
  ORG_STATUS_VALUES;

export const LOCATION_STATUS_LABELS: Readonly<
  Record<OrgMasterStatus, string>
> = {
  Active: "Active",
  Inactive: "Inactive",
};

export const LOCATIONS_LIST_ROLES: readonly HrmsRole[] = ORG_LIST_ROLES;
export const LOCATIONS_WRITE_ROLES: readonly HrmsRole[] = ORG_WRITE_ROLES;

export function createDefaultActor(
  role: HrmsRole = DEFAULT_LOCATIONS_ROLE,
): LocationsActor {
  return { role };
}

export function emptyLocationDraft(
  overrides: Partial<LocationDraft> = {},
): LocationDraft {
  return {
    locationName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    country: DEFAULT_LOCATION_COUNTRY,
    timezone: "",
    locationCode: "",
    locationType: "",
    ...overrides,
  };
}
