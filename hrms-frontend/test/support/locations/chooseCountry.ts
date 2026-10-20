import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

type LabelScope = {
  getByRole: (typeof screen)["getByRole"];
};

const COUNTRY_CODE_NAMES: Readonly<Record<string, string>> = {
  US: "United States",
  IN: "India",
  SG: "Singapore",
  CA: "Canada",
  GB: "United Kingdom",
  MC: "Monaco",
};

export function countryDisplayName(codeOrName: string): string {
  return COUNTRY_CODE_NAMES[codeOrName] ?? codeOrName;
}

export async function chooseCountry(
  user: UserEvent,
  scope: LabelScope,
  codeOrName: string,
): Promise<void> {
  const name = countryDisplayName(codeOrName);
  const combobox = scope.getByRole("combobox", { name: /country/i });
  await user.click(combobox);
  await user.clear(combobox);
  await user.type(combobox, name);
  await user.click(screen.getByRole("option", { name: new RegExp(`^${name}$`, "i") }));
}
