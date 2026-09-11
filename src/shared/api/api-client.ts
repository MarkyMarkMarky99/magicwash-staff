import type { z } from 'zod'
import { apiErrorResponseSchema, type apiPaginationMetaSchema } from '@contracts/shared/api.schema'
import { cachePolicyFor } from '@/shared/config/cache'
import { readCache, writeCache } from '@/shared/api/response-cache'

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

interface GetListOptions<TQuery extends z.ZodTypeAny, TItem = unknown> {
  /** Raw filter/query object; validated and serialized into the query string. */
  query?: unknown
  /** Contract list-query schema — the request is validated against it. */
  querySchema: TQuery
  /**
   * Called when a stale cached response has been refreshed in the background.
   * Pass it to swap the new data in; omit it to keep showing what was returned.
   */
  onFresh?: (result: ListResult<TItem>) => void
}

interface GetOptions<T> {
  onFresh?: (value: T) => void
}

/**
 * GET a paginated list endpoint. The caller fixes the item type via the generic
 * (`apiGetList<CustomerListDto>(…)`); the data is returned untouched.
 */
export async function apiGetList<TItem, TQuery extends z.ZodTypeAny = z.ZodTypeAny>(
  path: string,
  options: GetListOptions<TQuery, TItem>,
): Promise<ListResult<TItem>> {
  const validatedQuery = options.querySchema.parse(options.query ?? {})
  const url = `${path}${buildQueryString(validatedQuery)}`

  const unwrap = (body: { data: TItem[]; meta: { pagination: ApiPagination } }) => ({
    items: body.data,
    pagination: body.meta.pagination,
  })

  return read(url, unwrap, options.onFresh)
}

export async function apiGet<T>(path: string, options: GetOptions<T> = {}): Promise<T> {
  return read(path, (body: { data: T }) => body.data, options.onFresh)
}

/**
 * Serve a GET from cache when possible, otherwise from the network.
 *
 * A cached copy is returned immediately even when it is past its freshness
 * window; the refresh then runs in the background and `onFresh` delivers the new
 * value to a caller that wants to swap it in. Concurrent callers of the same URL
 * share one request.
 */
async function read<TBody, TValue>(
  url: string,
  unwrap: (body: TBody) => TValue,
  onFresh?: (value: TValue) => void,
): Promise<TValue> {
  if (!cachePolicyFor(url).cacheable) return fetchFresh(url, unwrap)

  const hit = readCache<TValue>(url)
  if (hit === null) return fetchFresh(url, unwrap)

  if (!hit.fresh) {
    // Background revalidation: the caller already has a value, so a failure here
    // must not surface as an unhandled rejection or replace good data with an error.
    void fetchFresh(url, unwrap)
      .then((value) => onFresh?.(value))
      .catch(() => undefined)
  }

  return hit.value
}

/** In-flight requests by URL, so parallel callers issue one network round trip. */
const inFlight = new Map<string, Promise<unknown>>()

async function fetchFresh<TBody, TValue>(
  url: string,
  unwrap: (body: TBody) => TValue,
): Promise<TValue> {
  const existing = inFlight.get(url)
  if (existing !== undefined) return existing as Promise<TValue>

  const request = (async () => {
    const response = await fetch(url)
    if (!response.ok) throw await toApiError(response)

    const value = unwrap((await response.json()) as TBody)
    writeCache(url, value)
    return value
  })()

  const tracked = request.finally(() => inFlight.delete(url))
  inFlight.set(url, tracked)
  return tracked
}

interface WriteOptions<TRequest extends z.ZodTypeAny> {
  /** Raw request body; validated against the shared API contract before sending. */
  data: unknown
  requestSchema: TRequest
}

export async function apiPost<TResponse, TRequest extends z.ZodTypeAny = z.ZodTypeAny>(
  path: string,
  options: WriteOptions<TRequest>,
): Promise<TResponse> {
  return apiWrite<TResponse, TRequest>(path, 'POST', options)
}

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
