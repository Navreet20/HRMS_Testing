import { toUserFacingApiError } from "../http/userFacingApiError";

/** Safe user-facing message from a gateway / transport failure. */
export function mutationErrorMessage(error: unknown): string {
  return toUserFacingApiError(error, "Request failed. Try again.");
}
