import { mapApiHttpError, type ApiHttpMethod } from "@/shared";
import type { DeliveryQuery, TemplateWording } from "./types";

export type NotificationsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface NotificationsGateway {
  listDeliveries(query: DeliveryQuery): Promise<unknown>;
  retryDelivery(deliveryId: string): Promise<unknown>;
  withdrawDelivery(deliveryId: string): Promise<unknown>;
  listTemplates(): Promise<unknown>;
  saveTemplate(key: string, wording: TemplateWording): Promise<unknown>;
  /** Back to the built-in wording. */
  resetTemplate(key: string): Promise<unknown>;
  previewTemplate(key: string, wording: TemplateWording): Promise<unknown>;
  /** Queue one sample of a template. Does not replace automatic sends. */
  sendTestEmail(key: string, toEmail: string): Promise<unknown>;
}

async function run<T>(
  request: NotificationsRequest,
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    return await request<T>(method, path, body);
  } catch (error) {
    throw mapApiHttpError(error);
  }
}

export function createHttpNotificationsGateway(options: {
  readonly request: NotificationsRequest;
}): NotificationsGateway {
  const { request } = options;
  return {
    listDeliveries: (query) => {
      const qs = new URLSearchParams({
        page: String(query.page),
        pageSize: String(query.pageSize),
      });
      if (query.status) {
        qs.set("status", query.status);
      }
      if (query.search?.trim()) {
        qs.set("search", query.search.trim());
      }
      return run(request, "GET", `/notifications/deliveries?${qs.toString()}`);
    },
    retryDelivery: (deliveryId) =>
      run(
        request,
        "POST",
        `/notifications/deliveries/${encodeURIComponent(deliveryId)}/retry`,
      ),
    withdrawDelivery: (deliveryId) =>
      run(
        request,
        "POST",
        `/notifications/deliveries/${encodeURIComponent(deliveryId)}/withdraw`,
      ),
    listTemplates: () => run(request, "GET", "/notifications/templates"),
    saveTemplate: (key, wording) =>
      run(request, "PUT", `/notifications/templates/${encodeURIComponent(key)}`, wording),
    resetTemplate: (key) =>
      run(request, "DELETE", `/notifications/templates/${encodeURIComponent(key)}`),
    previewTemplate: (key, wording) =>
      run(
        request,
        "POST",
        `/notifications/templates/${encodeURIComponent(key)}/preview`,
        wording,
      ),
    sendTestEmail: (key, toEmail) =>
      run(
        request,
        "POST",
        `/notifications/templates/${encodeURIComponent(key)}/send-test`,
        { toEmail },
      ),
  };
}
