import type { ProjectRecord } from "./types";

export const PROJECT_DISPLAY_PREFIX = "PRJ";
export const PROJECT_DISPLAY_WIDTH = 5;

/** Format / validate a PRJ##### display id. */
export function formatProjectDisplayId(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim() ?? "";
  return trimmed;
}

/** Next offline/local PRJ id from existing projects (mirrors backend allocator). */
export function nextProjectDisplayId(
  projects: readonly ProjectRecord[],
): string {
  let maxSeq = 0;
  for (const project of projects) {
    const raw = project.projectDisplayId?.trim() ?? "";
    if (!raw.startsWith(PROJECT_DISPLAY_PREFIX)) {
      continue;
    }
    const suffix = raw.slice(PROJECT_DISPLAY_PREFIX.length);
    if (/^\d+$/.test(suffix)) {
      maxSeq = Math.max(maxSeq, Number.parseInt(suffix, 10));
    }
  }
  return `${PROJECT_DISPLAY_PREFIX}${String(maxSeq + 1).padStart(PROJECT_DISPLAY_WIDTH, "0")}`;
}
