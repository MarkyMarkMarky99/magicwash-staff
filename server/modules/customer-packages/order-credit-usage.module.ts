import { ApiHandler } from '../../shared/http/api-handler.js'
import { ok } from '../../shared/http/response.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { orderCreditUsageService } from './order-credit-usage.service.js'

export const orderCreditUsageRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    GET: async (req) => ok(await orderCreditUsageService.preview(req.query)),
    POST: async (req) => ({ status: 201, body: await orderCreditUsageService.confirm(req.body) }),
  }),
}
