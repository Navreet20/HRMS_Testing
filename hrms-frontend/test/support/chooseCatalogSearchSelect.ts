import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

type LabelScope = {
  getByRole: (typeof screen)["getByRole"];
};

/** Pick an option from CatalogSearchSelect / EmployeesSearchCombobox. */
export async function chooseCatalogSearchSelect(
  user: UserEvent,
  scope: LabelScope,
  comboboxName: RegExp | string,
  optionLabel: string,
): Promise<void> {
  const combobox = scope.getByRole("combobox", { name: comboboxName });
  await user.click(combobox);
  await user.clear(combobox);
  await user.type(combobox, optionLabel);
  await user.click(
    screen.getByRole("option", {
      name: new RegExp(
        `^${optionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      ),
    }),
  );
}
