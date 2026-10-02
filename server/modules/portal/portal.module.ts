import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { PortalService } from './portal.service.js'

export function createPortalRoutes(service = new PortalService()): GatewayModuleRoutes {
  return {
    nestedItem: { path: 'customers', handler: new ApiHandler({ GET: async (req) => ok(await service.customer(req.params.id)) }) },
    collection: new ApiHandler({ GET: () => { throw ApiError.notFound('Route not found') } }),
    item: new ApiHandler({ GET: async (req) => {
      if (req.params.id === 'orders') return ok(await service.orders(req.query))
      if (req.params.id === 'invoices') return ok(await service.invoices(req.query))
      throw ApiError.notFound('Route not found')
    } }),
  }
}

export const portalRoutes = createPortalRoutes()
