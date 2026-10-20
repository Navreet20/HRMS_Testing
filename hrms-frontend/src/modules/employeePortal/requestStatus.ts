import type { StatusTone } from "@/shared/ui";

/** The badge colour for a request's status label, the same on every request screen. */
export function requestStatusTone(statusLabel: string): StatusTone {
  if (statusLabel === "Approved" || statusLabel === "Completed") {
    return "success";
  }
  if (statusLabel === "Rejected") {
    return "danger";
  }
  if (statusLabel === "Pending") {
    return "warning";
  }
  return "info";
}
