import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_ERROR_CODES } from '../../../contracts/shared/api.schema.js'
import { ApiError } from './api-error.js'
import type { ApiHandlerRequest, ApiQueryParams } from './api-handler.js'
import { errorBody, type ApiResult, writeResult } from './response.js'
import type { GatewayModuleRoutes, RouteLoader } from './gateway.types.js'

type RouteRegistry = Record<string, RouteLoader>

export class ApiGateway {
  constructor(private readonly registry: RouteRegistry) {}

  handleRequest = async (req: VercelRequest): Promise<ApiResult> => {
    try {
      return await this.dispatch(req)
    } catch (error) {
      return toErrorResult(error)
    }
  }

  handle = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    writeResult(res, await this.handleRequest(req))
  }

  private dispatch = async (req: VercelRequest): Promise<ApiResult> => {
    const segments = parsePath(req.url)
    if (segments.length === 0 || segments.length > 2) {
      throw ApiError.notFound('Route not found')
    }

    const moduleName = segments[0]
    if (!Object.prototype.hasOwnProperty.call(this.registry, moduleName)) {
      throw ApiError.notFound('Route not found')
    }

    const loader = this.registry[moduleName]
    let routes: GatewayModuleRoutes
    try {
      routes = await loader()
    } catch (error) {
      console.error('Failed to initialize API module route', { moduleName, error })
      return internalErrorResult()
    }

    const handler = segments.length === 1 ? routes.collection : routes.item
    if (!handler) {
      throw ApiError.notFound('Route not found')
    }

    return handler.handleRequest(toApiRequest(req, segments))
  }
}

function parsePath(url: string | undefined): string[] {
  let pathname: string
  try {
    pathname = new URL(url ?? '/', 'http://internal').pathname
  } catch {
    throw ApiError.badRequest('Malformed API path')
  }

  let rawPath: string
  if (pathname === '/api') {
    rawPath = ''
  } else if (pathname.startsWith('/api/')) {
    rawPath = pathname.slice('/api/'.length)
  } else {
    throw ApiError.notFound('Route not found')
  }

  if (!rawPath) return []

  const rawSegments = rawPath.split('/')
  if (rawSegments.at(-1) === '') {
    rawSegments.pop()
  }
  if (rawSegments.some((segment) => segment === '')) {
    throw ApiError.badRequest('Malformed API path')
  }

  return rawSegments.map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      throw ApiError.badRequest('Malformed API path')
    }
  })
}

function toApiRequest(req: VercelRequest, segments: string[]): ApiHandlerRequest {
  const query = Object.fromEntries(
    Object.entries(req.query ?? {}).filter(([key]) => key !== 'path'),
  ) as ApiQueryParams

  return {
    method: req.method ?? 'GET',
    query,
    body: req.body,
    headers: req.headers,
    params: segments.length === 2 ? { id: segments[1] } : {},
  }
}

function toErrorResult(error: unknown): ApiResult {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: errorBody(error.code, error.message, error.details),
    }
  }

  console.error('Unhandled API gateway error', error)
  return internalErrorResult()
}

function internalErrorResult(): ApiResult {
  return {
    status: 500,
    body: errorBody(API_ERROR_CODES.INTERNAL_ERROR, 'Internal server error'),
  }
}
