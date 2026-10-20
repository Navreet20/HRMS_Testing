import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AppPagination,
  AppTabs,
  AppTextField,
  AppFileField,
  ApprovalDialogShell,
  ConfirmDialogShell,
  FeedbackState,
  FormActionFeedback,
  RequestRow,
  StatusBadge,
} from "@/shared";

describe("shared UI primitives", () => {
  it("renders text-first status and a dense request row with labeled actions", async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();

    render(
      <>
        <StatusBadge label="Approved" tone="success" />
        <RequestRow
          requester="Alex Morgan"
          requestType="Leave"
          dateLabel="Jul 28–30"
          valueLabel="3 days"
          status={{ label: "Pending", tone: "warning" }}
          onOpen={onOpen}
        />
      </>,
    );

    expect(screen.getByText("Approved")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(
      screen.getByRole("article", { name: /leave request from alex morgan/i }),
    ).toHaveTextContent("Pending");
    await user.click(screen.getByRole("button", { name: /open request/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /open request/i }).querySelector("svg"),
    ).not.toBeNull();
  });

  it("labels approval dialogs, places action errors by controls, and restores focus", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onApprove = jest.fn();
    const onReject = jest.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Review request
          </button>
          <ApprovalDialogShell
            open={open}
            title="Review leave request"
            description="Confirm the request decision."
            actionError="A comment is required to reject."
            onApprove={onApprove}
            onReject={onReject}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          >
            <label>
              Comment
              <textarea />
            </label>
          </ApprovalDialogShell>
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: /review request/i });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", {
      name: /review leave request/i,
    });
    const alert = screen.getByRole("alert");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.getAttribute("aria-describedby")).toContain(alert.id);
    expect(screen.getByRole("button", { name: /close review leave request/i }))
      .toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it("keeps confirmation callbacks presentation-only", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(
      <ConfirmDialogShell
        open
        title="Submit timesheet"
        description="The submitted period will move to approval."
        confirmLabel="Submit"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("wraps modal focus forward and backward within the dialog", () => {
    render(
      <ApprovalDialogShell
        open
        title="Review request"
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onClose={jest.fn()}
      >
        <label>
          Comment
          <textarea />
        </label>
      </ApprovalDialogShell>,
    );

    const dialog = screen.getByRole("dialog", { name: /review request/i });
    const first = screen.getByRole("button", {
      name: /close review request/i,
    });
    const last = screen.getByRole("button", { name: /^approve$/i });

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("keeps Escape inside the innermost nested dialog", () => {
    const closeOuter = jest.fn();
    const closeInner = jest.fn();

    render(
      <ApprovalDialogShell
        open
        title="Outer approval"
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onClose={closeOuter}
      >
        <ConfirmDialogShell
          open
          title="Inner confirmation"
          description="Confirm the inner action."
          onConfirm={jest.fn()}
          onClose={closeInner}
        />
      </ApprovalDialogShell>,
    );

    const innerDialog = screen.getByRole("dialog", {
      name: /inner confirmation/i,
    });
    fireEvent.keyDown(innerDialog, { key: "Escape" });

    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });

  it("focuses the busy dialog when every descendant is unavailable", () => {
    render(
      <ApprovalDialogShell
        open
        busy
        title="Busy approval"
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onClose={jest.fn()}
      >
        <fieldset disabled>
          <button type="button">Disabled by fieldset</button>
        </fieldset>
        <div inert>
          <button type="button">Inert action</button>
        </div>
        <div aria-hidden="true">
          <button type="button">Hidden from accessibility tree</button>
        </div>
        <button type="button" aria-disabled="true">
          Aria-disabled action
        </button>
        <button type="button" hidden>
          Hidden action
        </button>
        <button type="button" style={{ display: "none" }}>
          Non-rendered action
        </button>
      </ApprovalDialogShell>,
    );

    const dialog = screen.getByRole("dialog", { name: /busy approval/i });
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog).toHaveFocus();
  });

  it("announces explicit empty, loading, and error feedback", () => {
    render(
      <>
        <FeedbackState kind="empty" title="No requests yet" />
        <FeedbackState kind="loading" title="Loading requests…" />
        <FeedbackState kind="error" title="Requests could not load" />
      </>,
    );

    expect(
      screen.getByRole("status", { name: /empty: no requests yet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading: loading requests/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("alert", { name: /error: requests could not load/i }),
    ).toBeInTheDocument();
  });

  it("places a failed action beside controls without clearing dirty form data", async () => {
    const user = userEvent.setup();

    function DirtyFormHarness() {
      const [value, setValue] = useState("");
      const [error, setError] = useState<string | null>(null);
      return (
        <form>
          <label>
            Comment
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <FormActionFeedback error={error} sticky>
            <button type="button" onClick={() => setError("Save failed.")}>
              Save
            </button>
          </FormActionFeedback>
        </form>
      );
    }

    render(<DirtyFormHarness />);
    const input = screen.getByRole("textbox", { name: /comment/i });
    await user.type(input, "Keep this comment");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(input).toHaveValue("Keep this comment");
    const actionGroup = screen.getByRole("group", { name: /form actions/i });
    const alert = screen.getByRole("alert");
    expect(actionGroup.getAttribute("aria-describedby")).toBe(alert.id);
    expect(alert).toHaveTextContent("Save failed.");
  });

  it("switches AppTabs without native browser tab chrome", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    function Harness() {
      const [value, setValue] = useState("timesheets");
      return (
        <AppTabs
          items={[
            { id: "timesheets", label: "Time Sheets" },
            { id: "expenses", label: "Expenses" },
          ]}
          value={value}
          onChange={(id) => {
            setValue(id);
            onChange(id);
          }}
          ariaLabel="Self categories"
        />
      );
    }

    render(<Harness />);
    expect(screen.getByRole("tab", { name: "Time Sheets" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: "Expenses" }));
    expect(onChange).toHaveBeenCalledWith("expenses");
    expect(screen.getByRole("tab", { name: "Expenses" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders segmented tabs with a green tile on a green-outlined bar", () => {
    render(
      <AppTabs
        items={[
          { id: "timesheets", label: "Time Sheets" },
          { id: "expenses", label: "Expenses" },
        ]}
        value="timesheets"
        onChange={() => undefined}
        ariaLabel="Self categories"
      />,
    );

    const selected = screen.getByRole("tab", { name: "Time Sheets" });
    // White text on the sliding green tile; the tab itself stays transparent.
    expect(selected).toHaveClass("text-emp-on-accent");
    expect(selected).toHaveClass("bg-transparent");
    expect(screen.getByTestId("app-tabs-indicator")).toHaveClass("bg-emp-accent");
    const inactive = screen.getByRole("tab", { name: "Expenses" });
    expect(inactive).toHaveClass("bg-transparent");
    expect(inactive).toHaveClass("text-emp-muted");
    expect(screen.getByRole("tablist")).toHaveClass("border-emp-accent");
  });

  it("renders line tabs without the segmented navbar fill", () => {
    render(
      <AppTabs
        variant="line"
        items={[
          { id: "timesheets", label: "Time Sheets" },
          { id: "expenses", label: "Expenses" },
        ]}
        value="timesheets"
        onChange={() => undefined}
        ariaLabel="Self categories"
      />,
    );

    const selected = screen.getByRole("tab", { name: "Time Sheets" });
    expect(selected).toHaveClass("border-emp-accent");
    expect(selected).not.toHaveClass("bg-emp-accent");
  });

  it("pages with shared previous and next controls", async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();

    render(
      <AppPagination page={0} pageCount={3} onPageChange={onPageChange} />,
    );

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("updates a labeled AppTextField without a native form wrapper requirement", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <AppTextField
        label="Employee ID"
        value=""
        onChange={onChange}
        placeholder="EMP10001"
      />,
    );

    await user.type(screen.getByLabelText("Employee ID"), "E");
    expect(onChange).toHaveBeenCalledWith("E");
  });

  it("renders a compact AppTextField for dense clock-style entry", () => {
    render(
      <AppTextField
        size="compact"
        align="center"
        inputMode="numeric"
        value="8:00"
        onChange={jest.fn()}
        aria-label="Hours for 2026-09-14"
      />,
    );

    const field = screen.getByLabelText("Hours for 2026-09-14");
    expect(field).toHaveValue("8:00");
    expect(field).toHaveAttribute("inputmode", "numeric");
  });

  it("picks a file through AppFileField without a visible native file control", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <AppFileField
        label="Supporting document"
        fileName={null}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("No file chosen")).toBeInTheDocument();
    const input = screen.getByLabelText("Supporting document");
    expect(input).toHaveClass("app-file-field__input");
    await user.upload(
      input,
      new File(["note"], "letter.pdf", { type: "application/pdf" }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toBeInstanceOf(File);
    expect((onChange.mock.calls[0]?.[0] as File).name).toBe("letter.pdf");
  });
});
