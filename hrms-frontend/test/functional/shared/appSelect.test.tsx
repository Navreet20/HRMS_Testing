import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AppSelect,
  findAppSelectTypeaheadIndex,
} from "@/shared/ui/AppSelect";

const OPTIONS = [
  { value: "apple", label: "Apple" },
  { value: "apricot", label: "Apricot" },
  { value: "banana", label: "Banana" },
  { value: "blueberry", label: "Blueberry" },
] as const;

function Harness({
  initialValue = "apple",
  onChange = jest.fn(),
  disabled = false,
  required = false,
}: {
  readonly initialValue?: string;
  readonly onChange?: (value: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <AppSelect
      label="Fruit"
      value={value}
      options={OPTIONS}
      disabled={disabled}
      required={required}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("findAppSelectTypeaheadIndex", () => {
  it("jumps to the first prefix match from the current index", () => {
    expect(findAppSelectTypeaheadIndex(OPTIONS, "b", 0)).toBe(2);
  });

  it("cycles to the next same-letter match on a repeated character", () => {
    expect(findAppSelectTypeaheadIndex(OPTIONS, "aa", 0)).toBe(1);
  });
});

describe("AppSelect", () => {
  it("exposes a labelled combobox with aria-expanded and listbox", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const combobox = screen.getByRole("combobox", { name: "Fruit" });
    expect(combobox).toHaveAttribute("title", "Apple");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(combobox).toHaveAttribute("aria-haspopup", "listbox");
    expect(combobox).toHaveAttribute("aria-controls");
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(combobox);
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Fruit" })).toBeInTheDocument();
    expect(combobox).toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens on ArrowDown and moves the active option", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const combobox = screen.getByRole("combobox", { name: "Fruit" });
    combobox.focus();
    await user.keyboard("{ArrowDown}");
    expect(combobox).toHaveAttribute("aria-expanded", "true");

    const appleId = screen.getByRole("option", { name: "Apple" }).id;
    expect(combobox).toHaveAttribute("aria-activedescendant", appleId);

    await user.keyboard("{ArrowDown}");
    const apricotId = screen.getByRole("option", { name: "Apricot" }).id;
    expect(combobox).toHaveAttribute("aria-activedescendant", apricotId);
  });

  it("selects the active option with Enter", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByRole("combobox", { name: "Fruit" });
    await user.click(combobox);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("apricot");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(combobox).toHaveTextContent("Apricot");
  });

  it("closes on Escape without changing the value", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByRole("combobox", { name: "Fruit" });
    await user.click(combobox);
    await user.keyboard("{ArrowDown}{Escape}");

    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
    expect(combobox).toHaveTextContent("Apple");
  });

  it("typeahead while closed selects the matching option", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByRole("combobox", { name: "Fruit" });
    combobox.focus();
    await user.keyboard("b");

    expect(onChange).toHaveBeenCalledWith("banana");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(combobox).toHaveTextContent("Banana");
  });

  it("typeahead while open moves aria-activedescendant without committing", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByRole("combobox", { name: "Fruit" });
    await user.click(combobox);
    onChange.mockClear();
    await user.keyboard("bl");

    const blueberry = screen.getByRole("option", { name: "Blueberry" });
    expect(combobox).toHaveAttribute("aria-activedescendant", blueberry.id);
    expect(onChange).not.toHaveBeenCalled();
    expect(combobox).toHaveAttribute("aria-expanded", "true");
  });

  it("sets aria-required when required", () => {
    render(<Harness required />);
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("shows placeholder styling when value is empty even if a blank option exists", async () => {
    const user = userEvent.setup();

    function FilterHarness() {
      const [value, setValue] = useState("");
      return (
        <AppSelect
          aria-label="Filter by department"
          value={value}
          placeholder="All departments"
          options={[
            { value: "", label: "All departments" },
            { value: "dept-1", label: "Engineering" },
          ]}
          onChange={setValue}
        />
      );
    }

    render(<FilterHarness />);

    const combobox = screen.getByRole("combobox", {
      name: "Filter by department",
    });
    expect(combobox).toHaveTextContent("All departments");
    expect(
      combobox.querySelector(".app-select__field-label--placeholder"),
    ).not.toBeNull();

    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Engineering" }));
    expect(combobox).toHaveTextContent("Engineering");
    expect(
      combobox.querySelector(".app-select__field-label--placeholder"),
    ).toBeNull();

    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "All departments" }));
    expect(combobox).toHaveTextContent("All departments");
    expect(
      combobox.querySelector(".app-select__field-label--placeholder"),
    ).not.toBeNull();
  });

  it("renders an optional description as a secondary option line", async () => {
    const user = userEvent.setup();
    render(
      <AppSelect
        aria-label="Replacement asset"
        value=""
        placeholder="Select In Stock asset"
        options={[
          {
            value: "sys-3",
            label: "COG-MOB-0003",
            description: "iPhone 15 · SN ABC · Condition: New",
          },
          { value: "sys-2", label: "COG-MOB-0002" },
        ]}
        onChange={() => undefined}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Replacement asset" }));

    const withDetails = screen.getByRole("option", {
      name: /COG-MOB-0003/,
    });
    expect(
      withDetails.querySelector(".app-select__option-description"),
    ).toHaveTextContent("iPhone 15 · SN ABC · Condition: New");

    const withoutDetails = screen.getByRole("option", { name: "COG-MOB-0002" });
    expect(
      withoutDetails.querySelector(".app-select__option-description"),
    ).toBeNull();
  });
});
