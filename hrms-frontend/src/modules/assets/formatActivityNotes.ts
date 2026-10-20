const UUID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/**
 * Swap clauses from the backend:
 * - Outgoing (this asset returned): `Swapped→alloc {uuid} asset COG-LAP-0001`
 *   The named ID is the replacement that came in.
 * - Incoming (this asset assigned): `Swapped←alloc {uuid} asset COG-LAP-0002`
 *   The named ID is the asset given up.
 */
const SWAP_OR_UUID_RE = new RegExp(
  `(?:[;,]\\s*)?(Swapped)(←|->|→|<-)?(?:\\s*alloc\\s+(${UUID_PATTERN}))?(?:\\s+asset\\s+([^\\s;,]+))?|(${UUID_PATTERN})`,
  "gi",
);

export type SwapDirection = "in" | "out";

export type ActivityNotePart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "uuid"; readonly full: string }
  | {
      readonly kind: "swapped";
      readonly uuid?: string;
      readonly assetId?: string;
      readonly direction?: SwapDirection;
    };

/** Historical activity notes used this internal phrase; show a human label instead. */
export function rewriteActivityNotePhrasing(notes: string): string {
  return notes.replace(/ack incomplete/gi, "Acknowledgment pending");
}

export function shortenUuid(value: string): string {
  return `${value.slice(0, 8)}…`;
}

function swapDirection(arrow: string | undefined): SwapDirection | undefined {
  if (arrow === "←" || arrow === "<-") {
    return "in";
  }
  if (arrow === "→" || arrow === "->") {
    return "out";
  }
  return undefined;
}

function pushText(parts: ActivityNotePart[], text: string): void {
  const cleaned = text.replace(/^[;,\s]+|[;,\s]+$/g, "").trim();
  if (cleaned) {
    parts.push({ kind: "text", text: cleaned });
  }
}

/** Split a stored activity note into display parts (text, truncated UUIDs, Swapped pill). */
export function parseActivityNote(
  notes: string | null | undefined,
): ActivityNotePart[] {
  const trimmed = notes?.trim() ?? "";
  if (!trimmed) {
    return [];
  }
  const rewritten = rewriteActivityNotePhrasing(trimmed);
  const parts: ActivityNotePart[] = [];
  let lastIndex = 0;
  for (const match of rewritten.matchAll(SWAP_OR_UUID_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      pushText(parts, rewritten.slice(lastIndex, index));
    }
    if (match[1]) {
      const direction = swapDirection(match[2]);
      const uuid = match[3];
      const assetId = match[4];
      parts.push({
        kind: "swapped",
        ...(uuid ? { uuid } : {}),
        ...(assetId ? { assetId } : {}),
        ...(direction ? { direction } : {}),
      });
      if (assetId) {
        parts.push({ kind: "text", text: `in exchange for ${assetId}` });
      }
    } else if (match[5]) {
      parts.push({ kind: "uuid", full: match[5] });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < rewritten.length) {
    pushText(parts, rewritten.slice(lastIndex));
  }
  return parts;
}
