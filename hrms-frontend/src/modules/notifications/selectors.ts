import { grantAllowsWrite, type HrmsRole, type SessionAccessGrant } from "@/shared";
import type { StatusTone } from "@/shared/ui/StatusBadge";
import type {
  DeliveryPage,
  DeliveryStatus,
  NotificationDelivery,
  NotificationTemplate,
  TemplatePreview,
} from "./types";

const STATUSES: readonly DeliveryStatus[] = ["pending", "sent", "failed"];

export const DELIVERY_STATUS_LABELS: Readonly<Record<DeliveryStatus, string>> = {
  pending: "Waiting",
  sent: "Sent",
  failed: "Failed",
};

export function deliveryStatusTone(status: DeliveryStatus): StatusTone {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

/** One short line for the log. The full mail-server text stays on hover. */
export function deliveryErrorLabel(error: string): string {
  const text = error.replace(/\s+/g, " ").trim();
  if (/^withdrawn\b/i.test(text)) return "Withdrawn";
  if (text.length <= 42 && !text.includes(". ")) return text;
  if (/login/i.test(text)) return "Login rejected";
  if (/work email address/i.test(text)) return "Address rejected";
  if (/could not reach/i.test(text)) return "Mail server unreachable";
  if (/\btls\b/i.test(text)) return "TLS check failed";
  return "Mail server rejected it";
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function isStatus(value: unknown): value is DeliveryStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function normalizeDelivery(raw: unknown): NotificationDelivery {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(row.id),
    event: strOrNull(row.event),
    eventName: str(row.eventName) || "Email",
    toEmail: str(row.toEmail),
    subject: str(row.subject),
    status: isStatus(row.status) ? row.status : "pending",
    attempts: typeof row.attempts === "number" ? row.attempts : 0,
    lastError: strOrNull(row.lastError),
    createdAt: strOrNull(row.createdAt),
    nextAttemptAt: strOrNull(row.nextAttemptAt),
    sentAt: strOrNull(row.sentAt),
  };
}

export function normalizeDeliveryPage(raw: unknown): DeliveryPage {
  const row = (raw ?? {}) as Record<string, unknown>;
  const counts = (row.counts ?? {}) as Record<string, unknown>;
  return {
    items: Array.isArray(row.items) ? row.items.map(normalizeDelivery) : [],
    total: typeof row.total === "number" ? row.total : 0,
    page: typeof row.page === "number" ? row.page : 0,
    pageSize: typeof row.pageSize === "number" ? row.pageSize : 25,
    counts: {
      pending: typeof counts.pending === "number" ? counts.pending : 0,
      sent: typeof counts.sent === "number" ? counts.sent : 0,
      failed: typeof counts.failed === "number" ? counts.failed : 0,
    },
  };
}

export function normalizeTemplate(raw: unknown): NotificationTemplate {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    key: str(row.key),
    name: str(row.name),
    description: str(row.description),
    recipients: str(row.recipients),
    placeholders: Array.isArray(row.placeholders)
      ? row.placeholders.filter((p): p is string => typeof p === "string")
      : [],
    subject: strOrNull(row.subject),
    body: strOrNull(row.body),
    defaultSubject: strOrNull(row.defaultSubject),
    defaultBody: strOrNull(row.defaultBody),
    customized: row.customized === true,
    updatedBy: strOrNull(row.updatedBy),
    updatedDate: strOrNull(row.updatedDate),
    editable: row.editable !== false,
  };
}

export function normalizeTemplates(raw: unknown): NotificationTemplate[] {
  return Array.isArray(raw) ? raw.map(normalizeTemplate) : [];
}

export function normalizePreview(raw: unknown): TemplatePreview {
  const row = (raw ?? {}) as Record<string, unknown>;
  return { subject: str(row.subject), body: str(row.body) };
}

/** "Sep 28, 2026, 3:04 PM" in the viewer's time zone; "—" when missing. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Editing wording needs the same access as retrying: Company Setup full access. */
export function canEditTemplates(
  role: HrmsRole | undefined,
  grants: readonly SessionAccessGrant[],
): boolean {
  return canRetryDeliveries(role, grants);
}

/** Retrying needs Company Setup full access (Superadmin view has it). */
export function canRetryDeliveries(
  role: HrmsRole | undefined,
  grants: readonly SessionAccessGrant[],
): boolean {
  return role === "SUPERADMIN" || grantAllowsWrite(grants, "companySetup");
}

/** When the email was (or will be) sent, for the table. */
export function deliveryWhen(delivery: NotificationDelivery): string {
  if (delivery.status === "sent") return formatDateTime(delivery.sentAt);
  if (delivery.status === "pending" && delivery.nextAttemptAt && delivery.attempts > 0) {
    return `Retry ${formatDateTime(delivery.nextAttemptAt)}`;
  }
  return formatDateTime(delivery.createdAt);
}
