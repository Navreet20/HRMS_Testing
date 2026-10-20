import {
  buildTablePdfBlob,
  downloadBlob,
  escapeCsv,
  escapeMarkup,
} from "@/shared/export";

import {
  dayTotals,
  formatHoursTotal,
  lineWeekTotal,
  overallWeekTotal,
  weekDatesFromStart,
} from "./selectors";
import type { HoursFormat, TimesheetLineRecord } from "./types";

export type TimesheetExportFormat = "csv" | "excel" | "pdf";

export const TIMESHEET_EXPORT_FORMAT_LABEL: Record<TimesheetExportFormat, string> =
  {
    csv: "CSV",
    excel: "Excel",
    pdf: "PDF",
  };

export function timesheetExportedNotice(format: TimesheetExportFormat): string {
  return `Timesheet exported as ${TIMESHEET_EXPORT_FORMAT_LABEL[format]}.`;
}

export interface TimesheetExportInput {
  readonly weekStartDate: string;
  readonly weekEndDate?: string;
  readonly employeeLabel?: string;
  readonly status?: string;
  readonly hoursFormat?: HoursFormat;
  readonly lines: readonly TimesheetLineRecord[];
}

export interface TimesheetExportTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

function hoursText(hours: number, format: HoursFormat | undefined): string {
  return formatHoursTotal(hours, format ?? "clock");
}

function selectionForLine(line: TimesheetLineRecord): string {
  return line.projectCode ?? line.otherType ?? line.leaveType ?? "";
}

export function buildTimesheetExportTable(
  input: TimesheetExportInput,
): TimesheetExportTable {
  const dates = weekDatesFromStart(input.weekStartDate);
  const headers = [
    "Category",
    "Selection",
    "Activity",
    ...dates,
    "Row total",
  ];
  const rows = input.lines.map((line) => {
    const dayHours = dates.map((workDate) => {
      const hours =
        line.entries.find((entry) => entry.workDate === workDate)?.hours ?? 0;
      return hoursText(hours, input.hoursFormat);
    });
    return [
      line.projectCodeCategory,
      selectionForLine(line),
      line.activityType ?? "",
      ...dayHours,
      hoursText(lineWeekTotal(line), input.hoursFormat),
    ];
  });
  const totals = dayTotals(input.lines, input.weekStartDate);
  rows.push([
    "Weekly Total",
    "",
    "",
    ...totals.map((total) => hoursText(total, input.hoursFormat)),
    hoursText(overallWeekTotal(input.lines), input.hoursFormat),
  ]);
  return { headers, rows };
}

function fileBase(weekStartDate: string): string {
  return `timesheet-${weekStartDate}`;
}

function buildCsvBlob(table: TimesheetExportTable): Blob {
  const lines = [
    table.headers.map(escapeCsv).join(","),
    ...table.rows.map((row) => row.map(escapeCsv).join(",")),
  ];
  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

function buildExcelBlob(table: TimesheetExportTable): Blob {
  const headerCells = table.headers
    .map(
      (header) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeMarkup(header)}</Data></Cell>`,
    )
    .join("");
  const dataRows = table.rows
    .map(
      (row) =>
        `<Row>${row
          .map(
            (cell) =>
              `<Cell><Data ss:Type="String">${escapeMarkup(cell)}</Data></Cell>`,
          )
          .join("")}</Row>`,
    )
    .join("");
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="Header"><Font ss:Bold="1"/></Style>
</Styles>
<Worksheet ss:Name="Timesheet">
<Table>
<Row>${headerCells}</Row>
${dataRows}
</Table>
</Worksheet>
</Workbook>`;
  return new Blob([xml], { type: "application/vnd.ms-excel" });
}

function buildPdfBlob(
  input: TimesheetExportInput,
  table: TimesheetExportTable,
): Blob {
  return buildTablePdfBlob((doc) => {
    const titleParts = ["Timesheet", input.weekStartDate];
    if (input.weekEndDate) {
      titleParts.push(`– ${input.weekEndDate}`);
    }
    doc.setFontSize(12);
    doc.text(titleParts.join(" "), 36, 36);
    const subtitle = [input.employeeLabel, input.status]
      .filter((part) => (part ?? "").trim())
      .join(" · ");
    if (subtitle) {
      doc.setFontSize(9);
      doc.text(subtitle, 36, 52);
    }
    return {
      startY: subtitle ? 62 : 48,
      head: [table.headers as string[]],
      body: table.rows.map((row) => [...row]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [63, 125, 58] },
    };
  });
}

export function exportTimesheetWeek(
  input: TimesheetExportInput,
  format: TimesheetExportFormat,
): void {
  const table = buildTimesheetExportTable(input);
  const base = fileBase(input.weekStartDate);
  if (format === "csv") {
    downloadBlob(buildCsvBlob(table), `${base}.csv`);
    return;
  }
  if (format === "excel") {
    downloadBlob(buildExcelBlob(table), `${base}.xls`);
    return;
  }
  downloadBlob(buildPdfBlob(input, table), `${base}.pdf`);
}
