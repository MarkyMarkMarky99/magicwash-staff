import { stockTakeApiContract as api } from '../../../contracts/stock-takes/stock-take-api.schema.js'
import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler, type ApiHandlerRequest } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { created, ok } from '../../shared/http/response.js'
import { requireStaffId } from '../../shared/http/session-actor.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { serializeStockTakeWrite } from '../../shared/services/stock-take-freeze.js'
import { StockTakeService } from './stock-take.service.js'

function requireOperator(request: ApiHandlerRequest) {
  const staffId = requireStaffId(request)
  if (request.staff?.role === 'device') throw ApiError.forbidden('Scan a staff card first')
  return staffId
}

function requireAdmin(request: ApiHandlerRequest) {
  const staffId = requireStaffId(request)
  if (request.staff?.role !== 'admin') throw ApiError.forbidden()
  return staffId
}

export function createStockTakeRoutes(service: StockTakeService): GatewayModuleRoutes {
  return {
    collection: new ApiHandler({
      GET: async request => {
        requireOperator(request)
        return ok(await service.active())
      },
      POST: async request => {
        const actor = requireAdmin(request)
        const input = parseOrThrow(api.request.create, request.body ?? {})
        return serializeStockTakeWrite(async () => created(await service.open(input.notes ?? null, actor)))
      },
    }),
    item: new ApiHandler({
      GET: async request => {
        if (request.params.id !== 'report') throw ApiError.notFound('Route not found')
        requireAdmin(request)
        const { sessionId } = parseOrThrow(api.query.report, request.query)
        return ok(await service.report(sessionId))
      },
      POST: async request => {
        const action = request.params.id
        if (action === 'scans') {
          const actor = requireOperator(request)
          const { sessionId, scans } = parseOrThrow(api.request.scans, request.body)
          return serializeStockTakeWrite(async () => ok(await service.scans(sessionId, scans, actor)))
        }
        const actor = requireAdmin(request)
        if (action === 'resolutions') {
          const { sessionId, resolutions } = parseOrThrow(api.request.resolutions, request.body)
          return serializeStockTakeWrite(async () => ok(await service.resolutions(sessionId, resolutions, actor)))
        }
        switch (action) {
          case 'close':
          case 'cancel':
          case 'preview':
          case 'apply':
          case 'finish': {
            const { sessionId } = parseOrThrow(api.request[action], request.body)
            return serializeStockTakeWrite(async () => ok(await service[action](sessionId, actor)))
          }
          default: throw ApiError.notFound('Route not found')
        }
      },
    }),
  }
}

export const stockTakeService = new StockTakeService()
export const stockTakeRoutes = createStockTakeRoutes(stockTakeService)
