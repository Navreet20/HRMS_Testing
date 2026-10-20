"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AssetsGateway } from "../gateway";
import { readAssetStickerQueryParam } from "../selectors";
import {
  allocationMatchesStickerQuery,
  hrefWithoutAssetStickerQuery,
} from "../stickerScanAccess";
import type { AssetAllocationRecord } from "../types";
import { StickerScanNoAccessDialog } from "./StickerScanNoAccessDialog";

/**
 * Employee sticker QR (`?q=`): deny on Dashboard; own asset opens My Profile Assets.
 */
export function EmployeeStickerScanHost({
  enabled,
  gateway,
}: {
  readonly enabled: boolean;
  readonly gateway?: AssetsGateway;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const stickerQuery = readAssetStickerQueryParam(search ? `?${search}` : "");
  const stickerKey = stickerQuery.trim().toLowerCase();
  const [rows, setRows] = useState<AssetAllocationRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [dismissedStickerKey, setDismissedStickerKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!enabled || !gateway || !stickerQuery) {
      setRows(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setRows(null);
    setFailed(false);
    void gateway
      .listMyAssets()
      .then((data) => {
        if (!cancelled) {
          setRows(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, gateway, stickerQuery]);

  const loaded = rows !== null || failed;
  const isMatch =
    rows !== null && allocationMatchesStickerQuery(rows, stickerQuery);
  const showNoAccess =
    enabled &&
    Boolean(stickerKey) &&
    loaded &&
    !isMatch &&
    dismissedStickerKey !== stickerKey;

  useEffect(() => {
    if (!enabled || !stickerQuery || !isMatch) {
      return;
    }
    if (pathname === "/profile") {
      return;
    }
    router.replace(search ? `/profile?${search}` : "/profile");
  }, [enabled, isMatch, pathname, router, search, stickerQuery]);

  const dismissNoAccess = () => {
    setDismissedStickerKey(stickerKey || null);
    router.replace(
      hrefWithoutAssetStickerQuery(pathname, search ? `?${search}` : ""),
    );
  };

  if (!showNoAccess) {
    return null;
  }
  return <StickerScanNoAccessDialog onClose={dismissNoAccess} />;
}
