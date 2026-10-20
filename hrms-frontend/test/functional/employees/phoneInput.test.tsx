import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeesPhoneInput } from "@/modules/employees/components/EmployeesPhoneInput";
import { AppSelect } from "@/shared/ui";

function Harness({
  initialValue = "",
  required = false,
  onChange = jest.fn(),
}: {
  readonly initialValue?: string;
  readonly required?: boolean;
  readonly onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <EmployeesPhoneInput
      label="Phone number"
      required={required}
      value={value}
      ariaLabel="Phone number"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("EmployeesPhoneInput", () => {
  it("keeps US +1 when typing a national number that starts with 9", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    const input = (await screen.findByLabelText(
      /^phone number$/i,
    )) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "9");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("+19");
    });
    expect(input.value.replace(/\D/g, "")).toBe("19");
    expect(
      document.querySelector(".emp-react-phone-input .flag.us"),
    ).toBeTruthy();

    await user.type(input, "165551234");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("+19165551234");
    });
    expect(input.value).toMatch(/\(916\)\s*555-1234/);
    expect(
      document.querySelector(".emp-react-phone-input .flag.us"),
    ).toBeTruthy();
  });

  it("formats a complete US number with parentheses and hyphen", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    const input = (await screen.findByLabelText(
      /^phone number$/i,
    )) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "9165551234");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("+19165551234");
    });
    expect(input.value).toMatch(/\(916\)\s*555-1234/);
  });

  it("formats an Indian number with regional grouping", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness initialValue="+9198" onChange={onChange} />);

    const input = (await screen.findByLabelText(
      /^phone number$/i,
    )) as HTMLInputElement;
    expect(
      document.querySelector(".emp-react-phone-input .flag.in"),
    ).toBeTruthy();

    await user.click(input);
    await user.type(input, "76543210");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("+919876543210");
    });
    expect(input.value.replace(/\D/g, "")).toBe("919876543210");
    expect(input.value).toMatch(/98765/);
  });

  it("rejects a US number that is too short after blur", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = (await screen.findByLabelText(
      /^phone number$/i,
    )) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "55512");
    await user.tab();

    expect(
      await screen.findByText(/too short for the selected country/i),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps the country flag below in-flow AppSelect menus", async () => {
    render(
      <>
        <AppSelect
          aria-label="Ethnicity"
          value=""
          placeholder="Select ethnicity"
          options={[{ value: "native_american", label: "Native American" }]}
          onChange={jest.fn()}
        />
        <Harness />
      </>,
    );

    await screen.findByLabelText(/^phone number$/i);
    const container = document.querySelector(".emp-react-phone-input");
    expect(container?.className).toMatch(/isolate/);
    expect(container?.className).toMatch(/z-\[1\]/);
    const flagButton = document.querySelector(
      ".emp-react-phone-input .flag-dropdown",
    );
    expect(flagButton?.className ?? "").not.toMatch(/\bz-50\b/);
    expect((flagButton as HTMLElement | null)?.style.zIndex ?? "").not.toBe(
      "50",
    );
  });

  it("caps extra US digits at the country maximum", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    const input = (await screen.findByLabelText(
      /^phone number$/i,
    )) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "916555123499999");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("+19165551234");
    });
    expect(input.value.replace(/\D/g, "")).toBe("19165551234");
    expect(input.value).toMatch(/\(916\)\s*555-1234/);
  });

  it("accepts a valid-length US number without an error", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    const input = (await screen.findByLabelText(
      /^phone number$/i,
    )) as HTMLInputElement;
    await user.click(input);
    await user.type(input, "9165551234");
    await user.tab();

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("+19165551234");
    });
    expect(
      screen.queryByText(/too short|too long|required length|valid phone/i),
    ).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("does not invent national digits for countries outside PHONE_DIAL_CODES", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    const input = (await screen.findByLabelText(
      /^phone number$/i,
    )) as HTMLInputElement;

    // Open country list and pick Angola (+244) — not in PHONE_DIAL_CODES.
    const flagButton = document.querySelector(
      ".emp-react-phone-input .selected-flag",
    );
    expect(flagButton).toBeTruthy();
    await user.click(flagButton as HTMLElement);

    const search = await screen.findByPlaceholderText(/search/i);
    await user.clear(search);
    await user.type(search, "Angola");
    const angola = await screen.findByText(/^Angola$/i);
    await user.click(angola);

    await waitFor(() => {
      expect(
        document.querySelector(".emp-react-phone-input .flag.ao"),
      ).toBeTruthy();
    });

    await user.click(input);
    await user.type(input, "9");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("+2449");
    });
    expect(input.value.replace(/\D/g, "")).toBe("2449");

    await user.keyboard("{Backspace}");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("");
    });
    expect(input.value.replace(/\D/g, "")).toBe("244");
  });
});
