import type { ZodType, ZodTypeDef } from 'zod'
import { ApiError } from './api-error'

/**
 * Validate unknown runtime data (HTTP body/query) against a Zod schema.
 * On failure, throws an ApiError(VALIDATION_ERROR) whose details carry the
 * per-field issues, so ApiHandler turns it into a 422 automatically.
 *
 * ZodType<T, Def, unknown> lets the schema have transforms/defaults where
 * the input type differs from the output type T.
 */
export function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw ApiError.validation('Invalid request payload', result.error.flatten())
  }
  return result.data
}
