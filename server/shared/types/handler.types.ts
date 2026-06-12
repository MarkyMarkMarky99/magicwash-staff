/**
 * Server-only runtime request types — what the ApiHandler builds from a
 * VercelRequest before handing it to a controller. NOT part of the FE↔BE
 * contract (the frontend sends an HTTP request, never this object), so it has
 * no equivalent in `contracts/` and lives here.
 */

/** Raw query exactly as it arrives on the URL (strings, pre-parse). */
export type ApiQueryValue = string | string[] | undefined
export type ApiQueryParams = Record<string, ApiQueryValue>

/** The framework-agnostic request a controller receives. */
export interface ApiHandlerRequest<TQuery extends ApiQueryParams = ApiQueryParams, TBody = unknown> {
  method: string
  query: TQuery
  body: TBody
  headers: Record<string, string | string[] | undefined>
  params: Record<string, string> // route path params, e.g. /appointments/:id
}
