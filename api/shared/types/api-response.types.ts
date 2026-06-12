export const API_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

export interface ApiPaginationMeta {
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface ApiResponseMeta {
  timestamp?: string
}

export interface ApiPaginatedMeta extends ApiResponseMeta {
  pagination: ApiPaginationMeta
}

export interface BaseResponse {
  success: boolean
  meta?: ApiResponseMeta
}

export interface ApiSuccessResponse<TData> extends BaseResponse {
  success: true
  data: TData
}

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  details?: unknown
}

export interface ApiErrorResponse extends BaseResponse {
  success: false
  error: ApiErrorBody
}

export interface ApiPaginatedResponse<TItem> extends ApiSuccessResponse<TItem[]> {
  meta: ApiPaginatedMeta
}
