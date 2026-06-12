/**
 * Pagination defaults for the FE↔BE API contract. Lives in `contracts/` so the
 * camelCase request/query schemas stay self-contained — a contract file must
 * never import back into `server/` or `api/`. The backend re-exports this from
 * `server/shared/types/api-request.types.ts` for its own consumers.
 */
export const API_PAGINATION_DEFAULTS = {
  page: 1,
  perPage: 20,
} as const
