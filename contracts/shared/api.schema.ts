import { z } from 'zod'

/**
 * The generic FE↔BE API contract: HTTP/query conventions for requests and the
 * full response envelope. Per-feature business payloads/DTOs live in
 * `contracts/<feature>/<m>-api.schema.ts`; this file holds what is common to
 * every endpoint, so both sides develop against ONE shape.
 *
 * Pure Zod — NO type exports. Consumers `z.infer` at the point of use, e.g.
 *   type FooList = z.infer<ReturnType<typeof apiPaginatedSchema<typeof fooListResponseSchema>>>
 *
 * A contract file must never import from `server/` or `api/`. The serverless
 * handler's own request object (`ApiHandlerRequest`, raw query) is server-only
 * and lives in `server/shared/types/`, not here.
 */

// ── Request-side conventions ────────────────────────────────────────────────
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
export const sortOrderSchema = z.enum(['asc', 'desc'])

/** Default page / page size for list endpoints (feature list-query schemas reference these). */
export const API_PAGINATION_DEFAULTS = { page: 1, perPage: 20 } as const

// ── Response envelope ───────────────────────────────────────────────────────
export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'INTERNAL_ERROR',
])

/** Runtime value object of the error codes (`API_ERROR_CODES.NOT_FOUND === 'NOT_FOUND'`). */
export const API_ERROR_CODES = apiErrorCodeSchema.enum

export const apiPaginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
})

export const apiResponseMetaSchema = z.object({
  timestamp: z.string().optional(),
})

export const apiErrorBodySchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
})

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: apiErrorBodySchema,
  meta: apiResponseMetaSchema.optional(),
})

/** Success envelope, generic over the data schema — `z.infer` the result where used. */
export const apiSuccessSchema = <TData extends z.ZodTypeAny>(data: TData) =>
  z.object({
    success: z.literal(true),
    data,
    meta: apiResponseMetaSchema.optional(),
  })

/** Paginated success envelope, generic over the item schema. */
export const apiPaginatedSchema = <TItem extends z.ZodTypeAny>(item: TItem) =>
  z.object({
    success: z.literal(true),
    data: z.array(item),
    meta: apiResponseMetaSchema.extend({ pagination: apiPaginationMetaSchema }),
  })
