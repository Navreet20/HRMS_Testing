import { AppCheckbox } from "@/shared/ui";
import {
  CLIENT_CATEGORIES,
  CLIENT_CATEGORY_CHECKBOX_LABELS,
  type ClientCategory,
} from "../clientCategory";
import { clientsUi as ui } from "../uiClasses";
import { ClientsFieldLabel } from "./ClientsFieldLabel";

interface ClientCategoryCheckboxesProps {
  readonly value: ClientCategory | "";
  readonly disabled?: boolean;
  readonly onChange: (next: ClientCategory) => void;
}

/**
 * Internal, Direct and Intermediary — one at a time, like a radio group.
 * Required: once picked, a type can be switched but not cleared.
 */
export function ClientCategoryCheckboxes({
  value,
  disabled = false,
  onChange,
}: ClientCategoryCheckboxesProps) {
  return (
    <div className={ui.categoryField}>
      <ClientsFieldLabel required>Client type</ClientsFieldLabel>
      <div role="group" aria-label="Client type" className={ui.categoryGroup}>
        {CLIENT_CATEGORIES.map((category) => (
          <AppCheckbox
            key={category}
            className={ui.createAppCheck}
            checked={value === category}
            disabled={disabled}
            label={CLIENT_CATEGORY_CHECKBOX_LABELS[category]}
            onChange={(checked) => {
              if (checked) {
                onChange(category);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
