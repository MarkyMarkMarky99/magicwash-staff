import { z } from 'zod'
import {
  apiErrorBodySchema,
  apiErrorCodeSchema,
  apiPaginationMetaSchema,
  apiResponseMetaSchema,
} from '../../../contracts/shared/api.schema'

/**
 * Server-side named types for the response envelope, derived from the shared
 * contract (`contracts/shared/api.schema.ts`) — the single source. This module
 * only infers the types the http builders consume. The generic success/
 * paginated wrappers are TS generics (one Zod schema can't be generic over its
 * data), declared here over the contract's inferred meta/error pieces.
 */

/** Runtime value object of error codes (`API_ERROR_CODES.NOT_FOUND` === 'NOT_FOUND'). */
export const API_ERROR_CODES = apiErrorCodeSchema.enum
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export type ApiPaginationMeta = z.infer<typeof apiPaginationMetaSchema>
type ApiResponseMeta = z.infer<typeof apiResponseMetaSchema>
type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

export interface ApiSuccessResponse<TData> {
  success: true
  data: TData
  meta?: ApiResponseMeta
}

export interface ApiPaginatedResponse<TItem> {
  success: true
  data: TItem[]
  meta: ApiResponseMeta & { pagination: ApiPaginationMeta }
}

export interface ApiErrorResponse {
  success: false
  error: ApiErrorBody
  meta?: ApiResponseMeta
}
