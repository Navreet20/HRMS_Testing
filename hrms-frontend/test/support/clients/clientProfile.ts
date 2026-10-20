import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { searchClientsDirectory } from "./browseDirectory";

/** Open a client profile from the directory actions menu (view mode). */
export async function openClientProfile(
  user: UserEvent,
  clientName: string,
): Promise<HTMLElement> {
  await searchClientsDirectory(user, clientName);
  await user.click(
    screen.getByRole("button", {
      name: new RegExp(`actions for ${clientName}`, "i"),
    }),
  );
  await user.click(screen.getByRole("menuitem", { name: /^view\/edit$/i }));
  return screen.getByRole("heading", {
    level: 1,
    name: new RegExp(`^${clientName}$`, "i"),
  });
}

/** Enter inline client edit mode on an already-open profile. */
export async function enterClientEditMode(user: UserEvent): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: /^edit client$/i }));
  return screen.getByRole("tabpanel", { name: /^client$/i });
}

/** Open client profile and enter edit mode (replaces the old edit dialog). */
export async function openEditClient(
  user: UserEvent,
  clientName: string,
): Promise<HTMLElement> {
  await openClientProfile(user, clientName);
  return enterClientEditMode(user);
}
