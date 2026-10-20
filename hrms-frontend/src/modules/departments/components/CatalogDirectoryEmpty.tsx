import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { AppButton } from "@/shared/ui";

import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import { PlusIcon } from "@/shared/ui/icons";
import { catalogUi as ui } from "@/shared/ui/catalogUi";

interface CatalogDirectoryEmptyProps {
  readonly isCatalogEmpty: boolean;
  /** Catalog has rows but search/filters have not been used yet. */
  readonly isIdle?: boolean;
  readonly icon: ReactNode;
  readonly emptyTitle: string;
  readonly emptyMessage: string;
  readonly filteredTitle: string;
  readonly idleTitle?: string;
  readonly idleMessage?: string;
  readonly canWrite: boolean;
  readonly createLabel: string;
  readonly onCreate?: () => void;
  readonly onClearFilters: () => void;
}

export function CatalogDirectoryEmpty({
  isCatalogEmpty,
  isIdle = false,
  icon,
  emptyTitle,
  emptyMessage,
  filteredTitle,
  idleTitle = "No active search query",
  idleMessage = "Search by name, or select a status filter above to view departments.",
  canWrite,
  createLabel,
  onCreate,
  onClearFilters,
}: CatalogDirectoryEmptyProps) {
  if (isIdle) {
    return (
      <DirectoryEmptyState
        icon={
          <Search size={22} strokeWidth={1.6} aria-hidden focusable={false} />
        }
        title={idleTitle}
        message={idleMessage}
      />
    );
  }

  return (
    <DirectoryEmptyState
      icon={
        isCatalogEmpty ? (
          icon
        ) : (
          <Search size={22} strokeWidth={1.6} aria-hidden focusable={false} />
        )
      }
      title={isCatalogEmpty ? emptyTitle : filteredTitle}
      message={
        isCatalogEmpty
          ? emptyMessage
          : "Nothing matches this search. Try a different name or status, or clear the filters."
      }
      action={
        isCatalogEmpty ? (
          canWrite && onCreate ? (
            <AppButton onClick={onCreate}>
              <PlusIcon />
              {createLabel}
            </AppButton>
          ) : null
        ) : (
          <button
            type="button"
            className={ui.toolbarBtnGhost}
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )
      }
    />
  );
}
