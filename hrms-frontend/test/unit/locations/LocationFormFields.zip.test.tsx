import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationFormFields } from "@/modules/locations/components/LocationFormFields";
import { emptyLocationDraft } from "@/modules/locations/constants";
import type { LocationDraft } from "@/modules/org";
import { stubGlobal, unstubAllGlobals } from "../../support/stubGlobal";

function ZipHarness({
  requireAddressDetails = true,
}: {
  readonly requireAddressDetails?: boolean;
}) {
  const [value, setValue] = useState<LocationDraft>(
    emptyLocationDraft({
      country: "US",
      locationType: "Client site",
    }),
  );
  return (
    <LocationFormFields
      value={value}
      fieldIdPrefix="client-location-1"
      showOfficeDetails={false}
      requireAddressDetails={requireAddressDetails}
      onChange={setValue}
    />
  );
}

describe("LocationFormFields ZIP lookup", () => {
  beforeEach(() => {
    stubGlobal(
      "fetch",
      jest.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({
                  places: [
                    {
                      "place name": "New York",
                      "state abbreviation": "NY",
                    },
                  ],
                }),
              });
            }, 30);
          }),
      ),
    );
  });

  afterEach(() => {
    unstubAllGlobals();
  });

  it("keeps all five ZIP digits after city/state lookup returns", async () => {
    const user = userEvent.setup();
    render(<ZipHarness />);

    const zip = screen.getByLabelText(/zip code/i);
    await user.type(zip, "10001");

    await waitFor(() => {
      expect(screen.getByLabelText(/city/i)).toHaveValue("New York");
    });
    expect(zip).toHaveValue("10001");
  });

  it("auto-fills city and state without requiring ZIP on client locations", async () => {
    const user = userEvent.setup();
    render(<ZipHarness requireAddressDetails={false} />);

    const zip = screen.getByLabelText(/zip code/i);
    expect(zip).not.toBeRequired();
    expect(screen.getByLabelText(/location name/i)).not.toBeRequired();
    expect(screen.getByLabelText(/street address/i)).not.toBeRequired();
    expect(screen.getByLabelText(/country/i)).toBeRequired();

    await user.type(zip, "10001");

    await waitFor(() => {
      expect(screen.getByLabelText(/city/i)).toHaveValue("New York");
    });
    // CatalogSearchSelect stores the state code (NY) but displays the label.
    expect(screen.getByLabelText(/client-location-1 state/i)).toHaveValue(
      "New York",
    );
  });
});
