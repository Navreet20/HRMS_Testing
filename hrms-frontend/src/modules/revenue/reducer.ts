import { EMPTY_REVENUE_DATA } from "@/shared/live";
import { validateReminderEmail } from "./selectors";
import type {
  RevenueAction,
  RevenueModuleData,
  RevenueReducerState,
} from "./types";

export const INITIAL_REVENUE_REDUCER_STATE: RevenueReducerState = {
  data: EMPTY_REVENUE_DATA,
  ui: {
    lastError: null,
    lastNotice: null,
  },
};

export function createRevenueState(
  data: RevenueModuleData = EMPTY_REVENUE_DATA,
): RevenueReducerState {
  return {
    data,
    ui: {
      lastError: null,
      lastNotice: null,
    },
  };
}

export function revenueReducer(
  state: RevenueReducerState,
  action: RevenueAction,
): RevenueReducerState {
  switch (action.type) {
    case "REPLACE_DATA":
      return {
        ...state,
        data: action.data,
        ui: { ...state.ui, lastError: null },
      };
    case "CLEAR_ERROR":
      return {
        ...state,
        ui: { ...state.ui, lastError: null, lastNotice: null },
      };
    case "SET_ERROR":
      return {
        ...state,
        ui: { ...state.ui, lastError: action.error, lastNotice: null },
      };
    case "SEND_EMAIL_REMINDER": {
      const emailError = validateReminderEmail(action.email);
      if (emailError) {
        return {
          ...state,
          ui: { ...state.ui, lastError: emailError, lastNotice: null },
        };
      }
      return {
        ...state,
        ui: {
          lastError: null,
          lastNotice: `Reminder sent for invoice ${action.invoiceNumber} to ${action.email.trim()}.`,
        },
      };
    }
    default:
      return state;
  }
}
