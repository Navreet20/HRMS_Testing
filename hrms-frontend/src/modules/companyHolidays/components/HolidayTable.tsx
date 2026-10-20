"use client";

import { Trash2 } from "lucide-react";

import {
  AppButton,
  AppDataTable,
  PencilIcon,
  type AppDataTableColumn,
} from "@/shared/ui";
import { formatIsoDateUs } from "@/shared/isoDates";
import type { CompanyHoliday } from "../types";

export interface HolidayTableProps {
  readonly holidays: readonly CompanyHoliday[];
  readonly ariaLabel: string;
  /** Omit for a read-only list (Employee Portal). */
  readonly onEdit?: (holiday: CompanyHoliday) => void;
  /** Delete button, shown only where `canDelete` allows (today and later). */
  readonly onDelete?: (holiday: CompanyHoliday) => void;
  readonly canDelete?: (holiday: CompanyHoliday) => boolean;
  readonly className?: string;
}

export function HolidayTable({
  holidays,
  ariaLabel,
  onEdit,
  onDelete,
  canDelete,
  className,
}: HolidayTableProps) {
  const columns: AppDataTableColumn<CompanyHoliday>[] = [
    {
      id: "date",
      header: "Date",
      // ISO dates sort chronologically; the cell shows MM/DD/YYYY.
      value: (holiday) => holiday.holidayDate,
      cell: (holiday) => formatIsoDateUs(holiday.holidayDate),
    },
    {
      id: "name",
      header: "Holiday(s)",
      value: (holiday) => holiday.holidayName,
      cellClassName: "font-semibold",
    },
    { id: "type", header: "Type", value: (holiday) => holiday.holidayType },
    {
      id: "dayOfWeek",
      header: "Day of the Week",
      value: (holiday) => holiday.dayOfWeek,
    },
    ...(onEdit || onDelete
      ? [
          {
            id: "actions",
            header: "",
            align: "end" as const,
            cell: (holiday: CompanyHoliday) => (
              <span className="inline-flex items-center justify-end gap-1">
                {onEdit ? (
                  <AppButton
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${holiday.holidayName}`}
                    title="Edit holiday"
                    onClick={() => onEdit(holiday)}
                  >
                    <PencilIcon />
                  </AppButton>
                ) : null}
                {onDelete && (canDelete?.(holiday) ?? true) ? (
                  <AppButton
                    variant="ghost"
                    size="icon"
                    className="text-emp-muted hover:border-emp-critical hover:text-emp-critical"
                    aria-label={`Delete ${holiday.holidayName}`}
                    title="Delete holiday"
                    onClick={() => onDelete(holiday)}
                  >
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  </AppButton>
                ) : null}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <AppDataTable
      data={holidays}
      columns={columns}
      getRowId={(holiday) => holiday.holidayId}
      ariaLabel={ariaLabel}
      resizable
      sortBy={{ id: "date" }}
      className={className}
    />
  );
}
