import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { OrderReportService } from './order-report.service.js'

export function createOrderReportRoutes(service: OrderReportService): GatewayModuleRoutes {
  return {
    collection: new ApiHandler({
      GET: async (req) => ok(await service.get(req.query)),
    }),
  }
}

export const orderReportRoutes = createOrderReportRoutes(new OrderReportService())
