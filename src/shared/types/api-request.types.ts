export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiClientQueryPrimitive = string | number | boolean | null | undefined

export type ApiClientRequestQuery = Record<string, ApiClientQueryPrimitive>

export interface ApiRequestOptions<TQuery extends ApiClientRequestQuery = ApiClientRequestQuery, TBody = unknown> {
  method?: ApiHttpMethod
  query?: TQuery
  body?: TBody
  headers?: Record<string, string>
}
