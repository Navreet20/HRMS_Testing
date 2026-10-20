import { useEffect, useReducer, useRef, useState } from "react";

import { KeepMounted, mutationErrorMessage } from "@/shared";
import {
  EMPTY_PAYROLLS_DATA,
  normalizePayrollsModuleData,
} from "@/shared/live";
import { createDefaultActor, DEFAULT_PAYROLLS_THEME } from "./constants";
import { MyPayView, PayrollDetailsView, PayrollDirectory } from "./components";
import { createPayrollsState, payrollsReducer } from "./reducer";
import {
  canCreatePayroll,
  canEditPayroll,
  canListPayrolls,
  canViewPayroll,
  isPayrollsActor,
  isPayrollsTheme,
  selectPeriodById,
} from "./selectors";
import type {
  PeriodType,
  PayrollPeriodRecord,
  PayrollsModuleProps,
  PayrollsView,
} from "./types";
import { ui } from "./uiClasses";

function parseNewPeriodId(periodId: string): PayrollPeriodRecord | null {
  if (!periodId.startsWith("new:")) {
    return null;
  }
  const raw = periodId.slice(4);
  const [period, periodType, payDate] = raw.split("|");
  if (!period || !periodType || !payDate) {
    return null;
  }
  const [startDate = "", endDate = ""] = period.split(" to ");
  return {
    id: periodId,
    period,
    periodType: periodType as PeriodType,
    startDate,
    endDate,
    payDate,
    employeeCount: 0,
  };
}

function resolveLanding(
  actor: ReturnType<typeof createDefaultActor>,
  initialView: PayrollsView,
  initialPeriodId: string | null | undefined,
): { view: PayrollsView; periodId: string | null } {
  if (initialView === "details" && initialPeriodId && canViewPayroll(actor)) {
    return { view: "details", periodId: initialPeriodId };
  }
  return { view: "directory", periodId: null };
}

export function PayrollsModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_PAYROLLS_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_PAYROLLS_THEME,
  initialView = "directory",
  initialPeriodId = null,
  onDataChange,
  onNavigate: _onNavigate,
  onViewChange,
  role,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
}: PayrollsModuleProps) {
  const resolvedDefaultActor = defaultActor ?? createDefaultActor(role);
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActor = actor ?? resolvedDefaultActor;
  const activeActor = isPayrollsActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;

  const landing = resolveLanding(activeActor, initialView, initialPeriodId);

  const [state, dispatch] = useReducer(
    payrollsReducer,
    createPayrollsState(defaultData, landing.view, landing.periodId),
  );

  const [notice, setNotice] = useState<string | null>(null);

  const isDataControlled = data !== undefined;
  const activeData = data ?? state.data;
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isPayrollsTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_PAYROLLS_THEME;

  const canList = canListPayrolls(activeActor);
  const canCreate = canCreatePayroll(activeActor) && !isDataControlled;
  const canEdit = canEditPayroll(activeActor) && !isDataControlled;
  const hasPersonalPay = Boolean(activeActor.employeeId?.trim());
  const [mode, setMode] = useState<"my-pay" | "operations">(
    canList ? "operations" : "my-pay",
  );

  useEffect(() => {
    if (!canList) {
      setMode("my-pay");
    }
  }, [canList]);

  useEffect(() => {
    if (isDataControlled) return;
    onDataChange?.(state.data);
  }, [isDataControlled, onDataChange, state.data]);

  const lastPublishedView = useRef<string>("");
  useEffect(() => {
    const key = `${state.ui.view}:${state.ui.detailsPeriodId ?? ""}`;
    if (lastPublishedView.current === key) {
      return;
    }
    lastPublishedView.current = key;
    onViewChange?.(state.ui.view, state.ui.detailsPeriodId);
  }, [state.ui.view, state.ui.detailsPeriodId, onViewChange]);

  const detailsPeriod = state.ui.detailsPeriodId
    ? (parseNewPeriodId(state.ui.detailsPeriodId) ??
      selectPeriodById(activeData, state.ui.detailsPeriodId))
    : null;

  const showDetails =
    state.ui.view === "details" &&
    detailsPeriod != null &&
    canViewPayroll(activeActor);

  return (
    <section
      className={ui.root}
      data-theme={activeTheme}
      aria-label="Payrolls module"
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

      {canList && hasPersonalPay ? (
        <div className={ui.modeTabs} role="tablist" aria-label="Payroll workspace">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "my-pay"}
            className={ui.modeTab}
            onClick={() => setMode("my-pay")}
          >
            My Pay
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "operations"}
            className={ui.modeTab}
            onClick={() => setMode("operations")}
          >
            Payroll Operations
          </button>
        </div>
      ) : null}

      {mode === "my-pay" ? (
        <MyPayView
          data={activeData}
          employeeId={activeActor.employeeId}
          displayName={activeActor.displayName}
        />
      ) : canList ? (
        <div className={ui.workspace}>
          {showDetails && detailsPeriod ? (
            <PayrollDetailsView
              key={detailsPeriod.id}
              period={detailsPeriod}
              data={activeData}
              isNew={state.ui.isNewPeriod}
              canEdit={canEdit}
              onBack={() => dispatch({ type: "SET_VIEW", view: "directory" })}
              onSave={(payload) => {
                if (gateway) {
                  void (async () => {
                    try {
                      const creates = payload.lines
                        .filter((line) => !line.employeeCode.startsWith("tmp-"))
                        .map((line) => ({
                          employeeId: line.employeeCode,
                          paymentDate: payload.payDate,
                          amount:
                            line.hrs * line.payrate +
                            line.reimbursement +
                            line.payrollExpenses,
                          status: line.payrollStatus || "PENDING",
                        }));
                      if (creates.length > 0) {
                        await gateway.createPayroll(creates);
                      }
                      const [payrollRaw, w2Raw] = await Promise.all([
                        gateway.getAllPayroll(),
                        gateway.getW2Employees(),
                      ]);
                      dispatch({
                        type: "REPLACE_DATA",
                        data: normalizePayrollsModuleData(payrollRaw, w2Raw),
                      });
                      setNotice("Payroll data saved successfully.");
                    } catch (error) {
                      setNotice(mutationErrorMessage(error));
                    }
                  })();
                  return;
                }
                dispatch({ type: "SAVE_PERIOD_LINES", ...payload });
                setNotice("Payroll data saved successfully.");
              }}
            />
          ) : null}
          <KeepMounted show={!showDetails}>
            <PayrollDirectory
              data={activeData}
              canCreate={canCreate}
              onCreatePeriod={(draft) => {
                dispatch({
                  type: "CREATE_PERIOD",
                  payDate: draft.payDate,
                  periodType: draft.periodType,
                  period: draft.period,
                  startDate: draft.startDate,
                  endDate: draft.endDate,
                });
              }}
              onOpenDetails={(period) => {
                dispatch({
                  type: "SET_VIEW",
                  view: "details",
                  periodId: period.id,
                });
              }}
            />
          </KeepMounted>
        </div>
      ) : null}
    </section>
  );
}
