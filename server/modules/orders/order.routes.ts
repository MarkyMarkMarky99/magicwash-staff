import { ordersService } from './order.module.js'
import { ApiHandler, okPaged } from '../../shared/http/index.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'

const collection = new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await ordersService.list(req.query)
    return okPaged(items, pagination)
  },
})

export const orderRoutes: GatewayModuleRoutes = { collection }
