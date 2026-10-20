import type { HrmsRole, SessionAccessGrant } from "@/shared";
import type { AppTheme } from "@/shared";
import type { NotificationsGateway } from "./gateway";

export type DeliveryStatus = "pending" | "sent" | "failed";

/** One queued / sent email from the notification queue. */
export interface NotificationDelivery {
  readonly id: string;
  readonly event: string | null;
  readonly eventName: string;
  readonly toEmail: string;
  readonly subject: string;
  readonly status: DeliveryStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly createdAt: string | null;
  readonly nextAttemptAt: string | null;
  readonly sentAt: string | null;
}

export interface DeliveryPage {
  readonly items: readonly NotificationDelivery[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly counts: Readonly<Record<DeliveryStatus, number>>;
}

/** A notification email's template: who receives it and its wording. */
export interface NotificationTemplate {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly recipients: string;
  readonly placeholders: readonly string[];
  /** The wording in use (edited, else the default); null for fixed-layout emails. */
  readonly subject: string | null;
  readonly body: string | null;
  readonly defaultSubject: string | null;
  readonly defaultBody: string | null;
  /** True when someone edited the wording in Company Setup. */
  readonly customized: boolean;
  readonly updatedBy: string | null;
  readonly updatedDate: string | null;
  readonly editable: boolean;
}

export interface TemplateWording {
  readonly subject: string;
  readonly body: string;
}

/** An unsaved wording shown with example values. */
export interface TemplatePreview {
  readonly subject: string;
  readonly body: string;
}

export interface DeliveryQuery {
  readonly status?: DeliveryStatus;
  readonly search?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface NotificationsModuleProps {
  readonly role?: HrmsRole;
  readonly accessGrants?: readonly SessionAccessGrant[];
  readonly theme?: AppTheme;
  readonly gateway?: NotificationsGateway;
}
