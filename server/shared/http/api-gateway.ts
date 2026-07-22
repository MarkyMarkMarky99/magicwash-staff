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
    const segments = parsePath(req)
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

function parsePath(req: VercelRequest): string[] {
  const pathname = getPathname(req.url)

  if (isPublicApiPath(pathname) && !isGatewayDestinationPath(pathname)) {
    return parseSegments(pathname.slice('/api/'.length), true)
  }

  const routePath = getRoutePath(req)
  if (routePath !== undefined) {
    return parseSegments(routePath.value, routePath.isRaw)
  }

  if (isGatewayDestinationPath(pathname)) {
    return []
  }

  throw ApiError.notFound('Route not found')
}

function getPathname(url: string | undefined): string {
  try {
    return new URL(url ?? '/', 'http://internal').pathname
  } catch {
    throw ApiError.badRequest('Malformed API path')
  }
}

function isPublicApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function isGatewayDestinationPath(pathname: string): boolean {
  return pathname === '/api/[...path]' || pathname === '/api/[...path]/'
}

function getRoutePath(
  req: VercelRequest,
): { value: string | string[]; isRaw: boolean } | undefined {
  // Generic Vercel rewrites deliver the splat as a query parameter.
  // Keep the raw value from req.url so encoded slashes stay within one segment.
  const rawValue = getRawRoutePath(req.url)
  if (rawValue !== undefined) {
    return { value: rawValue, isRaw: true }
  }

  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (isRoutePathQueryKey(key)) {
      return { value, isRaw: false }
    }
  }

  return undefined
}

function getRawRoutePath(url: string | undefined): string | string[] | undefined {
  if (!url) return undefined

  let search: string
  try {
    search = new URL(url, 'http://internal').search.slice(1)
  } catch {
    return undefined
  }

  const values: string[] = []
  for (const pair of search.split('&')) {
    const separator = pair.indexOf('=')
    const rawKey = separator === -1 ? pair : pair.slice(0, separator)
    let key: string
    try {
      key = decodeURIComponent(rawKey)
    } catch {
      continue
    }
    if (!isRoutePathQueryKey(key)) continue
    values.push(separator === -1 ? '' : pair.slice(separator + 1))
  }

  if (values.length === 0) return undefined
  return values.length === 1 ? values[0] : values
}

function isRoutePathQueryKey(key: string): boolean {
  const normalizedKey = key.toLowerCase()
  return normalizedKey === 'path' || normalizedKey === '...path'
}

function parseSegments(path: string | string[], decodeSegments: boolean): string[] {
  const rawSegments = Array.isArray(path) ? [...path] : path.split('/')
  if (rawSegments.length === 0) return []
  if (rawSegments.at(-1) === '') {
    rawSegments.pop()
  }
  if (rawSegments.some((segment) => segment === '')) {
    throw ApiError.badRequest('Malformed API path')
  }

  return rawSegments.map((segment) => {
    if (!decodeSegments) return segment
    try {
      return decodeURIComponent(segment)
    } catch {
      throw ApiError.badRequest('Malformed API path')
    }
  })
}

function toApiRequest(req: VercelRequest, segments: string[]): ApiHandlerRequest {
  const query = Object.fromEntries(
    Object.entries(req.query ?? {}).filter(([key]) => !isRoutePathQueryKey(key)),
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
