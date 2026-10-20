"use client";

import { useEffect, useState } from "react";

import {
  AppButton,
  AppDateField,
  AppSelect,
  AppTextField,
  DialogShell,
  ProfileViewField,
} from "@/shared/ui";
import { HOLIDAY_TYPES } from "../constants";
import { dayOfWeekForIso } from "@/shared/isoDates";
import {
  EMPTY_HOLIDAY_DRAFT,
  draftFromHoliday,
  holidayInputFromDraft,
  validateHolidayDraft,
} from "../selectors";
import type {
  CompanyHoliday,
  CompanyHolidayDraft,
  CompanyHolidayInput,
} from "../types";

export interface HolidayFormDialogProps {
  readonly open: boolean;
  readonly year: number;
  /** Holiday being edited; omit to add a new one. */
  readonly holiday?: CompanyHoliday | null;
  readonly busy?: boolean;
  readonly actionError?: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: CompanyHolidayInput) => void;
}

const fieldErrorClass = "m-0 text-[0.85rem] leading-[1.35] text-emp-critical";

export function HolidayFormDialog({
  open,
  year,
  holiday = null,
  busy = false,
  actionError = null,
  onClose,
  onSubmit,
}: HolidayFormDialogProps) {
  const [draft, setDraft] = useState<CompanyHolidayDraft>(EMPTY_HOLIDAY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(holiday ? draftFromHoliday(holiday) : EMPTY_HOLIDAY_DRAFT);
      setShowErrors(false);
    }
  }, [open, holiday]);

  const errors = validateHolidayDraft(draft, year);
  const visibleErrors = showErrors ? errors : {};
  const editing = holiday !== null;

  function update(field: keyof CompanyHolidayDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    onSubmit(holidayInputFromDraft(draft, year));
  }

  return (
    <DialogShell
      open={open}
      title={editing ? "Edit holiday" : "Add holiday"}
      description={`Company holiday for ${year}. Leave requests skip this date.`}
      busy={busy}
      actionError={actionError}
      onClose={onClose}
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </AppButton>
          <AppButton onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add holiday"}
          </AppButton>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-1">
          <AppDateField
            id="company-holiday-date"
            label="Date"
            value={draft.holidayDate}
            onChange={(value) => update("holidayDate", value)}
            minDate={`${year}-01-01`}
            maxDate={`${year}-12-31`}
            invalid={Boolean(visibleErrors.holidayDate)}
            aria-describedby={
              visibleErrors.holidayDate ? "company-holiday-date-error" : undefined
            }
          />
          {visibleErrors.holidayDate ? (
            <p id="company-holiday-date-error" className={fieldErrorClass}>
              {visibleErrors.holidayDate}
            </p>
          ) : null}
        </div>
        <ProfileViewField
          label="Day of the Week"
          value={dayOfWeekForIso(draft.holidayDate)}
        />
        <div className="grid gap-1">
          <AppTextField
            id="company-holiday-name"
            label="Holiday name"
            value={draft.holidayName}
            onChange={(value) => update("holidayName", value)}
            placeholder="e.g. Thanksgiving"
            maxLength={100}
            required
            invalid={Boolean(visibleErrors.holidayName)}
            aria-describedby={
              visibleErrors.holidayName ? "company-holiday-name-error" : undefined
            }
          />
          {visibleErrors.holidayName ? (
            <p id="company-holiday-name-error" className={fieldErrorClass}>
              {visibleErrors.holidayName}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <AppSelect
            id="company-holiday-type"
            label="Type"
            value={draft.holidayType}
            onChange={(value) => update("holidayType", value)}
            placeholder="Select holiday type"
            required
            options={[
              ...HOLIDAY_TYPES.map((type) => ({ value: type, label: type })),
              // Keep an older free-text type visible when editing that holiday.
              ...(draft.holidayType &&
              !(HOLIDAY_TYPES as readonly string[]).includes(draft.holidayType)
                ? [{ value: draft.holidayType, label: draft.holidayType }]
                : []),
            ]}
          />
          {visibleErrors.holidayType ? (
            <p id="company-holiday-type-error" className={fieldErrorClass}>
              {visibleErrors.holidayType}
            </p>
          ) : null}
        </div>
      </div>
    </DialogShell>
  );
}
