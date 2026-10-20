"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { userFacingApiError } from "@/shared/http";
import {
  AppButton,
  AppSectionCard,
  AppSelect,
  AppShellToast,
  AppTableSkeleton,
  ConfirmDialogShell,
  FeedbackState,
  PlusIcon,
} from "@/shared/ui";
import type { CompanyHolidaysGateway } from "../gateway";
import {
  canDeleteHoliday,
  holidayYearOptions,
  leaveRequestsAffected,
  normalizeHolidays,
} from "../selectors";
import type { CompanyHoliday, CompanyHolidayInput } from "../types";
import { HolidayFormDialog } from "./HolidayFormDialog";
import { HolidayTable } from "./HolidayTable";

export interface CompanyHolidaysPanelProps {
  readonly gateway?: CompanyHolidaysGateway | null;
  /** Injectable for tests; defaults to the current calendar year. */
  readonly currentYear?: number;
  /** False hides Add / Edit / Delete (View only access). */
  readonly canWrite?: boolean;
  /** Injectable for tests; local `YYYY-MM-DD`, defaults to today. */
  readonly today?: string;
}

type DialogState =
  | { readonly open: false }
  | { readonly open: true; readonly holiday: CompanyHoliday | null };

interface PendingDelete {
  readonly holiday: CompanyHoliday;
  /** Leave requests that get the day back; null while loading. */
  readonly affected: number | null;
}

function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function deleteDescription(pending: PendingDelete): string {
  const base = `${pending.holiday.holidayName} will be removed from the ${pending.holiday.holidayYear} holiday list.`;
  if (pending.affected === null) {
    return `${base} Checking leave requests on that date…`;
  }
  if (pending.affected === 0) {
    return `${base} No leave requests include that date.`;
  }
  const requests = pending.affected === 1 ? "1 leave request includes" : `${pending.affected} leave requests include`;
  return `${base} ${requests} that date: it becomes a leave day again, and approved requests use it from the employee's balance.`;
}

/** HR/Admin maintenance of the company-wide holiday list (Company Setup). */
export function CompanyHolidaysPanel({
  gateway = null,
  currentYear = new Date().getFullYear(),
  canWrite = true,
  today,
}: CompanyHolidaysPanelProps) {
  const [year, setYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<readonly CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(Boolean(gateway));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const todayIso = today ?? localTodayIso();

  const yearOptions = useMemo(
    () =>
      holidayYearOptions(currentYear).map((value) => ({
        value: String(value),
        label: String(value),
      })),
    [currentYear],
  );

  const load = useCallback(async () => {
    if (!gateway) {
      setHolidays([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setHolidays(normalizeHolidays(await gateway.listHolidays(year)));
    } catch (error) {
      setLoadError(userFacingApiError(error));
    } finally {
      setLoading(false);
    }
  }, [gateway, year]);

  useEffect(() => {
    void load();
  }, [load]);

  function closeDialog() {
    if (busy) {
      return;
    }
    setDialog({ open: false });
    setActionError(null);
  }

  async function handleSubmit(input: CompanyHolidayInput) {
    if (!gateway || !dialog.open) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      if (dialog.holiday) {
        await gateway.updateHoliday(dialog.holiday.holidayId, input);
        setNotice(`${input.holidayName} updated.`);
      } else {
        await gateway.createHoliday(input);
        setNotice(`${input.holidayName} added to ${input.holidayYear}.`);
      }
      setDialog({ open: false });
      await load();
    } catch (error) {
      setActionError(userFacingApiError(error));
    } finally {
      setBusy(false);
    }
  }

  async function requestDelete(holiday: CompanyHoliday) {
    if (!gateway) {
      return;
    }
    setDeleteError(null);
    setPendingDelete({ holiday, affected: null });
    try {
      const affected = leaveRequestsAffected(await gateway.getDeleteImpact(holiday.holidayId));
      setPendingDelete((current) =>
        current?.holiday.holidayId === holiday.holidayId ? { holiday, affected } : current,
      );
    } catch (error) {
      setDeleteError(userFacingApiError(error));
    }
  }

  async function confirmDelete() {
    if (!gateway || !pendingDelete) {
      return;
    }
    setBusy(true);
    setDeleteError(null);
    try {
      await gateway.deleteHoliday(pendingDelete.holiday.holidayId);
      setNotice(`${pendingDelete.holiday.holidayName} deleted.`);
      setPendingDelete(null);
      await load();
    } catch (error) {
      setDeleteError(userFacingApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppSectionCard
      title="Company Holidays"
      headerEnd={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AppSelect
            id="company-holidays-year"
            aria-label="Year"
            size="compact"
            value={String(year)}
            options={yearOptions}
            onChange={(value) => setYear(Number(value))}
            className="w-[8rem]"
          />
          {canWrite ? (
            <AppButton
              onClick={() => setDialog({ open: true, holiday: null })}
              disabled={!gateway}
            >
              <PlusIcon />
              Add holiday
            </AppButton>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <AppTableSkeleton
          label="Loading holidays"
          headers={["Date", "Holiday(s)", "Type", "Day of the Week"]}
        />
      ) : loadError ? (
        <FeedbackState
          kind="error"
          title="Holidays could not be loaded"
          message={loadError}
          action={
            <AppButton variant="secondary" onClick={() => void load()}>
              Try again
            </AppButton>
          }
        />
      ) : holidays.length === 0 ? (
        <FeedbackState
          kind="empty"
          title={`No holidays for ${year} yet`}
          message={
            canWrite
              ? "Add each company holiday with its observed date."
              : "Company holidays will appear here once HR adds them."
          }
        />
      ) : (
        <HolidayTable
          holidays={holidays}
          ariaLabel={`Company holidays ${year}`}
          onEdit={
            canWrite ? (holiday) => setDialog({ open: true, holiday }) : undefined
          }
          onDelete={canWrite ? (holiday) => void requestDelete(holiday) : undefined}
          canDelete={(holiday) => canDeleteHoliday(holiday, todayIso)}
        />
      )}

      <HolidayFormDialog
        open={canWrite && dialog.open}
        year={year}
        holiday={dialog.open ? dialog.holiday : null}
        busy={busy}
        actionError={actionError}
        onClose={closeDialog}
        onSubmit={(input) => void handleSubmit(input)}
      />
      <ConfirmDialogShell
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete ${pendingDelete.holiday.holidayName}?` : "Delete holiday?"}
        description={pendingDelete ? deleteDescription(pendingDelete) : ""}
        confirmLabel="Delete holiday"
        tone="danger"
        busy={busy || pendingDelete?.affected === null}
        actionError={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!busy) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      />
      <AppShellToast message={notice} onClose={() => setNotice(null)} />
    </AppSectionCard>
  );
}
