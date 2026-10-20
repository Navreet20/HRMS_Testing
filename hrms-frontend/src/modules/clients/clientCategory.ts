export type ClientCategory = "internal" | "direct" | "intermediary";

export const CLIENT_CATEGORIES: readonly ClientCategory[] = [
  "internal",
  "direct",
  "intermediary",
];

export const CLIENT_CATEGORY_LABELS: Readonly<Record<ClientCategory, string>> = {
  internal: "Internal",
  direct: "Direct",
  intermediary: "Intermediary",
};

export const CLIENT_CATEGORY_CHECKBOX_LABELS: Readonly<
  Record<ClientCategory, string>
> = {
  internal: "Internal client",
  direct: "Direct",
  intermediary: "Intermediary",
};

export const CLIENT_CATEGORY_REQUIRED_MESSAGE =
  "Select a client type: Internal, Direct, or Intermediary.";

export function parseClientCategory(raw: unknown): ClientCategory | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return (CLIENT_CATEGORIES as readonly string[]).includes(value)
    ? (value as ClientCategory)
    : null;
}

/** Clients saved before categories existed are Direct unless internal. */
export function resolveClientCategory(client: {
  readonly clientCategory?: ClientCategory | null | "";
  readonly isInternal?: boolean | null;
}): ClientCategory {
  return (
    parseClientCategory(client.clientCategory) ??
    (client.isInternal ? "internal" : "direct")
  );
}

const INTERNAL_NAME_PREFIX = /^internal\s*[-–—:]\s*/i;

/** "Walmart (Direct)"; an internal client named "Internal - HR" becomes "HR (Internal)". */
export function clientNameWithCategory(client: {
  readonly name: string;
  readonly clientCategory?: ClientCategory | null | "";
  readonly isInternal?: boolean | null;
}): string {
  const category = resolveClientCategory(client);
  const name =
    category === "internal"
      ? client.name.replace(INTERNAL_NAME_PREFIX, "").trim() || client.name
      : client.name;
  return `${name} (${CLIENT_CATEGORY_LABELS[category]})`;
}
