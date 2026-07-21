import { ordersService } from '../../server/modules/orders/orders.service'
import { ApiHandler, okPaged } from '../../server/shared/http'

// /api/orders — read-only OrdersView access; there is intentionally no POST/PATCH route.
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await ordersService.list(req.query)
    return okPaged(items, pagination)
  },
}).handle
