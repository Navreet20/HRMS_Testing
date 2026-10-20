import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AppMenu,
  AppMenuItem,
  AppMenuSubmenu,
  AppPopover,
  AppSelect,
} from "@/shared/ui";

function MenuHarness({ onPick }: { readonly onPick: (value: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" onClick={(event) => setAnchor(event.currentTarget)}>
        More
      </button>
      <AppMenu open={anchor !== null} anchor={anchor} ariaLabel="More" onClose={() => setAnchor(null)}>
        <AppMenuItem onSelect={() => onPick("copy")}>Copy</AppMenuItem>
        <AppMenuSubmenu label="Export">
          <AppMenuItem onSelect={() => onPick("pdf")}>PDF</AppMenuItem>
          <AppMenuItem onSelect={() => onPick("csv")}>CSV</AppMenuItem>
        </AppMenuSubmenu>
      </AppMenu>
    </>
  );
}

describe("AppMenuSubmenu", () => {
  it("opens on hover and runs the chosen item", async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    render(<MenuHarness onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.queryByRole("menuitem", { name: "PDF" })).not.toBeInTheDocument();

    await user.hover(screen.getByRole("menuitem", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: "PDF" }));
    expect(onPick).toHaveBeenCalledWith("pdf");
  });

  it("opens with → and goes back with ←", async () => {
    const user = userEvent.setup();
    render(<MenuHarness onPick={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "More" }));
    const exportItem = screen.getByRole("menuitem", { name: "Export" });
    exportItem.focus();

    await user.keyboard("{ArrowRight}");
    const submenu = screen.getByRole("menu", { name: "Export" });
    await screen.findByRole("menuitem", { name: "PDF" });
    expect(within(submenu).getByRole("menuitem", { name: "PDF" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.queryByRole("menu", { name: "Export" })).not.toBeInTheDocument();
    expect(exportItem).toHaveFocus();
    // The parent menu stays open.
    expect(screen.getByRole("menu", { name: "More" })).toBeInTheDocument();
  });
});

function PopoverHarness() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [value, setValue] = useState("");
  return (
    <>
      <button type="button" onClick={(event) => setAnchor(event.currentTarget)}>
        Open
      </button>
      <p>Outside</p>
      <AppPopover open={anchor !== null} anchor={anchor} ariaLabel="Picker" onClose={() => setAnchor(null)}>
        <AppSelect
          label="Fruit"
          value={value}
          placeholder="Choose…"
          options={[
            { value: "apple", label: "Apple" },
            { value: "pear", label: "Pear" },
          ]}
          onChange={setValue}
        />
      </AppPopover>
    </>
  );
}

describe("AppPopover", () => {
  it("stays open while an option is picked, closes on an outside click", async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Picker" });

    await user.click(within(dialog).getByRole("combobox", { name: "Fruit" }));
    await user.click(screen.getByRole("option", { name: "Pear" }));
    expect(screen.getByRole("dialog", { name: "Picker" })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Fruit" })).toHaveAttribute("title", "Pear");

    await user.click(screen.getByText("Outside"));
    expect(screen.queryByRole("dialog", { name: "Picker" })).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to its button", async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Picker" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
