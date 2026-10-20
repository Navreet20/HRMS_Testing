import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AddressCascadeFields,
  type AddressCascadeValue,
} from "@/modules/org/AddressCascadeFields";

const EMPTY: AddressCascadeValue = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
};

function Harness({
  initial = EMPTY,
  disabled = false,
}: {
  readonly initial?: AddressCascadeValue;
  readonly disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <AddressCascadeFields
      value={value}
      disabled={disabled}
      fieldClassName="field"
      onChange={(partial) => setValue((current) => ({ ...current, ...partial }))}
      renderLabel={(text, required) => (
        <span>{required ? `${text} *` : text}</span>
      )}
    />
  );
}

function field(name: RegExp) {
  return screen.getByLabelText(name);
}

describe("AddressCascadeFields", () => {
  it("disables state and city until their parent is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(field(/^State/)).toBeDisabled();
    expect(field(/^City/)).toBeDisabled();

    await user.selectOptions(field(/^Country/), "US");
    expect(field(/^State/)).toBeEnabled();
    expect(field(/^City/)).toBeDisabled();

    await user.selectOptions(field(/^State/), "CA");
    expect(field(/^City/)).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "San Francisco" }),
    ).toBeInTheDocument();
  });

  it("clears state and city when the country changes, and city when the state changes", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ ...EMPTY, country: "US", state: "CA", city: "San Jose" }}
      />,
    );

    await user.selectOptions(field(/^State/), "NY");
    expect(field(/^City/)).toHaveValue("");

    await user.selectOptions(field(/^City/), "New York City");
    await user.selectOptions(field(/^Country/), "CA");
    expect(field(/^State/)).toHaveValue("");
    expect(field(/^City/)).toHaveValue("");
  });

  it("keeps stored values that are not in the dataset visible", () => {
    render(
      <Harness
        initial={{ ...EMPTY, country: "IN", state: "TS", city: "Hyderabad" }}
      />,
    );

    expect(field(/^State/)).toHaveValue("TS");
    expect(field(/^City/)).toHaveValue("Hyderabad");
  });

  it("falls back to a text state field for countries without a state list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(field(/^Country/), "SG");
    const state = field(/^State/);
    expect(state.tagName).toBe("INPUT");
    await user.type(state, "Central");
    expect(state).toHaveValue("Central");

    const city = field(/^City/);
    expect(city.tagName).toBe("INPUT");
    await user.type(city, "Singapore");
    expect(city).toHaveValue("Singapore");
  });

  it("disables every field in read-only mode", () => {
    render(
      <Harness
        disabled
        initial={{ ...EMPTY, country: "US", state: "CA", city: "San Jose" }}
      />,
    );

    for (const name of [/^Street address/, /^Address line 2/, /^Country/, /^State/, /^City/, /^ZIP code/]) {
      expect(field(name)).toBeDisabled();
    }
  });
});
