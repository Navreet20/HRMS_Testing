import { useState } from "react";
import { Eye, FileText, Home, Pencil, Power, Search } from "lucide-react";

import {
  AppButton,
  AppDataTable,
  AppMenu,
  AppMenuItem,
  type AppDataTableColumn,
} from "@/shared/ui";
import { DirectoryEmptyState } from "@/shared/ui/DirectoryEmptyState";
import { PlusIcon } from "@/shared/ui/icons";
import { PAYMENT_TYPE_LABELS, VENDOR_STATUS_LABELS } from "../constants";
import {
  canDeactivateVendor,
  canEditVendor,
  canViewVendor,
} from "../selectors";
import type { VendorActor, VendorRecord } from "../types";
import { MoreIcon } from "./icons";
import { ui, vendorStatusClass } from "../uiClasses";

export type VendorActionKind = "view" | "edit" | "details" | "deactivate";

const DIRECTORY_PAGE_SIZE = 10;

interface DirectoryTableProps {
  /** Rows already filtered by the toolbar search and status. */
  readonly rows: readonly VendorRecord[];
  readonly actor: VendorActor;
  readonly emptyKind: "none" | "filtered";
  readonly canCreate: boolean;
  readonly onAction: (kind: VendorActionKind, vendor: VendorRecord) => void;
  readonly onClearFilters: () => void;
  readonly onAdd: () => void;
}

function ActionMenu({
  vendor,
  actor,
  onAction,
}: {
  readonly vendor: VendorRecord;
  readonly actor: VendorActor;
  readonly onAction: (kind: VendorActionKind, vendor: VendorRecord) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const showView = canViewVendor(actor);
  const showEdit = canEditVendor(actor);
  const showDetails = canViewVendor(actor);
  const showDeactivate =
    canDeactivateVendor(actor) && vendor.status === "ACTIVE";

  if (!showView && !showEdit && !showDetails && !showDeactivate) {
    return <span className={ui.muted}>No actions</span>;
  }

  function run(kind: VendorActionKind) {
    setAnchor(null);
    onAction(kind, vendor);
  }

  return (
    <>
      <button
        type="button"
        className={ui.rowMenuTrigger}
        aria-expanded={anchor !== null}
        aria-haspopup="menu"
        aria-label={`Actions for ${vendor.name}`}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        <MoreIcon />
      </button>
      <AppMenu
        open={anchor !== null}
        anchor={anchor}
        onClose={() => setAnchor(null)}
        ariaLabel={`Actions for ${vendor.name}`}
      >
        {showView ? (
          <AppMenuItem icon={<Eye />} onSelect={() => run("view")}>
            View
          </AppMenuItem>
        ) : null}
        {showEdit ? (
          <AppMenuItem icon={<Pencil />} onSelect={() => run("edit")}>
            Edit
          </AppMenuItem>
        ) : null}
        {showDetails ? (
          <AppMenuItem icon={<FileText />} onSelect={() => run("details")}>
            Open details
          </AppMenuItem>
        ) : null}
        {showDeactivate ? (
          <AppMenuItem icon={<Power />} onSelect={() => run("deactivate")}>
            <span className="text-emp-critical">Deactivate</span>
          </AppMenuItem>
        ) : null}
      </AppMenu>
    </>
  );
}

export function DirectoryTable({
  rows,
  actor,
  emptyKind,
  canCreate,
  onAction,
  onClearFilters,
  onAdd,
}: DirectoryTableProps) {
  const columns: AppDataTableColumn<VendorRecord>[] = [
    {
      id: "name",
      header: "Name",
      value: (vendor) => vendor.name,
      cellClassName: "font-semibold",
    },
    { id: "type", header: "Type", value: (vendor) => vendor.type || "—" },
    {
      id: "contactName",
      header: "Contact Name",
      value: (vendor) => vendor.contactName,
    },
    { id: "ein", header: "EIN", value: (vendor) => vendor.ein || "—" },
    {
      id: "paymentMethod",
      header: "Payment Method",
      value: (vendor) =>
        vendor.payment.paymentType
          ? PAYMENT_TYPE_LABELS[vendor.payment.paymentType]
          : "—",
    },
    {
      id: "netPayTerm",
      header: "Net Pay Term",
      value: (vendor) => Number(vendor.netPayTerm),
      cell: (vendor) => `${vendor.netPayTerm} days`,
    },
    {
      id: "corporateState",
      header: "Corporate State",
      value: (vendor) => vendor.corporateAddress.state || "—",
    },
    {
      id: "status",
      header: "Status",
      value: (vendor) => VENDOR_STATUS_LABELS[vendor.status],
      cell: (vendor) => (
        <span
          className={vendorStatusClass(vendor.status)}
        >
          {VENDOR_STATUS_LABELS[vendor.status]}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (vendor) => (
        <ActionMenu vendor={vendor} actor={actor} onAction={onAction} />
      ),
    },
  ];

  return (
    <AppDataTable
      data={rows}
      columns={columns}
      getRowId={(vendor) => vendor.id}
      ariaLabel="Vendors"
      resizable
      onRowClick={
        canViewVendor(actor) ? (vendor) => onAction("view", vendor) : undefined
      }
      sortBy={{ id: "name" }}
      pagination={{ pageSize: DIRECTORY_PAGE_SIZE }}
      emptyState={
        <DirectoryEmptyState
          icon={
            emptyKind === "filtered" ? (
              <Search size={22} strokeWidth={1.6} aria-hidden />
            ) : (
              <Home size={22} strokeWidth={1.6} aria-hidden />
            )
          }
          title={
            emptyKind === "filtered" ? "No matching vendors" : "No vendors yet"
          }
          message={
            emptyKind === "filtered"
              ? "Nothing matches the current search or filters. Try a different name or status."
              : "Add a vendor to start tracking suppliers and payment details."
          }
          action={
            emptyKind === "filtered" ? (
              <button
                type="button"
                className={ui.btnGhost}
                onClick={onClearFilters}
              >
                Clear filters
              </button>
            ) : canCreate ? (
              <AppButton onClick={onAdd}>
                <PlusIcon />
                Add your first vendor
              </AppButton>
            ) : null
          }
        />
      }
    />
  );
}
