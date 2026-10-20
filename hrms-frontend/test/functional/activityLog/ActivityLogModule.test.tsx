import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityLogModule } from "@/modules/activityLog";
import { canListActivityLog } from "@/modules/activityLog/selectors";
import { changeAppDateField } from "../../support/appDateField";

describe("ActivityLogModule", () => {
  it("hides the trail from employees", () => {
    expect(canListActivityLog("EMPLOYEE")).toBe(false);
    render(<ActivityLogModule role="EMPLOYEE" />);
    expect(
      screen.getByText(/available to hr and admin only/i),
    ).toBeInTheDocument();
  });

  it("hides the table until a filter is applied", () => {
    const listActivityLog = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    render(
      <ActivityLogModule role="HR" gateway={{ listActivityLog }} />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText(/to view activity log records/i),
    ).toBeInTheDocument();
    expect(listActivityLog).not.toHaveBeenCalled();
  });

  it("lists read-only profile change rows for HR after searching", async () => {
    const user = userEvent.setup();
    const listActivityLog = jest.fn().mockResolvedValue({
      items: [
        {
          id: "a1",
          employeeId: "e1",
          employeeCode: "ADA_LOV",
          businessEmployeeId: "EMP10042",
          employeeName: "Ada Lovelace",
          fieldName: "phoneNumber",
          oldValue: "111",
          newValue: "222",
          changedBy: "Ada Lovelace",
          changedByRole: "EMPLOYEE",
          changedById: "e1",
          reason: null,
          changedAt: "2026-08-31T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    render(
      <ActivityLogModule
        role="HR"
        gateway={{ listActivityLog }}
      />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search activity log by employee/i,
      }),
      "Ada",
    );

    expect(
      await screen.findAllByText("Ada Lovelace", {}, { timeout: 3000 }),
    ).toHaveLength(2);
    expect(screen.getByText("EMP10042")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("111")).toBeInTheDocument();
    expect(screen.getByText("222")).toBeInTheDocument();
    expect(listActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ q: "Ada" }),
    );
  });

  it("lists discard lifecycle rows when employeeId was cleared", async () => {
    const user = userEvent.setup();
    const listActivityLog = jest.fn().mockResolvedValue({
      items: [
        {
          id: "audit-discard",
          employeeId: "",
          employeeCode: "SHI_SAN",
          employeeName: "Shirly Sane",
          fieldName: "lifecycle",
          oldValue: "NEW",
          newValue: "Deleted",
          changedBy: "HR",
          changedByRole: "HR",
          changedById: null,
          reason: null,
          changedAt: "2026-09-01T15:13:27.468703+00:00",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    render(
      <ActivityLogModule
        role="HR"
        gateway={{ listActivityLog }}
      />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search activity log by employee/i,
      }),
      "Shirly",
    );

    await waitFor(
      () => {
        expect(screen.getByText("Shirly Sane")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText("Lifecycle")).toBeInTheDocument();
    expect(screen.getByText("Deleted")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("searches via the gateway", async () => {
    const user = userEvent.setup();
    const listActivityLog = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    render(
      <ActivityLogModule role="ADMIN" gateway={{ listActivityLog }} />,
    );

    expect(listActivityLog).not.toHaveBeenCalled();
    await user.type(
      screen.getByRole("searchbox", {
        name: /search activity log by employee/i,
      }),
      "Ada",
    );
    await waitFor(
      () => {
        expect(listActivityLog).toHaveBeenCalledWith(
          expect.objectContaining({ q: "Ada" }),
        );
      },
      { timeout: 5000 },
    );
  });

  it("filters by date range via the gateway", async () => {
    const listActivityLog = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    render(
      <ActivityLogModule role="HR" gateway={{ listActivityLog }} />,
    );

    expect(listActivityLog).not.toHaveBeenCalled();
    changeAppDateField(/filter activity log from date/i, "2026-09-01");
    changeAppDateField(/filter activity log to date/i, "2026-09-02");

    await waitFor(
      () => {
        expect(listActivityLog).toHaveBeenCalledWith(
          expect.objectContaining({
            fromDate: "2026-09-01",
            toDate: "2026-09-02",
          }),
        );
      },
      { timeout: 5000 },
    );
    expect(screen.getByLabelText(/remove from date filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remove to date filter/i)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("requests 10 rows per page and paginates with Previous/Next", async () => {
    const user = userEvent.setup();
    const listActivityLog = jest.fn().mockImplementation(
      async (params: { page?: number; pageSize?: number }) => ({
        items: [
          {
            id: `a-${params.page ?? 1}`,
            employeeId: "e1",
            employeeCode: "ADA_LOV",
            businessEmployeeId: "EMP10042",
            employeeName: `Ada page ${params.page ?? 1}`,
            fieldName: "phoneNumber",
            oldValue: "111",
            newValue: "222",
            changedBy: "Ada Lovelace",
            changedByRole: "EMPLOYEE",
            changedById: "e1",
            reason: null,
            changedAt: "2026-08-31T12:00:00.000Z",
          },
        ],
        total: 25,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
      }),
    );

    render(
      <ActivityLogModule role="HR" gateway={{ listActivityLog }} />,
    );

    await user.type(
      screen.getByRole("searchbox", {
        name: /search activity log by employee/i,
      }),
      "Ada",
    );

    await waitFor(
      () => {
        expect(listActivityLog).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, pageSize: 10 }),
        );
      },
      { timeout: 5000 },
    );

    expect(await screen.findByText("Ada page 1")).toBeInTheDocument();
    expect(screen.getByText(/showing 1–10 of 25/i)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(
      () => {
        expect(listActivityLog).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2, pageSize: 10 }),
        );
      },
      { timeout: 5000 },
    );
    expect(await screen.findByText("Ada page 2")).toBeInTheDocument();
    expect(screen.getByText(/showing 11–20 of 25/i)).toBeInTheDocument();
  });
});
