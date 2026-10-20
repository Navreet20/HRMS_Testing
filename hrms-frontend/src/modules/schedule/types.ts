import type { AppTheme } from "@/shared";

export type ScheduleView = "calendar" | "agenda";

export type ScheduleEventKind =
  | "meeting"
  | "deadline"
  | "leave"
  | "reminder";

export interface ScheduleEvent {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime?: string;
  readonly kind: ScheduleEventKind;
}

export interface ScheduleModuleData {
  readonly events: readonly ScheduleEvent[];
}

export interface ScheduleFilters {
  readonly search: string;
  readonly kinds: readonly ScheduleEventKind[];
}

/** Hash-aligned destinations for Schedule navigation callbacks. */
export type ScheduleDestination =
  | "/schedule"
  | "/schedule/agenda"
  | "/dashboard";

import type { ScheduleGateway } from "./gateway";

export interface ScheduleModuleProps {
  readonly data?: ScheduleModuleData;
  readonly gateway?: ScheduleGateway;
  readonly theme?: AppTheme;
  readonly defaultTheme?: AppTheme;
  readonly initialView?: ScheduleView;
  readonly onViewChange?: (view: ScheduleView) => void;
  readonly onNavigate?: (destination: ScheduleDestination) => void;
  /** Read-only by default; App sets false for ADMIN/HR so they can create/delete events. */
  readonly readOnly?: boolean;
  /** Called after a user successfully creates an event. */
  readonly onEventCreate?: (event: ScheduleEvent) => void;
  /** Called after a user successfully deletes an event. */
  readonly onEventDelete?: (eventId: string) => void;
}
