import {
  parsePathname,
  type AppLocation,
} from "@/appLocation";
import type { EntitlementModuleId, HrmsRole } from "@/shared";
import {
  canAccessLocation,
  resolveRoleHomeLocation,
} from "@/shell/navPolicy";
import { readAssetStickerQueryParam } from "./selectors";

/** CatalogModal title when a sticker scan is not assigned to the signed-in employee. */
export const ASSET_STICKER_NO_ACCESS_TITLE = "Access denied";

/** Body copy for the sticker-scan deny dialog. Never include an assignee name. */
export const ASSET_STICKER_NO_ACCESS_COPY =
  "You don't have access to this asset.";

/** Drop sticker `q` so a dismissed deny dialog cannot reopen. Keeps other search params. */
export function hrefWithoutAssetStickerQuery(
  pathname: string,
  search: string = "",
): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  params.delete("q");
  const next = params.toString();
  const trimmed = pathname.trim();
  const path = trimmed
    ? trimmed.startsWith("/")
      ? trimmed
      : `/${trimmed}`
    : "/";
  return next ? `${path}?${next}` : path;
}

export function isAssetStickerScanPath(
  pathname: string,
  search?: string,
): boolean {
  const parsed = parsePathname(pathname);
  if (parsed?.nav !== "assets") {
    return false;
  }
  return Boolean(readAssetStickerQueryParam(search));
}

export function allocationMatchesStickerQuery(
  rows: readonly { readonly assetId?: string | null }[],
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  return rows.some(
    (row) => (row.assetId ?? "").trim().toLowerCase() === needle,
  );
}

/**
 * After login (or when an unauthorized role hits `/assets?q=`): keep the
 * sticker deep-link for asset-list roles; send incomplete Employee My
 * Profiles to `/profile`; otherwise role home (search `q` is preserved by
 * the shell).
 *
 * Incomplete-profile landing applies only to the EMPLOYEE role and is the
 * initial destination only — it does not block sidebar navigation afterward.
 * Admin, HR, Project Manager, and other roles always use role home.
 */
export function resolvePostSignInLocation(input: {
  readonly role: HrmsRole;
  readonly enabledModules: ReadonlySet<EntitlementModuleId>;
  readonly pathname: string;
  readonly search?: string;
  readonly accessGrants?: readonly import("@/shared/accessGrants").SessionAccessGrant[] | null;
  /**
   * When false and role is EMPLOYEE, land on My Profile instead of role home
   * (non-sticker paths). Ignored for all other roles.
   */
  readonly myProfileComplete?: boolean;
}): AppLocation {
  if (isAssetStickerScanPath(input.pathname, input.search)) {
    const assets: AppLocation = { nav: "assets" };
    if (
      canAccessLocation(
        assets,
        input.role,
        input.enabledModules,
        input.accessGrants,
      )
    ) {
      return assets;
    }
  } else if (
    input.role === "EMPLOYEE" &&
    input.myProfileComplete === false
  ) {
    return { nav: "profile" };
  }
  return resolveRoleHomeLocation(
    input.role,
    input.enabledModules,
    input.accessGrants,
  );
}
