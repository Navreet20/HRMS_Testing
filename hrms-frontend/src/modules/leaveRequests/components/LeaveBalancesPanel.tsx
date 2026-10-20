"use client";

import {
  AppNotice,
  AppRingChart,
  AppRingLegend,
  AppScrollRow,
  FeedbackState,
} from "@/shared/ui";
import {
  daysLeft,
  daysText,
  formatDayCount,
  hasLeavePolicy,
  notInPolicyMessage,
  sortByLeaveTypeOrder,
  yearTotal,
} from "../selectors";
import type { LeaveBalance } from "../types";

function totalNote(balance: LeaveBalance): string {
  const carried = balance.carriedForwardDays ?? 0;
  const entitled = balance.entitledDays ?? 0;
  return carried > 0
    ? `of ${daysText(yearTotal(balance))} (${formatDayCount(entitled)} + ${formatDayCount(carried)} carried over)`
    : `of ${daysText(yearTotal(balance))}`;
}

function BalanceCard({ balance }: { readonly balance: LeaveBalance }) {
  const left = daysLeft(balance);
  return (
    <article
      aria-label={balance.leaveTypeName}
      className="flex w-[18.5rem] shrink-0 items-center gap-4 border-0 border-r border-solid border-emp-line px-4 py-3 last:border-r-0"
    >
      {balance.unlimited ? (
        <AppRingChart
          unlimited
          total={0}
          segments={[]}
          ariaLabel={`${balance.leaveTypeName}: no day limit`}
          center={
            <>
              <b className="text-[1.6rem] font-extrabold">∞</b>
              <span className="text-[0.85rem] font-bold text-emp-muted">no limit</span>
            </>
          }
        />
      ) : (
        <AppRingChart
          total={yearTotal(balance)}
          segments={[
            { label: "Available", value: left, tone: "accent" },
            { label: "Used", value: balance.usedDays, tone: "muted" },
            { label: "Pending", value: balance.pendingDays, tone: "warning" },
          ]}
          ariaLabel={`${balance.leaveTypeName}: ${daysText(left)} left of ${daysText(yearTotal(balance))}`}
          center={
            <>
              <b className="text-[1.6rem] font-extrabold tabular-nums">{formatDayCount(left)}</b>
              <span className="text-[0.85rem] font-bold text-emp-muted">
                {left === 1 ? "day left" : "days left"}
              </span>
            </>
          }
        />
      )}
      <div className="grid min-w-0 flex-1 gap-1">
        <h3 className="m-0 text-[0.92rem] font-extrabold text-emp-text">
          {balance.leaveTypeName}
        </h3>
        <span className="text-[0.85rem] text-emp-muted">
          {balance.unlimited ? "No day limit" : totalNote(balance)}
        </span>
        <AppRingLegend
          items={
            balance.unlimited
              ? [
                  { label: "Used this year", value: formatDayCount(balance.usedDays), tone: "muted" },
                  { label: "Pending", value: formatDayCount(balance.pendingDays), tone: "warning" },
                ]
              : [
                  { label: "Available", value: formatDayCount(left), tone: "accent" },
                  { label: "Used", value: formatDayCount(balance.usedDays), tone: "muted" },
                  { label: "Pending", value: formatDayCount(balance.pendingDays), tone: "warning" },
                ]
          }
        />
      </div>
    </article>
  );
}

export interface LeaveBalancesPanelProps {
  readonly balances: readonly LeaveBalance[];
  /** Active leave types missing from the employee's policy. */
  readonly notInPolicy: readonly string[];
}

/** One row of ring cards (policy types plus Unpaid) with ‹ › when they don't fit. */
export function LeaveBalancesPanel({ balances, notInPolicy }: LeaveBalancesPanelProps) {
  if (balances.length === 0) {
    return (
      <FeedbackState
        kind="empty"
        title="No leave balances yet"
        message="Balances appear once HR assigns you a leave policy."
        compact
      />
    );
  }
  const quiet = notInPolicyMessage(notInPolicy);
  return (
    <div className="grid gap-3">
      {!hasLeavePolicy(balances) ? (
        <AppNotice>
          <b>No leave policy assigned yet.</b> Only Unpaid Leave is available. Ask
          HR to assign your leave policy to see your other leave types.
        </AppNotice>
      ) : null}
      <AppScrollRow ariaLabel="Leave balances" itemsLabel="leave balances">
        {sortByLeaveTypeOrder(balances).map((balance) => (
          <BalanceCard key={balance.leaveTypeId} balance={balance} />
        ))}
      </AppScrollRow>
      {quiet && hasLeavePolicy(balances) ? (
        <p className="m-0 text-[0.85rem] text-emp-muted">{quiet}</p>
      ) : null}
    </div>
  );
}
