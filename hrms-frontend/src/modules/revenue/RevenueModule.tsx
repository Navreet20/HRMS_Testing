import { useEffect, useReducer, useState } from "react";

import { mutationErrorMessage } from "@/shared";
import { EMPTY_REVENUE_DATA } from "@/shared/live";
import { createDefaultActor, DEFAULT_REVENUE_THEME } from "./constants";
import { RevenueDirectory } from "./components";
import { createRevenueState, revenueReducer } from "./reducer";
import {
  canListRevenue,
  canSendReminder,
  isRevenueActor,
  isRevenueTheme,
} from "./selectors";
import type { RevenueModuleProps } from "./types";
import { revenueUi as ui } from "./uiClasses";

export function RevenueModule({
  actor,
  defaultActor,
  data,
  defaultData = EMPTY_REVENUE_DATA,
  gateway,
  theme,
  defaultTheme = DEFAULT_REVENUE_THEME,
  onDataChange,
  onNavigate: _onNavigate,
  role,
  onRoleChange: _onRoleChange,
  onThemeChange: _onThemeChange,
}: RevenueModuleProps) {
  const resolvedDefaultActor = defaultActor ?? createDefaultActor(role);
  const [uncontrolledTheme] = useState(defaultTheme);

  const requestedActor = actor ?? resolvedDefaultActor;
  const activeActor = isRevenueActor(requestedActor)
    ? requestedActor
    : resolvedDefaultActor;

  const [state, dispatch] = useReducer(
    revenueReducer,
    createRevenueState(defaultData),
  );

  const isDataControlled = data !== undefined;
  const activeData = data ?? state.data;
  const requestedTheme: unknown = theme ?? uncontrolledTheme;
  const activeTheme = isRevenueTheme(requestedTheme)
    ? requestedTheme
    : DEFAULT_REVENUE_THEME;

  const canList = canListRevenue(activeActor);
  const canRemind = canSendReminder(activeActor) && !isDataControlled;

  useEffect(() => {
    if (isDataControlled) return;
    onDataChange?.(state.data);
  }, [isDataControlled, onDataChange, state.data]);

  const notice = state.ui.lastNotice;
  const error = state.ui.lastError;

  return (
    <section
      className={ui.root}
      data-theme={activeTheme}
      aria-label="Revenue module"
    >
      {error ? (
        <p className={ui.error} role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <div className={ui.notice} role="status">
          <p className={ui.noticeText}>{notice}</p>
          <button
            type="button"
            className={ui.btnGhostCompact}
            onClick={() => dispatch({ type: "CLEAR_ERROR" })}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {canList ? (
        <RevenueDirectory
          actor={activeActor}
          data={activeData}
          canSendReminder={canRemind}
          onSendReminder={(invoiceNumber, email) => {
            if (gateway) {
              void (async () => {
                try {
                  await gateway.sendOverdueInvoiceReminder(
                    invoiceNumber,
                    email,
                  );
                  dispatch({
                    type: "SEND_EMAIL_REMINDER",
                    invoiceNumber,
                    email,
                  });
                } catch (error) {
                  dispatch({
                    type: "SET_ERROR",
                    error: mutationErrorMessage(error),
                  });
                }
              })();
              return;
            }
            dispatch({
              type: "SEND_EMAIL_REMINDER",
              invoiceNumber,
              email,
            });
          }}
        />
      ) : (
        <p className={ui.empty}>
          Your role does not have access to revenue.
        </p>
      )}
    </section>
  );
}
