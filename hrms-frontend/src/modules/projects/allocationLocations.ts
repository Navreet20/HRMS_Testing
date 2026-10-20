import type { ClientLocationRecord } from "@/modules/clients/types";
import type { EmployeeOption } from "./types";

export type WorkLocationKind = "OFFICE" | "RESIDENTIAL";

export interface AllocationLocationOption {
  readonly value: string;
  readonly label: string;
  readonly kind?: WorkLocationKind;
  readonly locationId?: string;
}

export function isEmployeeRemote(employee: EmployeeOption | null | undefined): boolean {
  return (employee?.workMode ?? "").trim().toUpperCase() === "REMOTE";
}

export function workLocationOptionValue(
  kind: WorkLocationKind,
  locationId: string,
): string {
  return `${kind}:${locationId}`;
}

export function parseWorkLocationOptionValue(
  raw: string,
): { readonly kind: WorkLocationKind; readonly locationId: string } | null {
  const trimmed = raw.trim();
  const sep = trimmed.indexOf(":");
  if (sep <= 0) {
    return null;
  }
  const kind = trimmed.slice(0, sep).toUpperCase();
  const locationId = trimmed.slice(sep + 1).trim();
  if (!locationId || (kind !== "OFFICE" && kind !== "RESIDENTIAL")) {
    return null;
  }
  return { kind, locationId };
}

export function buildWorkLocationOptions(
  employee: EmployeeOption | null | undefined,
): readonly AllocationLocationOption[] {
  if (!employee) {
    return [];
  }
  const options: AllocationLocationOption[] = [];
  const officeId = employee.officeLocationId?.trim() || "";
  const officeLabel =
    employee.officeLocationLabel?.trim() ||
    (officeId ? "Office location" : "");
  if (officeId && officeLabel) {
    options.push({
      value: workLocationOptionValue("OFFICE", officeId),
      label: `Work / Office — ${officeLabel}`,
      kind: "OFFICE",
      locationId: officeId,
    });
  }

  if (isEmployeeRemote(employee)) {
    const residentialId =
      employee.residentialLocationId?.trim() ||
      employee.locationId?.trim() ||
      "";
    const residentialLabel =
      employee.residentialLocationLabel?.trim() ||
      employee.locationLabel?.trim() ||
      (residentialId ? "Residential address" : "");
    if (residentialId && residentialLabel) {
      options.push({
        value: workLocationOptionValue("RESIDENTIAL", residentialId),
        label: `Residential — ${residentialLabel}`,
        kind: "RESIDENTIAL",
        locationId: residentialId,
      });
    }
  }

  return options;
}

export function clientLocationOptionId(
  location: ClientLocationRecord,
): string {
  const uuid = location.id?.trim() || "";
  if (uuid) {
    return uuid;
  }
  return String(location.clientLocationId ?? "").trim();
}

export function formatClientLocationOptionLabel(
  location: ClientLocationRecord,
): string {
  const name = location.locationName?.trim() || "";
  if (name) {
    return name;
  }
  const region = [location.city, location.stateProvince, location.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  if (region) {
    return region;
  }
  const line = [location.address, location.addressLine2]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  return line || "Client location";
}

export function buildClientLocationOptions(
  locations: readonly ClientLocationRecord[] | null | undefined,
): readonly AllocationLocationOption[] {
  const options: AllocationLocationOption[] = [];
  const seen = new Set<string>();
  for (const location of locations ?? []) {
    const value = clientLocationOptionId(location);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    options.push({
      value,
      label: formatClientLocationOptionLabel(location),
    });
  }
  return options;
}

/** Map a stored allocation client-location id onto the dropdown option value. */
export function resolveClientLocationFormValue(
  storedId: string,
  locations: readonly ClientLocationRecord[] | null | undefined,
): string {
  const trimmed = storedId.trim();
  if (!trimmed) {
    return "";
  }
  for (const location of locations ?? []) {
    const uuid = location.id?.trim() || "";
    const display = String(location.clientLocationId ?? "").trim();
    if (
      trimmed === uuid ||
      trimmed === display ||
      trimmed.toUpperCase() === display.toUpperCase()
    ) {
      return uuid || display;
    }
  }
  return trimmed;
}
