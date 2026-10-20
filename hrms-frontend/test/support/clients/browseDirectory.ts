import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Search-first directory: choose Active status to list clients. */
export async function browseClientsDirectory(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
  await user.click(screen.getByRole("option", { name: /^active$/i }));
}

export async function searchClientsDirectory(
  user: UserEvent,
  query: string,
): Promise<void> {
  const search = screen.getByRole("searchbox", {
    name: /search by client name or id/i,
  });
  await user.clear(search);
  await user.type(search, query);
}
