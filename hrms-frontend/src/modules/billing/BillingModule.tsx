import { useEffect, useReducer, useRef, useState } from "react";

import { KeepMounted, mutationErrorMessage } from "@/shared";
import {
  EMPTY_BILLING_DATA,
  normalizeBillingModuleData,
} from "@/shared/live";
import { createDefaultActor, DEFAULT_BILLING_THEME } from "./constants";
import { BillingDetailsView, BillingDirectory } from "./components";
import { billingReducer, createBillingState } from "./reducer";
import {
  canCreateBilling,
  canEditBilling,
  canListBilling,
  canViewBilling,
  isBillingActor,
  isBillingTheme,
  selectExpensesForEmployee,
  selectInvoicesForEmployee,
  selectPayrollsForEmployee,
  selectSummaryByEmployeeCode,
} from "./selectors";
import type {
  BillingModuleProps,
  BillingSummaryRecord,
  BillingView,
} from "./types";
import { ui } from "./uiClasses";

function resolveLanding(
  actor: ReturnType<typeof createDefaultActor>,
  initialView: BillingView,
  initialEmployeeCode: string | null | undefined,
): { view: BillingView; employeeCode: string | null } {
  if (
    initialView === "details" &&
    initialEmployeeCode &&
    canViewBilling(actor)
  ) {
    return { view: "details", employeeCode: initialEmployeeCode };
  }
  return { view: "directory", employeeCode: null };
}

export function BillingModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_BILLING_DATA,
  gateway,
  payrollsGateway,
  clientsGateway,
  theme,
  defaultTheme = DEFAULT_BILLING_THEME,
  initialView = "directory",
  initialEmployeeCode = null,
  onDataChange,
  onNavigate: _onNavigate,
  onViewChange,
  role,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
}: BillingModuleProps) {
  const resolvedDefaultActor = defaultActor ?? createDefaultActor(role);
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActor = actor ?? resolvedDefaultActor;
  const activeActor = isBillingActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;

  const landing = resolveLanding(
    activeActor,
    initialView,
    initialEmployeeCode,
  );

  const [state, dispatch] = useReducer(
    billingReducer,
    createBillingState(defaultData, landing.view, landing.employeeCode),
  );

  const [notice, setNotice] = useState<string | null>(null);

  const isDataControlled = data !== undefined;
  const activeData = data ?? state.data;
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isBillingTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_BILLING_THEME;

  const canList = canListBilling(activeActor);
  const canEdit = canEditBilling(activeActor) || canCreateBilling(activeActor);

  useEffect(() => {
    if (isDataControlled) return;
    onDataChange?.(state.data);
  }, [isDataControlled, onDataChange, state.data]);

  const lastPublishedView = useRef<string>("");
  useEffect(() => {
    const key = `${state.ui.view}:${state.ui.detailsEmployeeCode ?? ""}`;
    if (lastPublishedView.current === key) {
      return;
    }
    lastPublishedView.current = key;
    onViewChange?.(state.ui.view, state.ui.detailsEmployeeCode);
  }, [state.ui.view, state.ui.detailsEmployeeCode, onViewChange]);

  function handleOpenDetails(summary: BillingSummaryRecord) {
    dispatch({
      type: "SET_VIEW",
      view: "details",
      employeeCode: summary.employeeCode,
    });
  }

  const detailsSummary = state.ui.detailsEmployeeCode
    ? selectSummaryByEmployeeCode(activeData, state.ui.detailsEmployeeCode)
    : null;
  const showDetails =
    state.ui.view === "details" &&
    detailsSummary != null &&
    canViewBilling(activeActor);

  return (
    <section
      className={ui.root}
      data-theme={activeTheme}
      aria-label="Billing module"
    >
      {state.ui.lastError ? (
        <p className={ui.error} role="alert">
          {state.ui.lastError}
        </p>
      ) : null}

      {notice ? (
        <div className={ui.notice} role="status">
          <p className={ui.noticeText}>{notice}</p>
          <button
            type="button"
            className={ui.btnGhostCompact}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {showDetails && detailsSummary ? (
        <BillingDetailsView
          summary={detailsSummary}
          invoices={selectInvoicesForEmployee(
            activeData,
            detailsSummary.employeeCode,
          )}
          expenses={selectExpensesForEmployee(
            activeData,
            detailsSummary.employeeCode,
          )}
          payrolls={selectPayrollsForEmployee(
            activeData,
            detailsSummary.employeeCode,
          )}
          actor={activeActor}
          canEdit={canEdit && !isDataControlled}
          onBack={() => dispatch({ type: "SET_VIEW", view: "directory" })}
          onUpdateHourly={(invoiceHourly) => {
            if (gateway) {
              setNotice(
                "Live API: invoice hourly rate has no dedicated REST endpoint.",
              );
              return;
            }
            dispatch({
              type: "UPDATE_INVOICE_HOURLY",
              employeeCode: detailsSummary.employeeCode,
              invoiceHourly,
            });
            setNotice("Invoice hourly rate updated.");
          }}
          onCreateInvoice={(draft) => {
            if (gateway || clientsGateway) {
              if (!clientsGateway) {
                setNotice(
                  "Live API: invoice create needs clients gateway (client id required).",
                );
                return;
              }
              setNotice(
                "Live API: billing invoices require a client id — create invoices from Clients.",
              );
              return;
            }
            dispatch({
              type: "CREATE_INVOICE",
              employeeCode: detailsSummary.employeeCode,
              draft,
            });
            setNotice("Invoice added successfully.");
          }}
          onDeleteInvoice={(invoiceId) => {
            if (gateway) {
              setNotice("Live API: invoice delete endpoint is not available.");
              return;
            }
            dispatch({ type: "DELETE_INVOICE", invoiceId });
            setNotice("Invoice deleted.");
          }}
          onCreateExpense={(draft) => {
            if (gateway) {
              void (async () => {
                try {
                  await gateway.createExpense([
                    {
                      employeeId: detailsSummary.employeeCode,
                      paymentDate: draft.paymentDate,
                      expenseType: draft.expenseType || "Other",
                      expenseCost: Number(draft.expenseCost) || 0,
                      status: "PENDING",
                    },
                  ]);
                  const [expensesRaw, invoicesRaw] = await Promise.all([
                    gateway.getAllExpenses(),
                    gateway.getAllClientInvoices(),
                  ]);
                  const next = normalizeBillingModuleData(
                    expensesRaw,
                    invoicesRaw,
                  );
                  dispatch({
                    type: "REPLACE_DATA",
                    data: {
                      ...next,
                      summaries: activeData.summaries,
                      payrolls: activeData.payrolls,
                    },
                  });
                  setNotice("Expense added successfully.");
                } catch (error) {
                  setNotice(mutationErrorMessage(error));
                }
              })();
              return;
            }
            dispatch({
              type: "CREATE_EXPENSE",
              employeeCode: detailsSummary.employeeCode,
              draft,
            });
            setNotice("Expense added successfully.");
          }}
          onDeleteExpense={(expenseId) => {
            if (gateway) {
              setNotice("Live API: expense delete endpoint is not available.");
              return;
            }
            dispatch({ type: "DELETE_EXPENSE", expenseId });
            setNotice("Expense deleted.");
          }}
          onCreatePayroll={(draft) => {
            if (gateway || payrollsGateway) {
              const payGw = payrollsGateway;
              if (!payGw) {
                setNotice(
                  "Live API: payroll create needs payrolls gateway.",
                );
                return;
              }
              void (async () => {
                try {
                  await payGw.createPayroll([
                    {
                      employeeId: detailsSummary.employeeCode,
                      paymentDate: draft.paymentDate,
                      amount: Number(draft.reimbursement) || 0,
                      status: "PENDING",
                    },
                  ]);
                  if (gateway) {
                    const [expensesRaw, invoicesRaw] = await Promise.all([
                      gateway.getAllExpenses(),
                      gateway.getAllClientInvoices(),
                    ]);
                    const next = normalizeBillingModuleData(
                      expensesRaw,
                      invoicesRaw,
                    );
                    dispatch({
                      type: "REPLACE_DATA",
                      data: {
                        ...next,
                        summaries: activeData.summaries,
                        payrolls: activeData.payrolls,
                      },
                    });
                  }
                  setNotice("Payroll added successfully.");
                } catch (error) {
                  setNotice(mutationErrorMessage(error));
                }
              })();
              return;
            }
            dispatch({
              type: "CREATE_PAYROLL",
              employeeCode: detailsSummary.employeeCode,
              draft,
            });
            setNotice("Payroll added successfully.");
          }}
          onDeletePayroll={(payrollId) => {
            if (gateway) {
              setNotice("Live API: payroll delete endpoint is not available.");
              return;
            }
            dispatch({ type: "DELETE_PAYROLL", payrollId });
            setNotice("Payroll deleted.");
          }}
        />
      ) : null}
      {canList ? (
        <KeepMounted show={!showDetails}>
        <BillingDirectory
          actor={activeActor}
          data={activeData}
          onOpenDetails={handleOpenDetails}
        />
        </KeepMounted>
      ) : !showDetails ? (
        <p className={ui.empty}>
          Your role does not have access to billing.
        </p>
      ) : null}
    </section>
  );
}
