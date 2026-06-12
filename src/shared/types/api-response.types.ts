export interface ApiResponseMeta {
  requestId?: string
}

export interface ApiSuccessResponse<TData> {
  success: true
  data: TData
  meta?: ApiResponseMeta
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

export interface ApiErrorResponse {
  success: false
  error: ApiErrorBody
  meta?: ApiResponseMeta
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse
