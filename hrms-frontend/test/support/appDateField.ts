import { fireEvent, screen, within } from "@testing-library/react";

type NameMatcher =
  | string
  | RegExp
  | ((accessibleName: string, element: Element) => boolean);

type RoleQueries = {
  getByRole: typeof screen.getByRole;
};

function isRoleQueries(
  value: HTMLElement | RoleQueries,
): value is RoleQueries {
  return (
    typeof value === "object" &&
    value !== null &&
    "getByRole" in value &&
    typeof value.getByRole === "function" &&
    !("nodeType" in value)
  );
}

function queriesOf(container?: HTMLElement | RoleQueries): RoleQueries {
  if (!container) {
    return screen;
  }
  if (isRoleQueries(container)) {
    return container;
  }
  return within(container);
}

/**
 * Resolve the hidden ISO value input inside a shared AppDateField.
 * The visible control is a button; tests should use these helpers instead of
 * fireEvent.change / toHaveValue on getByLabelText directly.
 */
export function getAppDateValueInput(
  name: NameMatcher,
  container?: HTMLElement | RoleQueries,
): HTMLInputElement {
  const scope = queriesOf(container);
  const trigger = scope.getByRole("button", { name });
  const root = trigger.closest(".app-date-field");
  const input = root?.querySelector<HTMLInputElement>(
    "input[data-app-date-value]",
  );
  if (!input) {
    throw new Error("AppDateField value input not found");
  }
  return input;
}

export function changeAppDateField(
  name: NameMatcher,
  isoDate: string,
  container?: HTMLElement | RoleQueries,
): void {
  fireEvent.change(getAppDateValueInput(name, container), {
    target: { value: isoDate },
  });
}

export function expectAppDateFieldValue(
  name: NameMatcher,
  isoDate: string,
  container?: HTMLElement | RoleQueries,
): void {
  expect(getAppDateValueInput(name, container)).toHaveValue(isoDate);
}

export function expectAppDateFieldDisabled(
  name: NameMatcher,
  container?: HTMLElement | RoleQueries,
): void {
  const scope = queriesOf(container);
  expect(scope.getByRole("button", { name })).toBeDisabled();
  expect(getAppDateValueInput(name, container)).toBeDisabled();
}
