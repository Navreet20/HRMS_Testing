import {
  CreditCard,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  Package,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import { AppButton } from "@/shared/ui";
import { empUi as ui } from "@/shared/ui/empUi";
import { ASSET_STATUS_OPTIONS } from "../constants";
import type { AssetStatus, CategoryInventorySummary } from "../types";

interface AssetsCategoryCardsProps {
  readonly summaries: readonly CategoryInventorySummary[];
  /** Category currently filtered on. Its card stays lifted and outlined. */
  readonly selectedCategoryId?: string;
  /** Status currently filtered on. Marked on the chosen category's card only. */
  readonly selectedStatus?: AssetStatus | "";
  readonly onSelectCategory: (categoryId: string) => void;
  readonly onSelectStatus: (categoryId: string, status: AssetStatus) => void;
  /** Shows "Add first …" on empty categories. Leave out for read-only roles. */
  readonly onAddFirst?: (categoryId: string) => void;
}

const gridClass =
  "grid grid-cols-1 items-stretch gap-[0.85rem] min-[40rem]:grid-cols-2 min-[72rem]:grid-cols-3";

const cardClass =
  "relative grid h-full min-w-0 content-start gap-[0.85rem] overflow-visible rounded-[0.85rem] border p-[1.05rem] transition-[transform,border-color,box-shadow,background-color] duration-150 hover:-translate-y-[3px] hover:border-emp-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const SHADOW_REST =
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.06)]";
const SHADOW_LIFTED = "shadow-[0_12px_28px_rgba(15,23,42,0.14)]";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  keyboard: Keyboard,
  laptop: Laptop,
  mobile: Smartphone,
  "access card": CreditCard,
  monitor: Monitor,
  mouse: Mouse,
};

/** Statuses that need action stand out as coloured pills; the rest stay quiet. */
const STATUS_PILL_CLASS: Partial<Record<AssetStatus, string>> = {
  "Under Repair": "bg-emp-warning-soft text-emp-warning",
  Lost: "bg-[rgba(185,28,28,0.12)] text-emp-critical",
};

const STATUS_DOT_CLASS: Partial<Record<AssetStatus, string>> = {
  "In Stock": "bg-emp-success",
  Assigned: "bg-module-info",
  Decommissioned: "bg-emp-muted",
};

const STATUS_BUTTON_BASE =
  "inline-flex cursor-pointer items-center gap-[0.4rem] rounded-full border-0 text-[0.85rem] font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus";

function CategoryIconBadge({ name }: { readonly name: string }) {
  const Icon = CATEGORY_ICONS[name.trim().toLowerCase()] ?? Package;
  return (
    <span
      className="inline-grid size-[2.4rem] shrink-0 place-items-center rounded-[0.6rem] bg-emp-accent-soft text-emp-accent"
      aria-hidden="true"
    >
      <Icon size={20} strokeWidth={1.8} />
    </span>
  );
}

function CategoryCardHeading({
  summary,
}: {
  readonly summary: CategoryInventorySummary;
}) {
  return (
    <span className="grid min-w-0 gap-[0.1rem]">
      <span className="min-w-0 truncate text-[1.02rem] font-bold text-emp-text">
        {summary.categoryName}
      </span>
      <span className="text-[0.85rem] text-emp-muted">
        {summary.total} {summary.total === 1 ? "asset" : "assets"}
      </span>
    </span>
  );
}

function EmptyCategoryCard({
  summary,
  onAddFirst,
}: {
  readonly summary: CategoryInventorySummary;
  readonly onAddFirst?: (categoryId: string) => void;
}) {
  return (
    <article
      className={`${cardClass} border-[1.5px] border-dashed border-emp-line bg-transparent`}
      role="listitem"
    >
      <header className="flex items-center gap-[0.75rem]">
        <span className="opacity-60">
          <CategoryIconBadge name={summary.categoryName} />
        </span>
        <span className="grid min-w-0 gap-[0.1rem]">
          <span className="min-w-0 truncate text-[1.02rem] font-bold text-emp-text">
            {summary.categoryName}
          </span>
          <span className="text-[0.85rem] text-emp-muted">No assets yet</span>
        </span>
      </header>
      {onAddFirst ? (
        <AppButton
          variant="secondary"
          size="compact"
          className="justify-self-start"
          onClick={() => onAddFirst(summary.categoryId)}
        >
          + Add first {summary.categoryName.trim().toLowerCase()}
        </AppButton>
      ) : null}
    </article>
  );
}

export function AssetsCategoryCards({
  summaries,
  selectedCategoryId = "",
  selectedStatus = "",
  onSelectCategory,
  onSelectStatus,
  onAddFirst,
}: AssetsCategoryCardsProps) {
  if (summaries.length === 0) {
    return (
      <p className={ui.empty}>
        No categories yet. Add an asset to start the inventory.
      </p>
    );
  }

  return (
    <div className={gridClass} role="list" aria-label="Category inventory">
      {summaries.map((summary) => {
        if (summary.total === 0) {
          return (
            <EmptyCategoryCard
              key={summary.categoryId}
              summary={summary}
              onAddFirst={onAddFirst}
            />
          );
        }
        const selected = summary.categoryId === selectedCategoryId;
        const present = ASSET_STATUS_OPTIONS.filter(
          (status) => summary.counts[status] > 0,
        );
        return (
          <article
            key={summary.categoryId}
            className={`${cardClass} cursor-pointer hover:shadow-[0_12px_28px_rgba(15,23,42,0.14)] ${
              selected
                ? `-translate-y-[3px] border-emp-accent bg-emp-accent-soft/30 motion-reduce:translate-y-0 ${SHADOW_LIFTED}`
                : `border-emp-line bg-emp-surface ${SHADOW_REST}`
            }`}
            aria-current={selected ? "true" : undefined}
            role="listitem"
            onClick={() => onSelectCategory(summary.categoryId)}
          >
            <header className="flex items-center justify-between gap-[0.65rem]">
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-[0.75rem] border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emp-focus"
                aria-label={`View all ${summary.categoryName} assets`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectCategory(summary.categoryId);
                }}
              >
                <CategoryIconBadge name={summary.categoryName} />
                <CategoryCardHeading summary={summary} />
              </button>
              {summary.lowStock ? (
                <span className={ui.dirBadge}>Low stock</span>
              ) : null}
            </header>

            <ul className="m-0 flex list-none flex-wrap gap-[0.4rem] p-0">
              {present.map((status) => {
                const statusChosen = selected && status === selectedStatus;
                return (
                  <li key={status}>
                    <button
                      type="button"
                      aria-pressed={statusChosen}
                      className={
                        STATUS_PILL_CLASS[status]
                          ? `${STATUS_BUTTON_BASE} px-[0.6rem] py-[0.15rem] hover:ring-1 hover:ring-current ${STATUS_PILL_CLASS[status]} ${statusChosen ? "ring-2 ring-current" : ""}`
                          : `${STATUS_BUTTON_BASE} px-[0.45rem] py-[0.15rem] text-emp-text hover:bg-emp-raised hover:ring-1 hover:ring-emp-line ${statusChosen ? "bg-emp-raised ring-2 ring-emp-accent" : ""}`
                      }
                      aria-label={`View ${summary.categoryName} assets with status ${status}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectStatus(summary.categoryId, status);
                      }}
                    >
                      {STATUS_DOT_CLASS[status] ? (
                        <span
                          className={`size-[0.5rem] rounded-full ${STATUS_DOT_CLASS[status]}`}
                          aria-hidden="true"
                        />
                      ) : null}
                      {summary.counts[status]} {status}
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
