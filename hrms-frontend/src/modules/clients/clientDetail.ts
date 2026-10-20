import {
  normalizeClientsModuleData,
  normalizeProjectsModuleData,
} from "@/shared/live";
import type { ProjectsModuleData } from "@/modules/projects/types";
import type { ClientRecord } from "./types";

export interface ClientDetailParts {
  readonly client: ClientRecord | null;
  /** This client's projects with their full allocations, plus the picker lists. */
  readonly projects: ProjectsModuleData;
}

/**
 * Turns the client-detail answer into what the module already works with.
 *
 * `detailRaw` is `{ client, projects }` and `optionsRaw` the client picker
 * rows. Other projects' allocations (for capacity checks) are asked for per
 * person, only for the people a picker shows.
 */
export function clientDetailToParts(
  detailRaw: unknown,
  optionsRaw: unknown,
): ClientDetailParts {
  const detail = (detailRaw ?? {}) as { client?: unknown; projects?: unknown };
  const client =
    detail.client && typeof detail.client === "object"
      ? (normalizeClientsModuleData([detail.client]).clients[0] ?? null)
      : null;
  const data = normalizeProjectsModuleData(detail.projects ?? [], optionsRaw ?? []);
  return {
    client,
    projects: data,
  };
}
