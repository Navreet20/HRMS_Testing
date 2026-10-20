"use client";

import { useCallback, useEffect, useState } from "react";

import { isAppTheme, mutationErrorMessage } from "@/shared";
import {
  AppButton,
  AppDataTable,
  AppNotice,
  ConfirmDialogShell,
  AppPagination,
  AppSearchField,
  AppSectionCard,
  AppShellToast,
  AppTableSkeleton,
  AppTabs,
  FeedbackState,
  StatusBadge,
  usePersistentState,
  type AppDataTableColumn,
} from "@/shared/ui";
import { TemplateEditor } from "./components/TemplateEditor";
import {
  canEditTemplates,
  canRetryDeliveries,
  DELIVERY_STATUS_LABELS,
  deliveryErrorLabel,
  deliveryStatusTone,
  deliveryWhen,
  normalizeDeliveryPage,
  normalizePreview,
  normalizeTemplate,
  normalizeTemplates,
} from "./selectors";
import type {
  DeliveryPage,
  DeliveryStatus,
  NotificationDelivery,
  NotificationTemplate,
  NotificationsModuleProps,
  TemplateWording,
} from "./types";

const PAGE_SIZE = 25;
const EMPTY_PAGE: DeliveryPage = {
  items: [],
  total: 0,
  page: 0,
  pageSize: PAGE_SIZE,
  counts: { pending: 0, sent: 0, failed: 0 },
};
type StatusTab = "all" | DeliveryStatus;
const DELIVERY_HEADERS = ["Email", "To", "Status", "Attempts", "When"];

const EMPTY_MESSAGES: Record<StatusTab, { title: string; message: string }> = {
  all: {
    title: "No emails yet",
    message: "Emails appear here as soon as the app sends a notification.",
  },
  failed: { title: "No failed emails", message: "Every email so far was delivered or is on its way." },
  pending: { title: "Nothing waiting", message: "Queued emails are usually sent within a few seconds." },
  sent: { title: "No sent emails yet", message: "Delivered emails appear here." },
};

export function NotificationsModule({
  role,
  accessGrants = [],
  theme,
  gateway,
}: NotificationsModuleProps) {
  const activeTheme = isAppTheme(theme) ? theme : "light";
  const canRetry = canRetryDeliveries(role, accessGrants);
  const canEdit = canEditTemplates(role, accessGrants);
  const [statusTab, setStatusTab] = usePersistentState<StatusTab>(
    "notifications.status",
    "all",
  );
  const [search, setSearch] = usePersistentState("notifications.search", "");
  const [page, setPage] = usePersistentState("notifications.page", 0);
  const [deliveries, setDeliveries] = useState<DeliveryPage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<readonly NotificationTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [pendingWithdraw, setPendingWithdraw] = useState<NotificationDelivery | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDeliveries = useCallback(async () => {
    if (!gateway) return;
    setLoading(true);
    try {
      const raw = await gateway.listDeliveries({
        status: statusTab === "all" ? undefined : statusTab,
        search,
        page,
        pageSize: PAGE_SIZE,
      });
      setDeliveries(normalizeDeliveryPage(raw));
      setLoadError(null);
    } catch (error) {
      setLoadError(mutationErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [gateway, statusTab, search, page]);

  const loadTemplates = useCallback(async () => {
    if (!gateway) return;
    try {
      setTemplates(normalizeTemplates(await gateway.listTemplates()));
      setTemplatesError(null);
    } catch (error) {
      setTemplatesError(mutationErrorMessage(error));
    }
  }, [gateway]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  function replaceTemplate(next: NotificationTemplate) {
    setTemplates((current) =>
      current ? current.map((item) => (item.key === next.key ? next : item)) : current,
    );
  }

  async function saveTemplate(key: string, wording: TemplateWording) {
    if (!gateway) return;
    const next = normalizeTemplate(await gateway.saveTemplate(key, wording));
    replaceTemplate(next);
    setNotice(`"${next.name}" updated. New emails use this wording.`);
  }

  async function resetTemplate(key: string) {
    if (!gateway) return;
    const next = normalizeTemplate(await gateway.resetTemplate(key));
    replaceTemplate(next);
    setNotice(`"${next.name}" is back to the default wording.`);
  }

  async function previewTemplate(key: string, wording: TemplateWording) {
    if (!gateway) throw new Error("Not connected");
    return normalizePreview(await gateway.previewTemplate(key, wording));
  }

  async function sendTest(key: string, toEmail: string) {
    if (!gateway) return;
    const template = templates?.find((item) => item.key === key);
    await gateway.sendTestEmail(key, toEmail);
    setNotice(
      `A test "${template?.name ?? "email"}" will be sent to ${toEmail} in a few seconds.`,
    );
    setPage(0);
    setStatusTab("all");
    await loadDeliveries();
  }

  async function withdraw() {
    if (!gateway || !pendingWithdraw) return;
    const delivery = pendingWithdraw;
    setRetrying(delivery.id);
    setActionError(null);
    try {
      await gateway.withdrawDelivery(delivery.id);
      setPendingWithdraw(null);
      setNotice(`Email to ${delivery.toEmail} was withdrawn and will not be sent.`);
      await loadDeliveries();
    } catch (error) {
      setActionError(mutationErrorMessage(error));
    } finally {
      setRetrying(null);
    }
  }

  async function retry(delivery: NotificationDelivery) {
    if (!gateway) return;
    setRetrying(delivery.id);
    setActionError(null);
    try {
      await gateway.retryDelivery(delivery.id);
      setNotice(`Email to ${delivery.toEmail} will be sent again in a few seconds.`);
      await loadDeliveries();
    } catch (error) {
      setActionError(mutationErrorMessage(error));
    } finally {
      setRetrying(null);
    }
  }

  const deliveryColumns: readonly AppDataTableColumn<NotificationDelivery>[] = [
    {
      id: "email",
      header: "Email",
      value: (row) => row.eventName,
      cell: (row) => (
        <span className="grid min-w-0 gap-[0.15rem] leading-snug">
          <span className="truncate font-semibold text-emp-text">{row.eventName}</span>
          <span className="truncate text-[0.85rem] text-emp-muted" title={row.subject}>
            {row.subject}
          </span>
        </span>
      ),
    },
    { id: "to", header: "To", value: (row) => row.toEmail },
    {
      id: "status",
      header: "Status",
      value: (row) => DELIVERY_STATUS_LABELS[row.status],
      cell: (row) => (
        <span className="grid justify-items-start gap-[0.2rem]">
          <StatusBadge
            label={DELIVERY_STATUS_LABELS[row.status]}
            tone={deliveryStatusTone(row.status)}
          />
          {row.lastError ? (
            <span className="text-[0.85rem] text-emp-critical" title={row.lastError}>
              {deliveryErrorLabel(row.lastError)}
            </span>
          ) : null}
        </span>
      ),
    },
    { id: "attempts", header: "Attempts", value: (row) => row.attempts },
    { id: "when", header: "When", value: (row) => deliveryWhen(row) },
    ...(canRetry
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: (row: NotificationDelivery) =>
              row.status === "sent" ? null : (
                <span className="flex flex-wrap gap-[0.4rem]">
                  <AppButton
                    variant="secondary"
                    size="compact"
                    disabled={retrying !== null}
                    onClick={() => void retry(row)}
                  >
                    {retrying === row.id && pendingWithdraw?.id !== row.id
                      ? "Retrying…"
                      : "Retry now"}
                  </AppButton>
                  {row.status === "pending" ? (
                    <AppButton
                      variant="ghost"
                      size="compact"
                      disabled={retrying !== null}
                      onClick={() => setPendingWithdraw(row)}
                    >
                      Withdraw
                    </AppButton>
                  ) : null}
                </span>
              ),
          } satisfies AppDataTableColumn<NotificationDelivery>,
        ]
      : []),
  ];

  const templateColumns: readonly AppDataTableColumn<NotificationTemplate>[] = [
    {
      id: "name",
      header: "Email",
      value: (row) => row.name,
      cell: (row) => (
        <span className="grid min-w-0 gap-[0.15rem] leading-snug">
          <span className="flex flex-wrap items-center gap-[0.4rem] font-semibold text-emp-text">
            {row.name}
            {!row.editable ? <StatusBadge label="Fixed layout" tone="neutral" /> : null}
            {row.customized ? <StatusBadge label="Edited" tone="info" /> : null}
          </span>
          <span className="text-[0.85rem] text-emp-muted">{row.description}</span>
        </span>
      ),
    },
    { id: "recipients", header: "Sent to", value: (row) => row.recipients },
  ];

  if (!gateway) {
    return (
      <section data-theme={activeTheme}>
        <FeedbackState
          kind="empty"
          title="Notifications need a live connection"
          message="Sign in to see the emails the app sends."
        />
      </section>
    );
  }

  const { counts } = deliveries;
  const allCount = counts.pending + counts.sent + counts.failed;
  const pageCount = Math.max(1, Math.ceil(deliveries.total / PAGE_SIZE));
  const empty = EMPTY_MESSAGES[statusTab];

  return (
    <section className="grid gap-[1.1rem]" data-theme={activeTheme}>
      <AppSectionCard
        title="Email delivery log"
        description="Every email the app sends is queued and delivered in the background, with automatic retries."
        headerEnd={
          <AppButton variant="secondary" disabled={loading} onClick={() => void loadDeliveries()}>
            Refresh
          </AppButton>
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AppTabs<StatusTab>
              items={[
                { id: "all", label: `All (${allCount})` },
                { id: "failed", label: `Failed (${counts.failed})` },
                { id: "pending", label: `Waiting (${counts.pending})` },
                { id: "sent", label: `Sent (${counts.sent})` },
              ]}
              value={statusTab}
              onChange={(next) => {
                setStatusTab(next);
                setPage(0);
              }}
              ariaLabel="Email status"
              idPrefix="notification-status-tab"
              className="w-auto"
            />
            <AppSearchField
              id="notifications-search"
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(0);
              }}
              placeholder="Search recipient or subject"
              aria-label="Search emails"
              className="w-full max-w-[22rem]"
            />
          </div>

          {actionError ? (
            <AppNotice tone="error" onDismiss={() => setActionError(null)}>
              {actionError}
            </AppNotice>
          ) : null}

          {loading && deliveries.items.length === 0 ? (
            <AppTableSkeleton label="Loading emails" headers={DELIVERY_HEADERS} />
          ) : loadError ? (
            <FeedbackState
              kind="error"
              title="Emails could not be loaded"
              message={loadError}
              action={
                <AppButton variant="secondary" onClick={() => void loadDeliveries()}>
                  Try again
                </AppButton>
              }
            />
          ) : deliveries.items.length === 0 ? (
            <FeedbackState kind="empty" title={empty.title} message={empty.message} compact />
          ) : (
            <div
              role="tabpanel"
              id={`notification-status-panel-${statusTab}`}
              aria-labelledby={`notification-status-tab-${statusTab}`}
              className="grid gap-3"
            >
              <AppDataTable
                data={deliveries.items as NotificationDelivery[]}
                columns={deliveryColumns}
                getRowId={(row) => row.id}
                ariaLabel="Email delivery log"
                resizable
              />
              {deliveries.total > PAGE_SIZE ? (
                <AppPagination
                  page={page + 1}
                  pageCount={pageCount}
                  onPageChange={(next) => setPage(next - 1)}
                  disabled={loading}
                />
              ) : null}
            </div>
          )}
        </div>
      </AppSectionCard>

      <AppSectionCard
        title="Emails & recipients"
        description={
          canEdit
            ? "What the app emails and who receives each one. Open a row to change its subject and message."
            : "What the app emails and who receives each one. Open a row to see its wording."
        }
      >
        {templatesError ? (
          <FeedbackState
            kind="error"
            title="Emails could not be loaded"
            message={templatesError}
            action={
              <AppButton variant="secondary" onClick={() => void loadTemplates()}>
                Try again
              </AppButton>
            }
          />
        ) : templates === null ? (
          <AppTableSkeleton label="Loading emails" headers={["Email", "Sent to"]} />
        ) : (
          <AppDataTable
            data={templates as NotificationTemplate[]}
            columns={templateColumns}
            getRowId={(row) => row.key}
            ariaLabel="Emails and recipients"
            resizable
            renderRowDetail={(row) =>
              row.editable ? (
                <TemplateEditor
                  template={row}
                  canEdit={canEdit}
                  onSave={saveTemplate}
                  onReset={resetTemplate}
                  onPreview={previewTemplate}
                  onSendTest={sendTest}
                />
              ) : (
                <p className="m-0 text-[0.85rem] text-emp-muted">
                  This email uses a fixed table layout, so its wording cannot be edited here.
                </p>
              )
            }
          />
        )}
      </AppSectionCard>

      <ConfirmDialogShell
        open={pendingWithdraw !== null}
        title="Withdraw this email?"
        description={
          pendingWithdraw
            ? `The ${pendingWithdraw.eventName} email to ${pendingWithdraw.toEmail} stays in the log and will not be sent.`
            : ""
        }
        confirmLabel="Withdraw"
        tone="danger"
        busy={retrying !== null}
        onConfirm={() => void withdraw()}
        onClose={() => {
          if (retrying === null) setPendingWithdraw(null);
        }}
      />

      <AppShellToast message={notice} onClose={() => setNotice(null)} />
    </section>
  );
}
