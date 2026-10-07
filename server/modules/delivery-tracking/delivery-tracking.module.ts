import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { DeliveryTrackingService } from './delivery-tracking.service.js'

export function createDeliveryTrackingRoutes(service = new DeliveryTrackingService()): GatewayModuleRoutes {
  return {
    collection: new ApiHandler({ GET: () => { throw ApiError.notFound('Route not found') } }),
    item: new ApiHandler({ GET: async (req) => ok(await service.get(req.params.id)) }),
  }
}

export const deliveryTrackingRoutes = createDeliveryTrackingRoutes()
