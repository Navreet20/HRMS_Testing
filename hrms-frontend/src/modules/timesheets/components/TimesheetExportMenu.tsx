"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AppButton } from "@/shared/ui";
import { zClass } from "@/ui/zIndex";
import {
  exportTimesheetWeek,
  TIMESHEET_EXPORT_FORMAT_LABEL,
  type TimesheetExportFormat,
  type TimesheetExportInput,
} from "../exportWeek";

export interface TimesheetExportMenuProps {
  readonly week: TimesheetExportInput;
  readonly disabled?: boolean;
  readonly onExported?: (format: TimesheetExportFormat) => void;
  readonly onError?: (message: string) => void;
}

const FORMATS: readonly TimesheetExportFormat[] = ["csv", "excel", "pdf"];

/**
 * Same export menu for employee Time Sheets and employer Manage review.
 */
export function TimesheetExportMenu({
  week,
  disabled = false,
  onExported,
  onError,
}: TimesheetExportMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleExport(format: TimesheetExportFormat) {
    try {
      exportTimesheetWeek(week, format);
      setOpen(false);
      onExported?.(format);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Could not export timesheet.",
      );
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <AppButton
        variant="secondary"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Export
      </AppButton>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Export timesheet"
          className={`absolute right-0 top-[calc(100%+0.35rem)] ${zClass.dropdownLocal} grid min-w-[8.5rem] gap-[0.15rem] rounded-[0.45rem] border-0 bg-emp-surface p-[0.3rem] shadow-[0_6px_18px_rgba(15,23,42,0.16)]`}
        >
          {FORMATS.map((format) => (
            <AppButton
              key={format}
              variant="ghost"
              size="compact"
              role="menuitem"
              className="w-full justify-start"
              onClick={() => handleExport(format)}
            >
              {TIMESHEET_EXPORT_FORMAT_LABEL[format]}
            </AppButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}
