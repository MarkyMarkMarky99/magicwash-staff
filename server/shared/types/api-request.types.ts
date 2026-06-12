// ── HTTP transport ────────────────────────────────────────────────
export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// Raw query exactly as it arrives on the URL (strings, pre-parse)
export type ApiQueryValue = string | string[] | undefined
export type ApiQueryParams = Record<string, ApiQueryValue>

// ── Parsed business query (what the service receives) ─────────────
export type ApiSortOrder = 'asc' | 'desc'

export interface ApiSortParams<TField extends string = string> {
  sortBy: TField
  sortOrder: ApiSortOrder
}

export interface ApiPaginationParams {
  page: number
  perPage: number
}

// Canonical source lives in the FE↔BE contract; re-exported here for BE consumers.
export { API_PAGINATION_DEFAULTS } from '../../../contracts/shared/pagination'

// Common list query: pagination + optional sort + search
export interface ApiListQuery<TSortField extends string = string> extends ApiPaginationParams {
  sort?: ApiSortParams<TSortField>
  search?: string
}

// ── Handler envelope (the runtime req/res the handler works with) ──
export interface ApiHandlerRequest<
  TQuery extends ApiQueryParams = ApiQueryParams,
  TBody = unknown,
> {
  method: ApiHttpMethod | string
  query: TQuery
  body: TBody
  headers: Record<string, string | string[] | undefined>
  params: Record<string, string> // route path params, e.g. /appointments/:id
}
