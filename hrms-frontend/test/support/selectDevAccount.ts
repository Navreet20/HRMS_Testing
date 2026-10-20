import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

import {
  isPersonaSelectorRole,
  PERSONA_SELECTOR_LABELS,
  type PersonaSelectorRole,
} from "@/shared";

/** Open the custom Dev account listbox and choose a seeded persona. */
export async function selectDevAccount(
  user: UserEvent,
  role: PersonaSelectorRole | string,
): Promise<void> {
  if (!isPersonaSelectorRole(role)) {
    throw new Error(`Unsupported Dev account role: ${role}`);
  }
  await user.click(
    screen.getByRole("combobox", { name: /dev account selector/i }),
  );
  await user.click(
    screen.getByRole("option", { name: PERSONA_SELECTOR_LABELS[role] }),
  );
}
