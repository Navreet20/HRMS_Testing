import {
  mapApiHttpError,
  type ApiHttpMethod,
} from "@/shared";
import type { SkillsGateway } from "./skillsGateway";

export type SkillsRequest = <T>(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
) => Promise<T>;

export interface HttpSkillsGatewayOptions {
  readonly request: SkillsRequest;
}

async function runRequest<T>(
  request: SkillsRequest,
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    return await request<T>(method, path, body);
  } catch (error) {
    throw mapApiHttpError(error);
  }
}

/** Live skills catalog gateway targeting FastAPI REST `/api/v1/skills`. */
export function createHttpSkillsGateway(
  options: HttpSkillsGatewayOptions,
): SkillsGateway {
  const { request } = options;
  return {
    listSkills: () => runRequest(request, "GET", "/skills"),
    createSkill: (body) => runRequest(request, "POST", "/skills", body),
    updateSkill: (skillId, body) =>
      runRequest(
        request,
        "PATCH",
        `/skills/${encodeURIComponent(skillId)}`,
        body,
      ),
  };
}
