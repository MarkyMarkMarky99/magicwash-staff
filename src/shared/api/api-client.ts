import type { z } from 'zod'
import { apiErrorResponseSchema, type apiPaginationMetaSchema } from '@contracts/shared/api.schema'

/**
 * The single HTTP boundary for the frontend. It builds the request URL,
 * validates the *request* against the caller's contract schema, unwraps the
 * standard success envelope (`{ success, data, meta }` / `…meta.pagination`),
 * and turns error envelopes into a typed {@link ApiError}.
 *
 * It deliberately does NOT runtime-validate (`.parse`) response data: legacy
 * cells are dirty by backend decision (see `api/CLAUDE.md` — cell values are
 * never validated), so a strict parse would throw on a single dirty row and
 * break the whole list. Response types are derived with `z.infer` at the call
 * site and the data is passed through as-is. Only the error body is read with
 * `safeParse`, purely to recover a human-readable message.
 */

type ApiPagination = z.infer<typeof apiPaginationMetaSchema>

export interface ListResult<TItem> {
  items: TItem[]
  pagination: ApiPagination
}

/** Thrown for any non-2xx response; carries the backend error code when present. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface GetListOptions<TQuery extends z.ZodTypeAny> {
  /** Raw filter/query object; validated and serialized into the query string. */
  query?: unknown
  /** Contract list-query schema — the request is validated against it. */
  querySchema: TQuery
}

/**
 * GET a paginated list endpoint. The caller fixes the item type via the generic
 * (`apiGetList<CustomerListDto>(…)`); the data is returned untouched.
 */
export async function apiGetList<TItem, TQuery extends z.ZodTypeAny = z.ZodTypeAny>(
  path: string,
  options: GetListOptions<TQuery>,
): Promise<ListResult<TItem>> {
  const validatedQuery = options.querySchema.parse(options.query ?? {})
  const url = `${path}${buildQueryString(validatedQuery)}`

  const response = await fetch(url)
  if (!response.ok) throw await toApiError(response)

  const body = (await response.json()) as {
    data: TItem[]
    meta: { pagination: ApiPagination }
  }

  return { items: body.data, pagination: body.meta.pagination }
}

/** GET a single-resource endpoint and unwrap the standard success envelope. */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw await toApiError(response)

  const body = (await response.json()) as { data: T }
  return body.data
}

interface WriteOptions<TRequest extends z.ZodTypeAny> {
  /** Raw request body; validated against the shared API contract before sending. */
  data: unknown
  /** Contract request schema for this operation. */
  requestSchema: TRequest
}

/** POST a resource and unwrap the standard success envelope. */
export async function apiPost<TResponse, TRequest extends z.ZodTypeAny = z.ZodTypeAny>(
  path: string,
  options: WriteOptions<TRequest>,
): Promise<TResponse> {
  return apiWrite<TResponse, TRequest>(path, 'POST', options)
}

/** PATCH a resource and unwrap the standard success envelope. */
export async function apiPatch<TResponse, TRequest extends z.ZodTypeAny = z.ZodTypeAny>(
  path: string,
  options: WriteOptions<TRequest>,
): Promise<TResponse> {
  return apiWrite<TResponse, TRequest>(path, 'PATCH', options)
}

async function apiWrite<TResponse, TRequest extends z.ZodTypeAny>(
  path: string,
  method: 'POST' | 'PATCH',
  options: WriteOptions<TRequest>,
): Promise<TResponse> {
  const validatedData = options.requestSchema.parse(options.data)
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedData),
  })
  if (!response.ok) throw await toApiError(response)

  const body = (await response.json()) as { data: TResponse }
  return body.data
}

/** Serialize a validated query object, skipping null/undefined and empty strings. */
function buildQueryString(query: unknown): string {
  if (!query || typeof query !== 'object') return ''

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') continue
    params.set(key, String(value))
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Read the standard error envelope to surface its message, degrading gracefully. */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const parsed = apiErrorResponseSchema.safeParse(await response.json())
    if (parsed.success) {
      return new ApiError(parsed.data.error.message, response.status, parsed.data.error.code)
    }
  } catch {
    // Body was not JSON / not an error envelope — fall through to a generic message.
  }
  return new ApiError(`Request failed: ${response.status}`, response.status)
}
