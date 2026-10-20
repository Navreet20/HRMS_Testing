"use client";

import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  CLIENT_CATEGORY_LABELS,
  type ClientCategory,
} from "@/modules/clients/clientCategory";
import { AppButton, AppPopover, AppSelect, AppTextField } from "@/shared/ui";
import {
  OTHER_TYPE_CATCH_ALL,
  PROJECT_CODE_CATEGORIES,
  PROJECT_CODE_CATEGORY_LABELS,
  PROJECT_CODE_CATEGORY_ON_LEAVE,
  PROJECT_CODE_CATEGORY_OTHER,
  type ProjectCodeCategory,
  MAX_TIMESHEET_ROWS,
} from "../constants";
import {
  categoryAllowsActivity,
  dayHeaderParts,
  dayLabelForDate,
  dayTotals,
  dayTotalWarning,
  formatDigitRunAsClockDraft,
  formatHours,
  formatHoursTotal,
  lineWeekTotal,
  overallWeekTotal,
  parseHoursEntry,
  selectionOptionsForCategory,
  isWeekendIso,
  selectionValueForLine,
  todayIso,
  weekDatesFromStart,
} from "../selectors";
import type {
  HoursFormat,
  ProjectCodeOption,
  ProjectCodeOptions,
  TimesheetDayLabel,
  TimesheetDayMarker,
  TimesheetLineRecord,
} from "../types";

interface TimesheetWeekGridProps {
  readonly weekStartDate: string;
  readonly lines: readonly TimesheetLineRecord[];
  readonly cascadeOptions: ProjectCodeOptions | null;
  readonly canEdit: boolean;
  /** Company hours format for typing and showing hours (default 7:30). */
  readonly hoursFormat?: HoursFormat;
  /** Add a blank row; with a row key, insert it directly below that row. */
  readonly onAddRow: (afterClientKey?: string) => void;
  readonly onRemoveRow: (clientKey: string) => void;
  readonly onCategoryChange: (clientKey: string, category: string) => void;
  readonly onSelectionChange: (clientKey: string, value: string) => void;
  readonly onActivityChange: (clientKey: string, activityType: string) => void;
  readonly onOtherCommentChange: (clientKey: string, comment: string) => void;
  readonly onHoursChange: (
    clientKey: string,
    workDate: string,
    hours: number,
  ) => void;
  readonly onHoursInvalid?: (message: string) => void;
  /** Actions bar rendered inside the same card, under the table. */
  readonly footer?: ReactNode;
  /** Week status: Submitted, Approved and Rejected draw a coloured strip on top. */
  readonly status?: string;
  /** Holidays and leave days: a tag in the day header and a coloured column. */
  readonly dayMarkers?: readonly TimesheetDayMarker[];
}

/** Status colour for the strip along the top of the grid card (none for Draft). */
const STATUS_STRIP: Record<string, string> = {
  Submitted: "border-t-emp-warning",
  Approved: "border-t-emp-success",
  Rejected: "border-t-emp-critical",
};

/** "Mon Sep 21" for error messages. */
function dayLabel(workDate: string): string {
  const { weekday, date } = dayHeaderParts(workDate);
  return `${weekday} ${date}`;
}

const DAYS_IN_WEEK = 7;
const weekendBg = "bg-emp-raised/60";
/** Small caps label used by the Work item / Total headers and "Weekly total". */
const COLUMN_LABEL =
  "text-[0.85rem] font-extrabold uppercase tracking-[0.04em] text-emp-muted";
const todayBg = "bg-emp-accent-soft/60";
const todayLine = "shadow-[inset_0_-2px_0_var(--color-emp-accent)]";

/**
 * Holiday and leave days colour the whole column (a half day lighter), with a
 * matching line under the header. Pending leave only gets a dashed tag.
 * Every cell still takes hours.
 */
const DAY_TONE: Record<
  TimesheetDayLabel["tone"],
  { readonly column: string; readonly line: string; readonly tag: string }
> = {
  holiday: {
    column: "bg-emp-holiday-soft",
    line: "shadow-[inset_0_-2px_0_var(--color-emp-holiday)]",
    tag: "bg-emp-holiday-soft text-emp-holiday",
  },
  leave: {
    column: "bg-emp-warning-soft",
    line: "shadow-[inset_0_-2px_0_var(--color-emp-warning)]",
    tag: "bg-emp-warning-soft text-emp-warning",
  },
  halfLeave: {
    column: "bg-emp-warning-soft/50",
    line: "shadow-[inset_0_-2px_0_color-mix(in_srgb,var(--color-emp-warning)_55%,transparent)]",
    tag: "bg-emp-warning-soft text-emp-warning",
  },
  pending: {
    column: "",
    line: "",
    tag: "border border-dashed border-emp-line text-emp-muted",
  },
};

type GridColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
  footerClassName?: string;
};

const gridFeatures = tableFeatures({
  columnMeta: {} as GridColumnMeta,
});
const columnHelper = createColumnHelper<
  typeof gridFeatures,
  TimesheetLineRecord
>();

/**
 * Corporate day-hours cell: bordered box, muted empty, bold when set.
 */
/** Focus the hours cell `rows` down and `days` across from this one (Excel-style). */
function focusHoursCell(
  from: HTMLElement,
  rowIndex: number,
  dayIndex: number,
  rows: number,
  days: number,
): boolean {
  const target = from
    .closest("table")
    ?.querySelector<HTMLInputElement>(
      `[data-hours-row="${rowIndex + rows}"][data-hours-day="${dayIndex + days}"] input`,
    );
  if (!target || target.disabled) {
    return false;
  }
  target.focus();
  target.select();
  return true;
}

function HoursCell({
  workDate,
  rowIndex,
  dayIndex,
  onAddRowBelow,
  fractionalHours,
  format,
  canEdit,
  isLeave = false,
  onCommit,
  onInvalid,
}: {
  readonly workDate: string;
  /** "On leave" rows show their hours in amber, apart from work hours. */
  readonly isLeave?: boolean;
  /** Position in the grid, for keyboard moves between cells. */
  readonly rowIndex: number;
  readonly dayIndex: number;
  /** Ctrl+Enter (⌘+Enter on Mac) adds a row below and moves there. */
  readonly onAddRowBelow?: () => void;
  readonly fractionalHours: number;
  readonly format: HoursFormat;
  readonly canEdit: boolean;
  readonly onCommit: (fractionalHours: number) => void;
  readonly onInvalid?: (message: string) => void;
}) {
  const committed = formatHours(fractionalHours, format);
  const [text, setText] = useState(committed);
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (focused) {
      return;
    }
    setText(formatHours(fractionalHours, format));
    setInvalid(false);
  }, [fractionalHours, focused, format]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === "—") {
      setInvalid(false);
      setText("");
      onCommit(0);
      return;
    }
    const result = parseHoursEntry(trimmed, format);
    if (!result.ok) {
      setInvalid(true);
      onInvalid?.(`${dayLabel(workDate)}: ${result.error}`);
      return;
    }
    setInvalid(false);
    setText(formatHours(result.hours, format));
    onCommit(result.hours);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const move = (rows: number, days: number) =>
      focusHoursCell(input, rowIndex, dayIndex, rows, days);
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+Enter / ⌘+Enter: save and add a row below.
          input.blur();
          onAddRowBelow?.();
          break;
        }
        // Down a row (Shift+Enter: up). On the last row, save and stay in the cell.
        if (!move(event.shiftKey ? -1 : 1, 0)) {
          commit(textRef.current);
          input.select();
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        move(1, 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1, 0);
        break;
      // Move to the next day when the cursor is at the edge of the text. A cell's
      // whole value is selected when you land on it, which also counts.
      case "ArrowLeft":
        if (input.selectionStart === 0 && move(0, -1)) {
          event.preventDefault();
        }
        break;
      case "ArrowRight":
        if (input.selectionEnd === input.value.length && move(0, 1)) {
          event.preventDefault();
        }
        break;
      // Tab: next day, then Sunday of the next row (Shift+Tab goes back), like
      // Excel. From the last cell it leaves the grid as usual (to Save).
      case "Tab": {
        const step = event.shiftKey ? -1 : 1;
        const moved =
          move(0, step) ||
          (event.shiftKey
            ? focusHoursCell(input, rowIndex - 1, 0, 0, DAYS_IN_WEEK - 1)
            : focusHoursCell(input, rowIndex + 1, 0, 0, 0));
        if (moved) {
          event.preventDefault();
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        setText(committed);
        setInvalid(false);
        break;
      default:
        break;
    }
  }

  const hasValue = fractionalHours > 0;
  const showText = focused ? text : hasValue ? committed : "";
  return (
    <div
      data-hours-row={rowIndex}
      data-hours-day={dayIndex}
      className="h-full w-full"
      // A click anywhere in the cell (not just on the text) starts typing.
      onMouseDown={(event) => {
        const input = event.currentTarget.querySelector("input");
        if (input && event.target !== input && !input.disabled) {
          event.preventDefault();
          input.focus();
          input.select();
        }
      }}
    >
      <AppTextField
      size="compact"
      align="center"
      inputMode={format === "decimal" ? "decimal" : "numeric"}
      disabled={!canEdit}
      invalid={invalid}
      className="w-full min-w-[3.6rem]"
      // No box: a light fill on hover, the app's rounded green border while typing.
      inputClassName={[
        // Hover shows the field's rounded outline; typing turns it green.
        // Read-only weeks (disabled) don't react to hover.
        "!h-[2.25rem] !rounded-[0.4rem] !bg-transparent enabled:hover:not-focus:!bg-emp-raised/60 focus:!bg-emp-surface disabled:!opacity-100",
        invalid
          ? "!border-emp-critical text-emp-critical"
          : "!border-transparent enabled:hover:not-focus:!border-emp-line focus:!border-emp-accent",
        invalid
          ? ""
          : focused || hasValue
            ? `font-semibold ${isLeave ? "text-emp-warning" : "text-emp-text"}`
            : "font-normal text-emp-muted placeholder:text-emp-muted/70",
      ].join(" ")}
      value={showText}
      title={`${
        format === "decimal"
          ? "Hours: type 8, 7.5 or 7.25."
          : "Hours: type 8 for 8:00, or 7:15 / 715."
      } Enter or ↓ moves down, Tab or ← → move across, Ctrl+Enter adds a row, Esc undoes.`}
      aria-label={`Hours for ${workDate}`}
      onFocus={() => {
        setFocused(true);
        setText(committed || "");
      }}
      onChange={(next) => {
        if (next === "") {
          setText("");
          setInvalid(false);
          return;
        }
        if (format === "decimal" && /^\d{0,2}(?:[.,]\d{0,2})?$/.test(next)) {
          setText(next);
          setInvalid(false);
          return;
        }
        if (format === "clock" && /^\d{1,4}$/.test(next)) {
          setText(formatDigitRunAsClockDraft(next));
          setInvalid(false);
          return;
        }
        if (/^\d{1,2}:\d{0,2}$/.test(next)) {
          setText(next);
          setInvalid(false);
        }
      }}
      onBlur={() => {
        setFocused(false);
        commit(textRef.current);
      }}
      onKeyDown={handleKeyDown}
    />
    </div>
  );
}

/** Short category names for the tag in the Work item column. */
const CATEGORY_TAG: Record<ProjectCodeCategory, string> = {
  "Allocated Projects": "Allocated",
  "Internal Project Codes": "Internal",
  "On Leave": "On leave",
  Other: "Other",
};

function categoryTag(category: string): { label: string; className: string } {
  const label = CATEGORY_TAG[category as ProjectCodeCategory] ?? category;
  if (category === PROJECT_CODE_CATEGORY_ON_LEAVE) {
    return { label, className: "bg-emp-warning-soft text-emp-warning" };
  }
  if (category === PROJECT_CODE_CATEGORY_OTHER) {
    return { label, className: "bg-emp-raised text-emp-muted" };
  }
  return { label, className: "bg-emp-accent-soft text-emp-accent" };
}

/** Client type pill under an allocated project's category tag. */
const CLIENT_CATEGORY_PILL: Record<ClientCategory, string> = {
  direct: "bg-emp-holiday-soft text-emp-holiday",
  intermediary: "bg-emp-holiday-soft text-emp-holiday",
  internal: "bg-emp-raised text-emp-muted",
};

/** The option behind the chosen project, leave type or other type. */
function selectedOption(
  line: TimesheetLineRecord,
  cascadeOptions: ProjectCodeOptions | null,
): ProjectCodeOption | undefined {
  const value = selectionValueForLine(line);
  if (!value) {
    return undefined;
  }
  return selectionOptionsForCategory(
    line.projectCodeCategory,
    cascadeOptions,
  ).find((item) => item.code === value);
}

/** Label for the chosen project, leave type or other type ("" when none). */
function selectionLabel(
  line: TimesheetLineRecord,
  option: ProjectCodeOption | undefined,
): string {
  const value = selectionValueForLine(line);
  if (!value) {
    return "";
  }
  return option && option.label !== option.code
    ? `${option.code} · ${option.label}`
    : value;
}

/** "Acme (Intermediary)" for the hover text and project menu; "" without a client. */
function clientLabel(option: ProjectCodeOption | undefined): string {
  if (!option?.clientCategory) {
    return "";
  }
  const category = CLIENT_CATEGORY_LABELS[option.clientCategory];
  return option.clientName ? `${option.clientName} (${category})` : category;
}

/** Second line under the project: activity, "Leave", or the Other comment. */
function selectionDetail(line: TimesheetLineRecord): string {
  const category = line.projectCodeCategory;
  if (category === PROJECT_CODE_CATEGORY_ON_LEAVE) {
    return "Leave";
  }
  if (category === PROJECT_CODE_CATEGORY_OTHER) {
    return line.otherType === OTHER_TYPE_CATCH_ALL
      ? line.otherComment || "Add a comment"
      : "Other";
  }
  return line.activityType || "Choose activity";
}

/**
 * One "Work item" cell: category tag, project and activity. Clicking it opens
 * a small panel to choose all three. Hovering shows the full name.
 */
function WorkItemCell({
  line,
  cascadeOptions,
  canEdit,
  onCategoryChange,
  onSelectionChange,
  onActivityChange,
  onOtherCommentChange,
}: {
  readonly line: TimesheetLineRecord;
  readonly cascadeOptions: ProjectCodeOptions | null;
  readonly canEdit: boolean;
  readonly onCategoryChange: (clientKey: string, category: string) => void;
  readonly onSelectionChange: (clientKey: string, value: string) => void;
  readonly onActivityChange: (clientKey: string, activityType: string) => void;
  readonly onOtherCommentChange: (clientKey: string, comment: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const category = line.projectCodeCategory;
  const option = selectedOption(line, cascadeOptions);
  const name = selectionLabel(line, option);
  const client = clientLabel(option);
  const clientCategory = option?.clientCategory;
  const detail = selectionDetail(line);
  const tag = categoryTag(category);
  const options = selectionOptionsForCategory(category, cascadeOptions);
  const activityTypes = cascadeOptions?.activityTypes ?? [];
  const selectionName =
    category === PROJECT_CODE_CATEGORY_ON_LEAVE
      ? "Leave type"
      : category === PROJECT_CODE_CATEGORY_OTHER
        ? "Type"
        : "Project";
  const emptyHint =
    options.length === 0 &&
    category !== PROJECT_CODE_CATEGORY_OTHER &&
    category !== PROJECT_CODE_CATEGORY_ON_LEAVE
      ? "No projects allocated"
      : `Choose ${selectionName.toLowerCase()}…`;

  const content = name ? (
    <>
      <span className="flex w-[7.25rem] shrink-0 flex-col items-center gap-[0.15rem]">
        <span
          className={`w-full rounded-full px-[0.45rem] py-[0.05rem] text-center text-[0.85rem] font-bold whitespace-nowrap ${tag.className}`}
        >
          {tag.label}
        </span>
        {clientCategory ? (
          <span
            className={`rounded-full px-[0.4rem] text-[0.72rem] leading-tight font-bold whitespace-nowrap ${CLIENT_CATEGORY_PILL[clientCategory]}`}
          >
            {CLIENT_CATEGORY_LABELS[clientCategory]}
          </span>
        ) : null}
      </span>
      <span className="grid min-w-0 leading-tight">
        <span className="truncate font-semibold text-emp-text">{name}</span>
        <span className="truncate text-[0.85rem] text-emp-muted">{detail}</span>
      </span>
    </>
  ) : (
    <span className="text-emp-muted">Choose work item</span>
  );
  const fullName = name
    ? [name, client && `Client: ${client}`, detail].filter(Boolean).join(" · ")
    : undefined;
  const boxClass =
    "flex h-[2.6rem] w-[18rem] min-w-0 items-center gap-[0.6rem] rounded-[0.4rem] border border-transparent bg-transparent px-[0.5rem] text-left text-[0.85rem]";

  if (!canEdit) {
    return (
      <div className={`${boxClass} text-[0.82rem]`} title={fullName}>
        {content}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${boxClass} cursor-pointer hover:border-emp-line ${
          anchor ? "!border-emp-accent" : ""
        }`}
        title={fullName}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        onClick={(event) => {
          const target = event.currentTarget;
          setAnchor((current) => (current ? null : target));
        }}
      >
        {content}
      </button>
      <AppPopover
        open={anchor !== null}
        anchor={anchor}
        ariaLabel="Work item"
        className="w-[20rem] max-w-[calc(100vw-1rem)]"
        onClose={() => setAnchor(null)}
      >
        <AppSelect
          label="Category"
          value={category}
          options={PROJECT_CODE_CATEGORIES.map((item) => ({
            value: item,
            label: PROJECT_CODE_CATEGORY_LABELS[item],
          }))}
          onChange={(next) => onCategoryChange(line.clientKey, next)}
        />
        <AppSelect
          label={selectionName}
          wideMenu
          value={selectionValueForLine(line)}
          disabled={options.length === 0}
          placeholder={emptyHint}
          options={options.map((item) => {
            const base =
              item.label === item.code ? item.code : `${item.code} · ${item.label}`;
            const itemClient = clientLabel(item);
            return {
              value: item.code,
              label: itemClient ? `${base} — ${itemClient}` : base,
            };
          })}
          onChange={(next) => onSelectionChange(line.clientKey, next)}
        />
        {category === PROJECT_CODE_CATEGORY_OTHER &&
        line.otherType === OTHER_TYPE_CATCH_ALL ? (
          <AppTextField
            label="Comment"
            value={line.otherComment ?? ""}
            maxLength={255}
            placeholder="Required for Other"
            onChange={(comment) => onOtherCommentChange(line.clientKey, comment)}
          />
        ) : null}
        {categoryAllowsActivity(category) ? (
          <AppSelect
            label="Activity"
            value={line.activityType ?? ""}
            placeholder="Choose activity…"
            options={activityTypes.map((activity) => ({
              value: activity,
              label: activity,
            }))}
            onChange={(next) => onActivityChange(line.clientKey, next)}
          />
        ) : null}
        <div className="flex justify-end">
          <AppButton
            size="compact"
            onClick={() => {
              const opener = anchor;
              setAnchor(null);
              opener?.focus();
            }}
          >
            Done
          </AppButton>
        </div>
      </AppPopover>
    </>
  );
}

/**
 * Weekly timesheet grid (TanStack Table): Work item, one hours column per
 * day, row Total, and the weekly total in the table footer. Each row has a
 * "+" that inserts a blank row below it: always shown on the last row, on
 * hover for the others.
 */
export function TimesheetWeekGrid({
  weekStartDate,
  lines,
  cascadeOptions,
  canEdit,
  hoursFormat = "clock",
  onAddRow,
  onRemoveRow,
  onCategoryChange,
  onSelectionChange,
  onActivityChange,
  onOtherCommentChange,
  onHoursChange,
  onHoursInvalid,
  footer,
  status,
  dayMarkers,
}: TimesheetWeekGridProps) {
  const strip = status ? STATUS_STRIP[status] : undefined;
  const gridRef = useRef<HTMLDivElement>(null);
  // Cell to focus once a row added from the keyboard (Enter) appears.
  const pendingFocus = useRef<{ row: number; day: number } | null>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) {
      return;
    }
    const input = gridRef.current?.querySelector<HTMLInputElement>(
      `[data-hours-row="${target.row}"][data-hours-day="${target.day}"] input`,
    );
    if (input) {
      pendingFocus.current = null;
      input.focus();
      input.select();
    }
  }, [lines]);

  const dates = weekDatesFromStart(weekStartDate);
  const totalsByDay = dayTotals(lines, weekStartDate);
  const grandTotal = overallWeekTotal(lines);
  const today = todayIso();

  const columns = columnHelper.columns([
    ...(canEdit
      ? [
          columnHelper.display({
            id: "insert",
            header: () => <span className="sr-only">Insert row</span>,
            cell: ({ row }) => (
              <button
                type="button"
                disabled={lines.length >= MAX_TIMESHEET_ROWS}
                className={`inline-grid size-[1.6rem] cursor-pointer place-items-center rounded-[0.35rem] border-0 bg-transparent p-0 text-emp-muted transition-opacity hover:bg-emp-accent/10 hover:text-emp-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-emp-muted ${
                  row.index === lines.length - 1
                    ? "opacity-100"
                    : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                }`}
                title={
                  lines.length >= MAX_TIMESHEET_ROWS
                    ? `A week can have up to ${MAX_TIMESHEET_ROWS} rows`
                    : "Insert 1 row below"
                }
                aria-label={`Insert 1 row below row ${row.index + 1}`}
                onClick={() => onAddRow(row.original.clientKey)}
              >
                <Plus size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            ),
            meta: {
              headerClassName: "w-[2rem] px-[0.2rem]",
              cellClassName: "w-[2rem] px-[0.2rem] py-[0.4rem] text-center",
            },
          }),
        ]
      : []),
    columnHelper.display({
      id: "workItem",
      header: "Work item",
      cell: ({ row }) => (
        <WorkItemCell
          line={row.original}
          cascadeOptions={cascadeOptions}
          canEdit={canEdit}
          onCategoryChange={onCategoryChange}
          onSelectionChange={onSelectionChange}
          onActivityChange={onActivityChange}
          onOtherCommentChange={onOtherCommentChange}
        />
      ),
      footer: "Weekly total",
      meta: {
        headerClassName: `pl-[0.85rem] pr-[0.65rem] py-[0.55rem] ${COLUMN_LABEL}`,
        cellClassName: "px-[0.35rem] py-[0.3rem]",
        footerClassName: `pl-[0.85rem] pr-[0.65rem] py-[0.6rem] ${COLUMN_LABEL}`,
      },
    }),
    ...dates.map((workDate, index) => {
      const weekend = isWeekendIso(workDate);
      const isToday = workDate === today;
      const dayTag = dayLabelForDate(dayMarkers, workDate);
      const tone = dayTag ? DAY_TONE[dayTag.tone] : null;
      const dayBg =
        tone?.column || (isToday ? todayBg : weekend ? weekendBg : "");
      const headerLine = tone?.line || (isToday ? todayLine : "");
      const total = totalsByDay[index] ?? 0;
      const warning = dayTotalWarning(workDate, total);
      const { weekday, date } = dayHeaderParts(workDate);
      return columnHelper.display({
        id: `day-${workDate}`,
        header: () => (
          <span className="grid justify-items-center leading-tight">
            <span
              className={`text-[0.85rem] font-bold ${
                isToday ? "text-emp-accent" : "text-emp-text"
              }`}
            >
              {weekday}
            </span>
            <span className="text-[0.85rem] font-normal">{date}</span>
            {dayTag && tone ? (
              <span
                className={`mt-[0.25rem] cursor-default rounded-full px-[0.45rem] py-[0.05rem] text-[0.85rem] font-extrabold whitespace-nowrap ${tone.tag}`}
                title={dayTag.title}
                aria-label={`${dayTag.tag}: ${dayTag.title.replace(/\n/g, "; ")}`}
              >
                {dayTag.tag}
              </span>
            ) : null}
          </span>
        ),
        cell: ({ row }) => (
          <HoursCell
            workDate={workDate}
            rowIndex={row.index}
            dayIndex={index}
            onAddRowBelow={
              canEdit && lines.length < MAX_TIMESHEET_ROWS
                ? () => {
                    pendingFocus.current = { row: row.index + 1, day: index };
                    onAddRow(row.original.clientKey);
                  }
                : undefined
            }
            fractionalHours={
              row.original.entries.find((item) => item.workDate === workDate)
                ?.hours ?? 0
            }
            format={hoursFormat}
            canEdit={canEdit}
            isLeave={
              row.original.projectCodeCategory === PROJECT_CODE_CATEGORY_ON_LEAVE
            }
            onCommit={(fractional) =>
              onHoursChange(row.original.clientKey, workDate, fractional)
            }
            onInvalid={onHoursInvalid}
          />
        ),
        footer: () => (
          <span
            className={
              warning === "over"
                ? "font-bold text-emp-critical"
                : total > 0
                  ? "text-emp-text"
                  : "font-normal text-emp-muted"
            }
            title={warning === "over" ? "More than 24:00 in one day" : undefined}
          >
            {formatHoursTotal(total, hoursFormat)}
          </span>
        ),
        meta: {
          headerClassName: `min-w-[4.6rem] px-[0.3rem] py-[0.5rem] text-center align-top ${dayBg} ${headerLine}`,
          cellClassName: `px-[0.25rem] py-[0.4rem] ${dayBg}`,
          footerClassName: `px-[0.3rem] py-[0.6rem] text-center text-[0.85rem] ${tone?.column ?? ""}`,
        },
      });
    }),
    columnHelper.display({
      id: "rowTotal",
      header: "Total",
      cell: ({ row }) => (
        <span
          className={
            row.original.projectCodeCategory === PROJECT_CODE_CATEGORY_ON_LEAVE
              ? "text-emp-warning"
              : undefined
          }
        >
          {formatHoursTotal(lineWeekTotal(row.original), hoursFormat)}
        </span>
      ),
      footer: () => formatHoursTotal(grandTotal, hoursFormat),
      meta: {
        headerClassName: `min-w-[4.5rem] px-[0.45rem] py-[0.55rem] text-center ${COLUMN_LABEL}`,
        cellClassName: "px-[0.45rem] py-[0.4rem] text-center font-bold tabular-nums text-emp-text",
        footerClassName: "px-[0.45rem] py-[0.6rem] text-center text-[0.9rem] font-extrabold",
      },
    }),
    columnHelper.display({
      id: "remove",
      header: () => <span className="sr-only">Remove row</span>,
      cell: ({ row }) =>
        canEdit ? (
          <AppButton
            variant="ghost"
            size="icon"
            className="text-emp-muted hover:border-emp-critical hover:text-emp-critical"
            aria-label="Remove row"
            title="Remove row"
            onClick={() => onRemoveRow(row.original.clientKey)}
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
          </AppButton>
        ) : null,
      meta: {
        headerClassName: "w-[2.5rem] px-[0.35rem] py-[0.55rem]",
        cellClassName: "px-[0.25rem] py-[0.35rem]",
      },
    }),
  ]);

  const table = useTable({
    features: gridFeatures,
    columns,
    data: lines as TimesheetLineRecord[],
    getRowId: (line) => line.clientKey,
  });
  const columnCount = table.getAllLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <div
      ref={gridRef}
      data-status={status}
      className={`bg-emp-surface ${
        strip ? `border-0 border-t-[3px] border-solid ${strip}` : ""
      }`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[0.85rem]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b-2 border-emp-line bg-emp-surface text-emp-muted"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={header.column.columnDef.meta?.headerClassName}
                  >
                    <table.FlexRender header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-[0.85rem] py-[1.4rem] text-center text-emp-muted"
                >
                  <div className="grid justify-items-center gap-[0.65rem]">
                    <span>No rows yet. Add a row to start logging hours for this week.</span>
                    {canEdit ? (
                      <AppButton variant="secondary" onClick={() => onAddRow()}>
                        + Add row
                      </AppButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="group border-b border-emp-line">
                  {row.getAllCells().map((cell) => {
                    // Call the cell function directly: FlexRender treats it as a
                    // component, and since the columns are rebuilt on every render,
                    // every cell (and the cursor in it) would be replaced after each save.
                    const render = cell.column.columnDef.cell;
                    return (
                      <td
                        key={cell.id}
                        className={cell.column.columnDef.meta?.cellClassName}
                      >
                        {typeof render === "function" ? render(cell.getContext()) : render}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            {table.getFooterGroups().slice(0, 1).map((footerGroup) => (
              <tr
                key={footerGroup.id}
                className="border-t-2 border-emp-line font-semibold tabular-nums text-emp-text"
              >
                {footerGroup.headers.map((header) => (
                  <td
                    key={header.id}
                    className={header.column.columnDef.meta?.footerClassName}
                  >
                    <table.FlexRender footer={header} />
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      {footer ? <div className="pt-1">{footer}</div> : null}
    </div>
  );
}
