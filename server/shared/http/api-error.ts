import { API_ERROR_CODES, type ApiErrorCode } from '../types/api-response.types'

/** HTTP status code that each API error code maps to. */
export const STATUS_BY_ERROR_CODE: Record<ApiErrorCode, number> = {
  [API_ERROR_CODES.BAD_REQUEST]: 400,
  [API_ERROR_CODES.VALIDATION_ERROR]: 422,
  [API_ERROR_CODES.UNAUTHORIZED]: 401,
  [API_ERROR_CODES.FORBIDDEN]: 403,
  [API_ERROR_CODES.NOT_FOUND]: 404,
  [API_ERROR_CODES.METHOD_NOT_ALLOWED]: 405,
  [API_ERROR_CODES.CONFLICT]: 409,
  [API_ERROR_CODES.INTERNAL_ERROR]: 500,
}

/**
 * Error that services and controllers throw to short-circuit a request with a
 * typed API error. ApiHandler catches it and converts it to an ApiErrorResponse
 * with the matching HTTP status.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details?: unknown

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }

  get status(): number {
    return STATUS_BY_ERROR_CODE[this.code]
  }

  static badRequest(message = 'Bad request', details?: unknown): ApiError {
    return new ApiError(API_ERROR_CODES.BAD_REQUEST, message, details)
  }

  static validation(message = 'Validation failed', details?: unknown): ApiError {
    return new ApiError(API_ERROR_CODES.VALIDATION_ERROR, message, details)
  }

  static unauthorized(message = 'Unauthorized', details?: unknown): ApiError {
    return new ApiError(API_ERROR_CODES.UNAUTHORIZED, message, details)
  }

  static forbidden(message = 'Forbidden', details?: unknown): ApiError {
    return new ApiError(API_ERROR_CODES.FORBIDDEN, message, details)
  }

  static notFound(message = 'Not found', details?: unknown): ApiError {
    return new ApiError(API_ERROR_CODES.NOT_FOUND, message, details)
  }

  static conflict(message = 'Conflict', details?: unknown): ApiError {
    return new ApiError(API_ERROR_CODES.CONFLICT, message, details)
  }

  static internal(message = 'Internal server error', details?: unknown): ApiError {
    return new ApiError(API_ERROR_CODES.INTERNAL_ERROR, message, details)
  }
}
