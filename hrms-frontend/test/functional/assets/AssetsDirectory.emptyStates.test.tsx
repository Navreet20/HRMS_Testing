import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsDirectory } from "@/modules/assets/components/AssetsDirectory";

const handlers = {
  onCreate: jest.fn(),
  onUpdate: jest.fn(),
  onRetire: jest.fn(),
  onReturnToStock: jest.fn(),
  onReportLost: jest.fn(),
  onMarkFound: jest.fn(),
  onAssign: jest.fn(),
  onReturn: jest.fn(),
  onSwap: jest.fn(),
};

const categories = [{ categoryId: "cat-mon", categoryName: "Monitor", status: "Active" }];

describe("AssetsDirectory empty states", () => {
  it("says no match (not 'No assets yet') when a filter returns nothing", async () => {
    const user = userEvent.setup();
    render(
      <AssetsDirectory
        data={{ assets: [], categories: categories as never }}
        canWrite
        onListParamsChange={jest.fn()}
        {...handlers}
      />,
    );
    await user.type(
      screen.getByRole("searchbox", { name: /search assets/i }),
      "monitor",
    );
    expect(await screen.findByText("No matching assets")).toBeInTheDocument();
    expect(screen.queryByText("No assets yet")).not.toBeInTheDocument();
  });

  it("shows the loading placeholder instead of an empty message while fetching", async () => {
    const user = userEvent.setup();
    render(
      <AssetsDirectory
        data={{ assets: [], categories: categories as never }}
        loading
        canWrite
        onListParamsChange={jest.fn()}
        {...handlers}
      />,
    );
    await user.type(screen.getByRole("searchbox", { name: /search assets/i }), "x");
    expect(screen.getByRole("status", { name: "Loading assets" })).toBeInTheDocument();
    expect(screen.queryByText("No matching assets")).not.toBeInTheDocument();
  });
});
