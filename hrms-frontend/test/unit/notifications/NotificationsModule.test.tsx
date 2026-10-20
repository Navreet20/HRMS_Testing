import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NotificationsModule, type NotificationsGateway } from "@/modules/notifications";
import {
  canRetryDeliveries,
  deliveryErrorLabel,
  deliveryWhen,
  normalizeDeliveryPage,
} from "@/modules/notifications/selectors";

const WAITING = {
  id: "d2",
  event: "timesheet.approved",
  eventName: "Timesheet approved",
  toEmail: "durga.paruchuri@arohak.com",
  subject: "[EAOVA] Timesheet approved",
  status: "pending",
  attempts: 4,
  lastError: "Could not send the invite email. Check the work email and SMTP settings.",
  createdAt: "2026-09-29T19:04:00Z",
  nextAttemptAt: "2026-10-02T18:09:00Z",
  sentAt: null,
};

const FAILED = {
  id: "d1",
  event: "leave.approved",
  eventName: "Leave approved",
  toEmail: "durga@arohak.com",
  subject: "[EAOVA] Leave approved (2026-09-28)",
  status: "failed",
  attempts: 6,
  lastError: "Mail server rejected the login",
  createdAt: "2026-09-28T10:00:00Z",
  nextAttemptAt: null,
  sentAt: null,
};

const TEMPLATE = {
  key: "leave.approved",
  name: "Leave approved",
  description: "A leave request is approved.",
  recipients: "The employee",
  placeholders: ["employee_name", "dates"],
  subject: "[EAOVA] Leave approved ({dates})",
  body: "Hi {employee_name},",
  defaultSubject: "[EAOVA] Leave approved ({dates})",
  defaultBody: "Hi {employee_name},",
  customized: false,
  updatedBy: null,
  updatedDate: null,
  editable: true,
};

const FIXED = {
  ...TEMPLATE,
  key: "asset.assigned",
  name: "Asset assigned",
  description: "An asset is assigned.",
  subject: null,
  body: null,
  defaultSubject: null,
  defaultBody: null,
  editable: false,
};

function gateway(overrides: Partial<NotificationsGateway> = {}): NotificationsGateway {
  return {
    listDeliveries: jest.fn().mockResolvedValue({
      items: [FAILED],
      total: 1,
      page: 0,
      pageSize: 25,
      counts: { pending: 2, sent: 5, failed: 1 },
    }),
    retryDelivery: jest.fn().mockResolvedValue({ ...FAILED, status: "pending" }),
    withdrawDelivery: jest.fn().mockResolvedValue({ ...FAILED, status: "failed" }),
    listTemplates: jest.fn().mockResolvedValue([TEMPLATE, FIXED]),
    saveTemplate: jest.fn().mockImplementation(async (key: string, wording: { subject: string; body: string }) => ({
      ...TEMPLATE,
      ...wording,
      key,
      customized: true,
      updatedBy: "Meena P",
      updatedDate: "2026-09-29T10:00:00Z",
    })),
    resetTemplate: jest.fn().mockResolvedValue({ ...TEMPLATE }),
    previewTemplate: jest.fn().mockImplementation(async (_key: string, wording: { subject: string; body: string }) => ({
      subject: wording.subject.replace("{dates}", "2026-10-05"),
      body: wording.body.replace("{employee_name}", "Alex Morgan"),
    })),
    sendTestEmail: jest.fn().mockResolvedValue({
      toEmail: "durga.paruchuri@arohak.com",
      subject: "[EAOVA] Leave approved (2026-10-05 – 2026-10-07)",
    }),
    ...overrides,
  };
}

describe("delivery error label", () => {
  it("shows a short reason instead of the full mail-server paragraph", () => {
    expect(deliveryErrorLabel("Withdrawn. This email will not be sent.")).toBe("Withdrawn");
    expect(
      deliveryErrorLabel(
        "Could not send the invite email. Check the work email and SMTP settings, then try again.",
      ),
    ).toBe("Mail server rejected it");
    expect(deliveryErrorLabel("Mail server rejected the login")).toBe(
      "Mail server rejected the login",
    );
  });
});

describe("Company Setup → Notifications", () => {
  it("shows the delivery log with counts and the failure reason", async () => {
    render(<NotificationsModule role="SUPERADMIN" gateway={gateway()} />);

    expect(await screen.findByText("durga@arohak.com")).toBeInTheDocument();
    expect(screen.getAllByText("Leave approved").length).toBeGreaterThan(0);
    expect(screen.getByText("Mail server rejected the login")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Failed (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Waiting (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All (8)" })).toBeInTheDocument();
  });

  it("filters by status with the tabs", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<NotificationsModule role="SUPERADMIN" gateway={gw} />);

    await user.click(await screen.findByRole("tab", { name: "Failed (1)" }));
    await waitFor(() =>
      expect(gw.listDeliveries).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "failed", page: 0 }),
      ),
    );
  });

  it("queues a test email to an address without a real leave or timesheet action", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<NotificationsModule role="SUPERADMIN" gateway={gw} />);

    await user.click((await screen.findAllByRole("button", { name: "Show details" }))[0]!);
    await user.click(await screen.findByRole("button", { name: "Send test" }));
    await user.type(await screen.findByLabelText(/send to/i), "durga.paruchuri@arohak.com");
    await user.click(screen.getByRole("button", { name: "Send test email" }));

    await waitFor(() =>
      expect(gw.sendTestEmail).toHaveBeenCalledWith(
        "leave.approved",
        "durga.paruchuri@arohak.com",
      ),
    );
    expect(
      await screen.findByText(/test "Leave approved" will be sent to durga.paruchuri@arohak.com/),
    ).toBeInTheDocument();
  });

  it("withdraws a waiting email so it is not sent later", async () => {
    const user = userEvent.setup();
    const gw = gateway({
      listDeliveries: jest.fn().mockResolvedValue({
        items: [WAITING],
        total: 1,
        page: 0,
        pageSize: 25,
        counts: { pending: 1, sent: 0, failed: 0 },
      }),
    });
    render(<NotificationsModule role="SUPERADMIN" gateway={gw} />);

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Withdraw" }));

    await waitFor(() => expect(gw.withdrawDelivery).toHaveBeenCalledWith("d2"));
    expect(
      await screen.findByText(/durga.paruchuri@arohak.com was withdrawn/),
    ).toBeInTheDocument();
  });

  it("retries a failed email", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<NotificationsModule role="SUPERADMIN" gateway={gw} />);

    await user.click(await screen.findByRole("button", { name: "Retry now" }));
    await waitFor(() => expect(gw.retryDelivery).toHaveBeenCalledWith("d1"));
    expect(
      await screen.findByText(/durga@arohak.com will be sent again/),
    ).toBeInTheDocument();
  });

  it("hides Retry without Company Setup full access", async () => {
    render(
      <NotificationsModule
        role="ADMIN"
        accessGrants={[{ moduleKey: "companySetup", accessLevel: "read_only" }]}
        gateway={gateway()}
      />,
    );
    await screen.findByText("durga@arohak.com");
    expect(screen.queryByRole("button", { name: "Retry now" })).not.toBeInTheDocument();
  });

  it("lists every email and who receives it", async () => {
    render(<NotificationsModule role="SUPERADMIN" gateway={gateway()} />);

    expect((await screen.findAllByText("The employee")).length).toBe(2);
    expect(screen.getByText("A leave request is approved.")).toBeInTheDocument();
    expect(screen.getByText("Fixed layout")).toBeInTheDocument();
  });

  it("edits the wording with a live preview and saves it", async () => {
    const user = userEvent.setup();
    const gw = gateway();
    render(<NotificationsModule role="SUPERADMIN" gateway={gw} />);

    await user.click((await screen.findAllByRole("button", { name: "Show details" }))[0]!);
    const message = await screen.findByLabelText("Message");
    expect(await screen.findByText(/Hi Alex Morgan,/)).toBeInTheDocument();

    await user.clear(message);
    // paste: typing would read the curly braces as key commands.
    await user.click(message);
    await user.paste("Good news {employee_name}!");
    await waitFor(() =>
      expect(gw.previewTemplate).toHaveBeenLastCalledWith("leave.approved", {
        subject: "[EAOVA] Leave approved ({dates})",
        body: "Good news {employee_name}!",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save wording" }));
    await waitFor(() =>
      expect(gw.saveTemplate).toHaveBeenCalledWith("leave.approved", {
        subject: "[EAOVA] Leave approved ({dates})",
        body: "Good news {employee_name}!",
      }),
    );
    expect(await screen.findByText(/New emails use this wording/)).toBeInTheDocument();
    expect(await screen.findByText("Edited")).toBeInTheDocument();
  });

  it("adds a placeholder to the message when its button is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationsModule role="SUPERADMIN" gateway={gateway()} />);

    await user.click((await screen.findAllByRole("button", { name: "Show details" }))[0]!);
    await user.click(await screen.findByRole("button", { name: "Add dates to the message" }));
    expect(screen.getByLabelText("Message")).toHaveValue("Hi {employee_name}, {dates}");
  });

  it("shows what is wrong and blocks saving", async () => {
    const user = userEvent.setup();
    const gw = gateway({
      previewTemplate: jest.fn().mockRejectedValue(new Error("The message uses {nope}, which this email does not have.")),
    });
    render(<NotificationsModule role="SUPERADMIN" gateway={gw} />);

    await user.click((await screen.findAllByRole("button", { name: "Show details" }))[0]!);
    await user.type(await screen.findByLabelText("Message"), " x");
    expect(await screen.findByRole("alert")).toHaveTextContent(/does not have/);
    expect(screen.getByRole("button", { name: "Save wording" })).toBeDisabled();
  });

  it("resets edited wording to the default after confirming", async () => {
    const user = userEvent.setup();
    const gw = gateway({
      listTemplates: jest.fn().mockResolvedValue([
        { ...TEMPLATE, subject: "Custom", customized: true, updatedBy: "Meena P", updatedDate: "2026-09-29T10:00:00Z" },
      ]),
    });
    render(<NotificationsModule role="SUPERADMIN" gateway={gw} />);

    await user.click((await screen.findAllByRole("button", { name: "Show details" }))[0]!);
    await user.click(await screen.findByRole("button", { name: "Reset to default" }));
    const dialog = await screen.findByRole("dialog");
    expect(gw.resetTemplate).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Reset to default" }));
    await waitFor(() => expect(gw.resetTemplate).toHaveBeenCalledWith("leave.approved"));
  });

  it("shows the wording read-only without Company Setup full access", async () => {
    const user = userEvent.setup();
    render(
      <NotificationsModule
        role="ADMIN"
        accessGrants={[{ moduleKey: "companySetup", accessLevel: "read_only" }]}
        gateway={gateway()}
      />,
    );

    await user.click((await screen.findAllByRole("button", { name: "Show details" }))[0]!);
    expect(await screen.findByText(/need Company Setup full access/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  it("normalizes pages and describes retry timing", () => {
    const page = normalizeDeliveryPage({ items: [{ ...FAILED, status: "weird" }] });
    expect(page.items[0]?.status).toBe("pending");
    expect(page.counts).toEqual({ pending: 0, sent: 0, failed: 0 });
    expect(
      deliveryWhen({ ...page.items[0]!, attempts: 2, nextAttemptAt: "2026-09-28T10:05:00Z" }),
    ).toMatch(/^Retry /);
    expect(canRetryDeliveries("ADMIN", [{ moduleKey: "companySetup", accessLevel: "full_access" }])).toBe(true);
  });
});
