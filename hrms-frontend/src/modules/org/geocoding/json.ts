export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

export function textValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return value == null ? "" : String(value).trim();
}

export function firstText(
  record: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = textValue(record, key);
    if (value) {
      return value;
    }
  }
  return "";
}
