import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { API_ERROR_CODES, httpMethodSchema } from '../../../contracts/shared/api.schema.js'
import { ApiError } from './api-error.js'
import { errorBody, type ApiResult, writeResult } from './response.js'

type ApiHttpMethod = z.infer<typeof httpMethodSchema>

// ── Handler runtime objects (server-only; no FE↔BE contract equivalent) ──
/** Raw query exactly as it arrives on the URL (strings, pre-parse). */
export type ApiQueryValue = string | string[] | undefined
export type ApiQueryParams = Record<string, ApiQueryValue>

/** The framework-agnostic request a controller receives (built from a VercelRequest). */
export interface ApiHandlerRequest<TQuery extends ApiQueryParams = ApiQueryParams, TBody = unknown> {
  method: string
  query: TQuery
  body: TBody
  headers: Record<string, string | string[] | undefined>
  params: Record<string, string> // route path params, e.g. /appointments/:id
}

/** Handles one HTTP method for a single route. */
export type ApiController = (req: ApiHandlerRequest) => Promise<ApiResult> | ApiResult

/** Map of HTTP method -> controller for a single route. */
export type ApiRouteMap = Partial<Record<ApiHttpMethod, ApiController>>

/**
 * Dispatches one API route by HTTP method.
 *
 *   // server/modules/appointments/appointment.routes.ts
 *   export default new ApiHandler({
 *     GET:    (req) => ok(await service.getAppointment(req.params.id)),
 *   }).handle
 *
 * Common concerns are handled here once: method dispatch (405 + Allow header),
 * request normalization, and turning thrown ApiErrors into ApiErrorResponses.
 */
export class ApiHandler {
  constructor(private readonly routes: ApiRouteMap) {}

  /** Pure dispatch: method -> controller -> ApiResult. */
  handleRequest = async (req: ApiHandlerRequest): Promise<ApiResult> => {
    const method = req.method.toUpperCase() as ApiHttpMethod
    const controller = this.routes[method]

    if (!controller) {
      return {
        status: 405,
        headers: { Allow: Object.keys(this.routes).join(', ') },
        body: errorBody(API_ERROR_CODES.METHOD_NOT_ALLOWED, `Method ${method} not allowed`),
      }
    }

    try {
      return await controller(req)
    } catch (error) {
      const err =
        error instanceof ApiError
          ? error
          : new ApiError(API_ERROR_CODES.INTERNAL_ERROR, 'Internal server error')
      return { status: err.status, body: errorBody(err.code, err.message, err.details) }
    }
  }

  /** Vercel adapter: normalize request, dispatch, and write the result. */
  handle = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const result = await this.handleRequest(this.toApiRequest(req))
    writeResult(res, result)
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
