import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { selectAttendanceTrendSummary } from "../selectors";
import type { AttendancePoint, DashboardDestination } from "../types";

interface AttendanceTrendProps {
  readonly headingId: string;
  readonly summaryId: string;
  readonly attendance: readonly AttendancePoint[];
  readonly canOpenAttendance?: boolean;
  readonly onNavigate?: (destination: DashboardDestination) => void;
}

function formatAxisDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

export function AttendanceTrend({
  headingId,
  summaryId,
  attendance,
  canOpenAttendance = false,
  onNavigate,
}: AttendanceTrendProps) {
  const summary = selectAttendanceTrendSummary(attendance);

  return (
    <section
      className="eaova-dashboard-module__panel eaova-dashboard-module__attendance"
      aria-labelledby={headingId}
      aria-describedby={summaryId}
    >
      <div className="eaova-dashboard-module__panel-head">
        <h2 id={headingId}>Attendance trend</h2>
      </div>

      {attendance.length === 0 ? (
        <div className="eaova-dashboard-module__empty-block" role="status">
          <p id={summaryId} className="eaova-dashboard-module__empty">
            No attendance samples for this period.
          </p>
          {canOpenAttendance && onNavigate ? (
            <button
              type="button"
              className="eaova-dashboard-module__empty-cta"
              onClick={() => onNavigate("/timesheets")}
            >
              Open timesheet
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p id={summaryId} className="eaova-dashboard-module__attendance-summary">
            {summary.narrative}
          </p>
          <div
            className="eaova-dashboard-module__chart"
            role="img"
            aria-label="Attendance trend chart showing present, absent, and on-leave counts by day"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={[...attendance]}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dashboard-border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  tick={{ fill: "var(--dashboard-text-muted)", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--dashboard-text-muted)", fontSize: 12 }}
                  width={36}
                />
                <Tooltip
                  labelFormatter={(label) => `Date ${String(label)}`}
                  contentStyle={{
                    background: "var(--dashboard-surface)",
                    border: "1px solid var(--dashboard-border)",
                    borderRadius: "0.4rem",
                    color: "var(--dashboard-text)",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="present"
                  name="Present"
                  stackId="attendance"
                  stroke="var(--dashboard-chart-present)"
                  fill="var(--dashboard-chart-present-soft)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="absent"
                  name="Absent"
                  stackId="attendance"
                  stroke="var(--dashboard-chart-absent)"
                  fill="var(--dashboard-chart-absent-soft)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="onLeave"
                  name="On leave"
                  stackId="attendance"
                  stroke="var(--dashboard-chart-leave)"
                  fill="var(--dashboard-chart-leave-soft)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
