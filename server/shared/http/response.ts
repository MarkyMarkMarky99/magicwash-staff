import type {
  ApiErrorCode,
  ApiErrorResponse,
  ApiPaginatedResponse,
  ApiPaginationMeta,
  ApiSuccessResponse,
} from '../types/api-response.types'

function baseMeta() {
  return { timestamp: new Date().toISOString() }
}

/** Build a success response body. */
export function successBody<TData>(data: TData): ApiSuccessResponse<TData> {
  return { success: true, data, meta: baseMeta() }
}

/** Build a paginated success response body. */
export function paginatedBody<TItem>(
  items: TItem[],
  pagination: ApiPaginationMeta,
): ApiPaginatedResponse<TItem> {
  return { success: true, data: items, meta: { ...baseMeta(), pagination } }
}

/** Build an error response body. */
export function errorBody(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  return { success: false, error: { code, message, details }, meta: baseMeta() }
}

/** What a controller returns: the HTTP status plus the response body to send. */
export interface ApiResult<TBody = unknown> {
  status: number
  body: TBody
}

/** 200 with a single resource. */
export const ok = <TData>(data: TData): ApiResult<ApiSuccessResponse<TData>> => ({
  status: 200,
  body: successBody(data),
})

/** 201 with the created resource. */
export const created = <TData>(data: TData): ApiResult<ApiSuccessResponse<TData>> => ({
  status: 201,
  body: successBody(data),
})

/** 200 with a paginated list. */
export const okPaginated = <TItem>(
  items: TItem[],
  pagination: ApiPaginationMeta,
): ApiResult<ApiPaginatedResponse<TItem>> => ({
  status: 200,
  body: paginatedBody(items, pagination),
})
