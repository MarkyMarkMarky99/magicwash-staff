import { z } from 'zod'
import {
  httpMethodSchema,
  paginationParamsSchema,
  sortOrderSchema,
} from '../../../contracts/shared/api.schema'

/**
 * Server-side request types. Wire-level conventions (HTTP method, sort order,
 * pagination) are inferred from the shared contract
 * (`contracts/shared/api.schema.ts`). `ApiHandlerRequest` and the raw query
 * shape are the serverless handler's own runtime objects — server-only, never
 * part of the FE↔BE contract — so they are declared here.
 */

export { API_PAGINATION_DEFAULTS } from '../../../contracts/shared/api.schema'

export type ApiHttpMethod = z.infer<typeof httpMethodSchema>
export type ApiSortOrder = z.infer<typeof sortOrderSchema>
export type ApiPaginationParams = z.infer<typeof paginationParamsSchema>

export interface ApiSortParams<TField extends string = string> {
  sortBy: TField
  sortOrder: ApiSortOrder
}

export interface ApiListQuery<TSortField extends string = string> extends ApiPaginationParams {
  sort?: ApiSortParams<TSortField>
  search?: string
}

// ── Handler runtime objects (server-only) ───────────────────────────────────
/** Raw query exactly as it arrives on the URL (strings, pre-parse). */
export type ApiQueryValue = string | string[] | undefined
export type ApiQueryParams = Record<string, ApiQueryValue>

/** The framework-agnostic request the ApiHandler builds from a VercelRequest. */
export interface ApiHandlerRequest<TQuery extends ApiQueryParams = ApiQueryParams, TBody = unknown> {
  method: ApiHttpMethod | string
  query: TQuery
  body: TBody
  headers: Record<string, string | string[] | undefined>
  params: Record<string, string> // route path params, e.g. /appointments/:id
}
