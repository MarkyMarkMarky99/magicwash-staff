import { ordersService } from '../../server/modules/orders/order.module.js'
import { ApiHandler, okPaged } from '../../server/shared/http/index.js'

// /api/orders — read-only OrdersView access; there is intentionally no POST/PATCH route.
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await ordersService.list(req.query)
    return okPaged(items, pagination)
  },
}).handle
