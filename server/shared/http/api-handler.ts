import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { API_ERROR_CODES, httpMethodSchema } from '../../../contracts/shared/api.schema'
import type { ApiHandlerRequest, ApiQueryParams } from '../types/handler.types'
import { ApiError } from './api-error'
import { errorBody, type ApiResult } from './response'

type ApiHttpMethod = z.infer<typeof httpMethodSchema>

/** Handles one HTTP method for a single route. */
export type ApiController = (req: ApiHandlerRequest) => Promise<ApiResult> | ApiResult

/** Map of HTTP method -> controller for a single route. */
export type ApiRouteMap = Partial<Record<ApiHttpMethod, ApiController>>

/**
 * Dispatches one Vercel route by HTTP method. Create one ApiHandler per route
 * (one per file in Vercel's file-based routing), e.g. `/appointments` and
 * `/appointments/[id]` are two handlers.
 *
 *   // api/appointments/[id].ts
 *   export default new ApiHandler({
 *     GET:    (req) => ok(await service.getAppointment(req.params.id)),
 *   }).handle
 *
 * Common concerns are handled here once: method dispatch (405 + Allow header),
 * request normalization, and turning thrown ApiErrors into ApiErrorResponses.
 */
export class ApiHandler {
  constructor(private readonly routes: ApiRouteMap) {}

  handle = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const method = (req.method ?? 'GET').toUpperCase() as ApiHttpMethod
    const controller = this.routes[method]

    if (!controller) {
      res.setHeader('Allow', Object.keys(this.routes).join(', '))
      const err = new ApiError(
        API_ERROR_CODES.METHOD_NOT_ALLOWED,
        `Method ${method} not allowed`,
      )
      res.status(err.status).json(errorBody(err.code, err.message))
      return
    }

    try {
      const result = await controller(this.toApiRequest(req))
      if (result.status === 204) {
        res.status(204).end()
        return
      }
      res.status(result.status).json(result.body)
    } catch (error) {
      const err =
        error instanceof ApiError
          ? error
          : new ApiError(API_ERROR_CODES.INTERNAL_ERROR, 'Internal server error')
      res.status(err.status).json(errorBody(err.code, err.message, err.details))
    }
  }

  /** Normalize a Vercel request into the framework-agnostic ApiHandlerRequest. */
  private toApiRequest(req: VercelRequest): ApiHandlerRequest {
    return {
      method: (req.method ?? 'GET').toUpperCase(),
      query: req.query as ApiQueryParams,
      body: req.body,
      headers: req.headers,
      // On Vercel, dynamic route segments (e.g. [id]) arrive inside req.query.
      params: flattenParams(req.query),
    }
  }
}

/** Collapse Vercel's `string | string[]` query values into plain strings. */
function flattenParams(query: VercelRequest['query']): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    params[key] = Array.isArray(value) ? (value[0] ?? '') : value
  }
  return params
}
