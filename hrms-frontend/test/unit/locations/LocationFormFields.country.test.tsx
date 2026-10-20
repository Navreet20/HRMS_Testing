import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationFormFields } from "@/modules/locations/components/LocationFormFields";
import { emptyLocationDraft } from "@/modules/locations/constants";
import type { LocationDraft } from "@/modules/org";

function CountryHarness() {
  const [value, setValue] = useState<LocationDraft>(
    emptyLocationDraft({
      country: "",
      locationType: "Client site",
    }),
  );
  return (
    <LocationFormFields
      value={value}
      fieldIdPrefix="client-location-1"
      showOfficeDetails={false}
      requireAddressDetails={false}
      onChange={setValue}
    />
  );
}

describe("LocationFormFields country search", () => {
  it("filters in the country field itself and selects India when typing ind", async () => {
    const user = userEvent.setup();
    render(<CountryHarness />);

    const country = screen.getByRole("combobox", { name: /country/i });
    await user.click(country);
    expect(screen.queryByLabelText(/search countries/i)).not.toBeInTheDocument();

    await user.type(country, "ind");
    expect(country).toHaveValue("ind");
    expect(screen.getByRole("option", { name: /^India$/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Indonesia$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^United States$/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /^India$/i }));
    expect(country).toHaveValue("India");
  });
});
