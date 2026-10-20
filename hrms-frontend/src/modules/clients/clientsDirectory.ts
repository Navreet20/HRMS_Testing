import {
  CLIENT_INDUSTRIES,
  CLIENT_LOCATION_REGIONS,
  DEFAULT_DIRECTORY_PAGE_SIZE,
} from "./constants";
import { LOCATION_COUNTRIES } from "@/modules/org/geo";
import type { ClientRecord, ClientStatus } from "./types";
import type { ProjectRecord, ProjectStatus } from "@/modules/projects/types";
import { isAppFilterConstraint } from "@/shared/ui";

export type ClientsRowKind = "client" | "project";
export type ClientsDirectorySortKey = "name" | "status";
export type ClientsDirectorySortDirection = "asc" | "desc";
export type ClientsDirectoryPageSize = 10 | 25 | 50;

export type ClientsDirectoryStatus = ClientStatus | ProjectStatus;

export interface ClientsDirectoryRow {
  readonly kind: ClientsRowKind;
  readonly id: string;
  readonly name: string;
  readonly clientId: string;
  /** Human-readable project id (PRJ#####); empty for client rows. */
  readonly projectDisplayId: string;
  /** Project short code; empty for client rows. */
  readonly projectCode: string;
  readonly locationIdsLabel: string;
  readonly stakeholderIdsLabel: string;
  readonly accountOwnerName: string;
  readonly locationsLabel: string;
  readonly status: ClientsDirectoryStatus;
  readonly region: string;
  readonly industry: string;
  readonly relatedName: string;
}

export interface ClientsDirectoryQuery {
  readonly search: string;
  readonly region: string;
  readonly industry: string;
  readonly status: ClientStatus | "" | "all";
  readonly browseAll: boolean;
  readonly sortKey: ClientsDirectorySortKey;
  readonly sortDirection: ClientsDirectorySortDirection;
  readonly page: number;
  readonly pageSize: ClientsDirectoryPageSize;
}

export interface ClientsDirectoryPageResult {
  readonly rows: readonly ClientsDirectoryRow[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

/** Client card with nested projects for the directory card UI. */
export interface ClientsDirectoryGroup {
  readonly client: ClientRecord;
  readonly clientRow: ClientsDirectoryRow;
  readonly projects: readonly {
    readonly project: ProjectRecord;
    readonly row: ClientsDirectoryRow;
  }[];
  /** True when the card is shown because a nested project matched search. */
  readonly expandProjects: boolean;
  /** Set when the server counted the projects, so `projects` can stay empty. */
  readonly activeProjectCount?: number;
}

export interface ClientsDirectoryGroupsPageResult {
  readonly groups: readonly ClientsDirectoryGroup[];
  readonly total: number;
  readonly pageCount: number;
  readonly page: number;
}

export interface ClientsFilterOption {
  readonly value: string;
  readonly label: string;
}

const COUNTRY_LABELS = new Map(
  LOCATION_COUNTRIES.map((country) => [country.code, country.name]),
);

const REGION_LABELS: Readonly<Record<string, string>> = {
  NA: "NA",
  EMEA: "EMEA",
  APAC: "APAC",
  LATAM: "LATAM",
};

function clientIndustry(client: ClientRecord | null | undefined): string {
  if (!client) {
    return "";
  }
  return (client.industry || client.type || "").trim();
}

function uniqueRegionsFromLocations(
  client: ClientRecord,
): readonly string[] {
  const seen = new Set<string>();
  const regions: string[] = [];
  for (const location of client.locations) {
    const code = (location.region ?? "").trim();
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    regions.push(code);
  }
  return regions;
}

export function createDefaultClientsDirectoryQuery(
  overrides: Partial<ClientsDirectoryQuery> = {},
): ClientsDirectoryQuery {
  return {
    search: "",
    region: "",
    industry: "",
    status: "",
    browseAll: false,
    sortKey: "name",
    sortDirection: "asc",
    page: 1,
    pageSize: DEFAULT_DIRECTORY_PAGE_SIZE,
    ...overrides,
  };
}

export function clientsDirectoryIsBrowsing(
  query: ClientsDirectoryQuery,
): boolean {
  return (
    query.browseAll ||
    Boolean(query.search.trim()) ||
    isAppFilterConstraint(query.industry) ||
    isAppFilterConstraint(query.status)
  );
}

/** Shortest search the server is asked about; one letter matches almost everything. */
export const CLIENTS_SEARCH_MIN_CHARS = 2;

/** Whether the server-backed directory lists anything (a search needs enough letters). */
export function clientsOverviewIsBrowsing(query: ClientsDirectoryQuery): boolean {
  return (
    query.browseAll ||
    query.search.trim().length >= CLIENTS_SEARCH_MIN_CHARS ||
    isAppFilterConstraint(query.industry) ||
    isAppFilterConstraint(query.status)
  );
}

export function clientsDirectoryFiltersActive(
  query: ClientsDirectoryQuery,
): boolean {
  return (
    query.browseAll ||
    Boolean(query.search.trim()) ||
    isAppFilterConstraint(query.industry) ||
    isAppFilterConstraint(query.status)
  );
}

export const CLIENT_DISPLAY_PREFIX = "CLI";
export const LOCATION_DISPLAY_PREFIX = "LOC";
export const STAKEHOLDER_DISPLAY_PREFIX = "STK";
export const CLIENT_DISPLAY_ID_WIDTH = 5;

function parseSequence(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      return null;
    }
    const stripped = trimmed.replace(/^(CLI|LOC|STK)/, "");
    if (/^\d+$/.test(stripped)) {
      return Number(stripped);
    }
  }
  return null;
}

function formatPrefixedId(
  prefix: string,
  value: string | number | null | undefined,
): string {
  if (typeof value === "string") {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.startsWith(prefix) && /^\d+$/.test(trimmed.slice(prefix.length))) {
      const sequence = Number(trimmed.slice(prefix.length));
      return `${prefix}${String(sequence).padStart(CLIENT_DISPLAY_ID_WIDTH, "0")}`;
    }
  }
  const sequence = parseSequence(value);
  if (sequence == null) {
    return "";
  }
  return `${prefix}${String(sequence).padStart(CLIENT_DISPLAY_ID_WIDTH, "0")}`;
}

export function formatClientId(
  clientNumber: string | number | null | undefined,
): string {
  return formatPrefixedId(CLIENT_DISPLAY_PREFIX, clientNumber);
}

export function formatLocationId(
  locationNumber: string | number | null | undefined,
): string {
  return formatPrefixedId(LOCATION_DISPLAY_PREFIX, locationNumber);
}

export function formatStakeholderId(
  stakeholderNumber: string | number | null | undefined,
): string {
  return formatPrefixedId(STAKEHOLDER_DISPLAY_PREFIX, stakeholderNumber);
}

export function formatDisplayIds(
  values: readonly (string | number | null | undefined)[],
  format: (value: string | number) => string = (value) =>
    formatLocationId(value),
): string {
  return values
    .map((value) => {
      if (value == null || value === "") {
        return "";
      }
      return format(value);
    })
    .filter(Boolean)
    .join(", ");
}

export function regionLabel(code: string): string {
  if (!code) {
    return "";
  }
  return REGION_LABELS[code] ?? COUNTRY_LABELS.get(code) ?? code;
}

function clientForProject(
  project: ProjectRecord,
  customersById: Map<string, ClientRecord>,
  customersByName: Map<string, ClientRecord>,
): ClientRecord | null {
  if (project.clientId) {
    const byId = customersById.get(project.clientId);
    if (byId) {
      return byId;
    }
  }
  const names = [project.clientName, project.endClient]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  for (const name of names) {
    const byName = customersByName.get(name);
    if (byName) {
      return byName;
    }
  }
  return null;
}

function locationRegionsByCustomerId(
  clients: readonly ClientRecord[],
): Map<string, readonly string[]> {
  const regionsByCustomer = new Map<string, readonly string[]>();
  for (const client of clients) {
    regionsByCustomer.set(client.id, uniqueRegionsFromLocations(client));
  }
  return regionsByCustomer;
}

export function projectLinksToClient(
  project: ProjectRecord,
  clientId: string,
  previousName: string,
): boolean {
  if (project.clientId === clientId) {
    return true;
  }
  const needle = previousName.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  return [project.clientName, project.endClient].some(
    (value) => value?.trim().toLowerCase() === needle,
  );
}

export function resolveClientForProject(
  project: ProjectRecord,
  clients: readonly ClientRecord[],
): ClientRecord | null {
  const customersById = new Map(
    clients.map((client) => [client.id, client]),
  );
  const customersByName = new Map(
    clients.map((client) => [client.name.trim().toLowerCase(), client]),
  );
  return clientForProject(project, customersById, customersByName);
}

function locationNames(client: ClientRecord | null): string {
  if (!client) {
    return "";
  }
  const names = client.locations
    .map((location) => location.locationName.trim())
    .filter(Boolean);
  if (names.length > 0) {
    return names.join(", ");
  }
  if (client.locations.length > 0) {
    return `${client.locations.length} location${client.locations.length === 1 ? "" : "s"}`;
  }
  return "";
}

function ownerName(
  client: ClientRecord | null,
  ownerNames: ReadonlyMap<string, string>,
): string {
  if (!client) {
    return "";
  }
  if (client.accountOwnerName?.trim()) {
    return client.accountOwnerName.trim();
  }
  if (client.accountOwnerId) {
    return ownerNames.get(client.accountOwnerId) ?? "";
  }
  return "";
}

export function toClientRow(
  client: ClientRecord,
  ownerNames: ReadonlyMap<string, string> = new Map(),
  locationRegions: readonly string[] = uniqueRegionsFromLocations(client),
): ClientsDirectoryRow {
  return {
    kind: "client",
    id: client.id,
    name: client.name,
    clientId: formatClientId(client.clientNumber),
    projectDisplayId: "",
    projectCode: "",
    locationIdsLabel: formatDisplayIds(
      client.locations.map((location) => location.clientLocationId),
      formatLocationId,
    ),
    stakeholderIdsLabel: formatDisplayIds(
      client.stakeholders.map((row) => row.stakeholderId),
      formatStakeholderId,
    ),
    accountOwnerName: ownerName(client, ownerNames),
    locationsLabel: locationNames(client),
    status: client.status,
    region: locationRegions[0] ?? "",
    industry: clientIndustry(client),
    relatedName: "",
  };
}

export function toProjectRow(
  project: ProjectRecord,
  client: ClientRecord | null,
  ownerNames: ReadonlyMap<string, string> = new Map(),
): ClientsDirectoryRow {
  return {
    kind: "project",
    id: project.id,
    name: project.name,
    clientId: formatClientId(client?.clientNumber),
    projectDisplayId: project.projectDisplayId?.trim() ?? "",
    projectCode: project.code.trim(),
    locationIdsLabel: formatDisplayIds(
      client?.locations.map((location) => location.clientLocationId) ?? [],
      formatLocationId,
    ),
    stakeholderIdsLabel: formatDisplayIds(
      client?.stakeholders.map((row) => row.stakeholderId) ?? [],
      formatStakeholderId,
    ),
    accountOwnerName: ownerName(client, ownerNames),
    locationsLabel: locationNames(client),
    status: project.status,
    region: (project.region ?? "").trim(),
    industry: clientIndustry(client),
    relatedName: project.clientName ?? client?.name ?? project.endClient ?? "",
  };
}

/** Text search: client name and client id only. */
function matchesClientSearch(row: ClientsDirectoryRow, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [row.name, row.clientId]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function compareRows(
  left: ClientsDirectoryRow,
  right: ClientsDirectoryRow,
  query: ClientsDirectoryQuery,
): number {
  let comparison = 0;
  if (query.sortKey === "status") {
    comparison = left.status.localeCompare(right.status);
  } else {
    comparison = left.name.localeCompare(right.name);
  }
  return query.sortDirection === "asc" ? comparison : -comparison;
}

export function selectClientsDirectoryPage(
  clients: readonly ClientRecord[],
  _projects: readonly ProjectRecord[],
  query: ClientsDirectoryQuery,
  ownerNames: ReadonlyMap<string, string> = new Map(),
): ClientsDirectoryPageResult {
  if (!clientsDirectoryIsBrowsing(query)) {
    return { rows: [], total: 0, pageCount: 1, page: 1 };
  }

  const regionsByCustomer = locationRegionsByCustomerId(clients);

  const mixed: ClientsDirectoryRow[] = [
    ...clients.map((client) =>
      toClientRow(
        client,
        ownerNames,
        regionsByCustomer.get(client.id) ?? [],
      ),
    ),
  ];

  const filtered = mixed
    .filter((row) => matchesClientSearch(row, query.search))
    .filter((row) => rowMatchesFilters(row, query))
    .slice()
    .sort((left, right) => compareRows(left, right, query));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;

  return {
    rows: filtered.slice(start, start + query.pageSize),
    total,
    pageCount,
    page,
  };
}

function clientMatchesFilters(
  client: ClientRecord,
  row: ClientsDirectoryRow,
  query: ClientsDirectoryQuery,
): boolean {
  if (
    isAppFilterConstraint(query.industry) &&
    clientIndustry(client) !== query.industry
  ) {
    return false;
  }
  if (isAppFilterConstraint(query.status) && row.status !== query.status) {
    return false;
  }
  return true;
}

function rowMatchesFilters(
  row: ClientsDirectoryRow,
  query: ClientsDirectoryQuery,
): boolean {
  if (isAppFilterConstraint(query.industry) && row.industry !== query.industry) {
    return false;
  }
  if (isAppFilterConstraint(query.status) && row.status !== query.status) {
    return false;
  }
  return true;
}

/** Cards for a page the server already filtered, sorted and counted. */
export function clientsDirectoryGroupsFromOverview(
  clients: readonly ClientRecord[],
  activeProjectCounts: ReadonlyMap<string, number>,
  ownerNames: ReadonlyMap<string, string> = new Map(),
): readonly ClientsDirectoryGroup[] {
  return clients.map((client) => ({
    client,
    clientRow: toClientRow(client, ownerNames, uniqueRegionsFromLocations(client)),
    projects: [],
    expandProjects: false,
    activeProjectCount: activeProjectCounts.get(client.id) ?? 0,
  }));
}

/**
 * Groups matching clients with nested projects for the card directory.
 * Paginated by client card (not flat mixed rows).
 */
export function selectClientsDirectoryGroups(
  clients: readonly ClientRecord[],
  projects: readonly ProjectRecord[],
  query: ClientsDirectoryQuery,
  ownerNames: ReadonlyMap<string, string> = new Map(),
): ClientsDirectoryGroupsPageResult {
  if (!clientsDirectoryIsBrowsing(query)) {
    return { groups: [], total: 0, pageCount: 1, page: 1 };
  }

  const customersById = new Map(
    clients.map((client) => [client.id, client]),
  );
  const customersByName = new Map(
    clients.map((client) => [client.name.trim().toLowerCase(), client]),
  );

  const projectsByCustomerId = new Map<string, ProjectRecord[]>();
  for (const project of projects) {
    const client = clientForProject(
      project,
      customersById,
      customersByName,
    );
    if (!client) {
      continue;
    }
    const list = projectsByCustomerId.get(client.id) ?? [];
    list.push(project);
    projectsByCustomerId.set(client.id, list);
  }

  const groups: ClientsDirectoryGroup[] = [];
  for (const client of clients) {
    const linked = projectsByCustomerId.get(client.id) ?? [];
    const locationRegions = uniqueRegionsFromLocations(client);
    const clientRow = toClientRow(client, ownerNames, locationRegions);
    if (!clientMatchesFilters(client, clientRow, query)) {
      continue;
    }

    if (!matchesClientSearch(clientRow, query.search)) {
      continue;
    }

    const projectEntries = linked.map((project) => ({
      project,
      row: toProjectRow(project, client, ownerNames),
    }));

    groups.push({
      client,
      clientRow,
      projects: projectEntries
        .slice()
        .sort((left, right) =>
          left.row.name.localeCompare(right.row.name),
        ),
      expandProjects: false,
    });
  }

  groups.sort((left, right) => {
    let comparison = 0;
    if (query.sortKey === "status") {
      comparison = left.clientRow.status.localeCompare(right.clientRow.status);
    } else {
      comparison = left.clientRow.name.localeCompare(right.clientRow.name);
    }
    return query.sortDirection === "asc" ? comparison : -comparison;
  });

  const total = groups.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;

  return {
    groups: groups.slice(start, start + query.pageSize),
    total,
    pageCount,
    page,
  };
}

export function selectClientsRegionOptions(
  clients: readonly ClientRecord[] = [],
): readonly ClientsFilterOption[] {
  const seen = new Set<string>();
  const options: ClientsFilterOption[] = [];

  for (const code of CLIENT_LOCATION_REGIONS) {
    seen.add(code);
    options.push({ value: code, label: regionLabel(code) });
  }

  for (const client of clients) {
    for (const code of uniqueRegionsFromLocations(client)) {
      if (seen.has(code)) {
        continue;
      }
      seen.add(code);
      options.push({ value: code, label: regionLabel(code) });
    }
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export function selectClientsIndustryOptions(
  clients: readonly ClientRecord[],
): readonly ClientsFilterOption[] {
  const seen = new Set<string>();
  const options: ClientsFilterOption[] = [];

  for (const industry of CLIENT_INDUSTRIES) {
    seen.add(industry);
    options.push({ value: industry, label: industry });
  }

  for (const client of clients) {
    const industry = clientIndustry(client);
    if (!industry || seen.has(industry)) {
      continue;
    }
    seen.add(industry);
    options.push({ value: industry, label: industry });
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}
