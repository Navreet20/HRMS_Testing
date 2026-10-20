export type LeaveRequestStatus = "Pending" | "Approved" | "Rejected";

export const LEAVE_REQUEST_STATUSES: readonly LeaveRequestStatus[] = [
  "Pending",
  "Approved",
  "Rejected",
];

export interface LeaveBalance {
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly description: string;
  readonly leaveYear: number;
  /** Unpaid Leave: no entitlement or limit; only used days are tracked. */
  readonly unlimited: boolean;
  readonly selectable: boolean;
  readonly entitledDays: number | null;
  readonly carriedForwardDays: number | null;
  readonly usedDays: number;
  /** Days in submitted requests still waiting for a manager. */
  readonly pendingDays: number;
  readonly remainingDays: number | null;
}

/** Which half of a day is taken on a half day. */
export type HalfPart = "first" | "second";

/** Half days chosen on the form: date → the half taken. Full days are not in the map. */
export type HalfDayChoices = ReadonlyMap<string, HalfPart>;

export interface LeaveDay {
  readonly leaveDate: string;
  readonly isHalfDay: boolean;
  readonly halfPart: HalfPart | null;
  readonly dayValue: number;
  readonly leaveYear: number;
}

export interface LeaveRequestRecord {
  readonly leaveRequestId: string;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly leaveDays: number;
  readonly reason: string | null;
  readonly status: LeaveRequestStatus;
  readonly submittedDate: string | null;
  readonly rejectionReason: string | null;
  readonly recalled: boolean;
  readonly days: readonly LeaveDay[];
  /** When a manager approved or rejected it. */
  readonly actionDate?: string | null;
  /** It was approved first, then rejected. */
  readonly rejectedAfterApproval?: boolean;
  /** Your own Pending request: who has to act next, like "Meena P (your manager)". */
  readonly waitingOn?: string | null;
}

export interface LeaveOverlap {
  readonly leaveRequestId: string;
  readonly leaveTypeName: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly status: string;
}

export interface LeavePreviewDay {
  readonly leaveDate: string;
  readonly dayOfWeek: string;
  readonly leaveYear: number;
}

export interface LeavePreview {
  readonly unlimited: boolean;
  readonly days: readonly LeavePreviewDay[];
  /** Available days per leave year (paid types only). */
  readonly availableByYear: Readonly<Record<number, number>>;
  readonly overlaps: readonly LeaveOverlap[];
  /** Set when a day (or the same half of a day) is already taken by another request. */
  readonly overlapMessage: string | null;
}

export interface LeaveRequestInput {
  readonly leaveTypeId: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly halfDays: readonly string[];
  /** Which half is taken on each half day. */
  readonly halfDayParts: Readonly<Record<string, HalfPart>>;
  readonly reason: string | null;
}

export interface LeaveRequestDraft {
  readonly leaveTypeId: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly reason: string;
}

export type LeaveDraftField = "leaveTypeId" | "fromDate" | "toDate";

export type LeaveDraftErrors = Partial<Record<LeaveDraftField, string>>;
