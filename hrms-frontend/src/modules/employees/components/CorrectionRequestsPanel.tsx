import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import { ui } from "../uiClasses";

export interface CorrectionRequestRow {
  readonly id: string;
  readonly employeeId: string;
  readonly fieldName: string;
  readonly requestedValue: string;
  readonly note: string | null;
  readonly status: string;
  readonly reviewedBy: string | null;
  readonly createdAt: string | null;
}

interface CorrectionRequestsPanelProps {
  readonly load: () => Promise<readonly CorrectionRequestRow[]>;
  readonly onApprove: (requestId: string) => Promise<void>;
  readonly onReject: (requestId: string) => Promise<void>;
}

function asRows(raw: unknown): CorrectionRequestRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      employeeId: String(r.employeeId ?? ""),
      fieldName: String(r.fieldName ?? ""),
      requestedValue: String(r.requestedValue ?? ""),
      note: r.note == null ? null : String(r.note),
      status: String(r.status ?? ""),
      reviewedBy: r.reviewedBy == null ? null : String(r.reviewedBy),
      createdAt: r.createdAt == null ? null : String(r.createdAt),
    };
  });
}

/** Lightweight Admin/HR list for identity correction requests. */
export function CorrectionRequestsPanel({
  load,
  onApprove,
  onReject,
}: CorrectionRequestsPanelProps) {
  const [rows, setRows] = useState<readonly CorrectionRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = asRows(await load());
      setRows(next.filter((row) => row.status === "PENDING"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requests.");
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await onApprove(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await onReject(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={ui.approvalsPanel} aria-label="Correction requests">
      <h3 className={ui.eyebrow}>Identity correction requests</h3>
      {error ? (
        <p className={ui.error} role="alert">
          {error}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className={ui.muted}>No pending correction requests.</p>
      ) : (
        <ul className={ui.approvals}>
          {rows.map((row) => (
            <li key={row.id} className={ui.approvalsTimesheets}>
              <div>
                <strong>{row.fieldName}</strong> → {row.requestedValue}
                <span className={ui.muted}>
                  {" "}
                  · employee {row.employeeId.slice(0, 8)}…
                </span>
                {row.note ? (
                  <p className={ui.muted}>{row.note}</p>
                ) : null}
              </div>
              <div className={ui.formActions}>
                <button
                  type="button"
                  className={ui.btnPrimary}
                  disabled={busyId === row.id}
                  onClick={() => {
                    void handleApprove(row.id);
                  }}
                >
                  <Check size={14} aria-hidden="true" />
                  Approve
                </button>
                <button
                  type="button"
                  className={ui.btnDanger}
                  disabled={busyId === row.id}
                  onClick={() => {
                    void handleReject(row.id);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
