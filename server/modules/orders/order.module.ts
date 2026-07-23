import { orderContract } from './order.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getOrdersRepository } from './order.repository.js'

// ── API behavior: BaseCrudService.list only. searchFields is [] — today's
//    OrdersService had no keyword search; adding ['orderNumber'] would be new
//    functionality, out of scope for this shape-conformance refactor. ──
export const ordersService = new BaseCrudService({
  repository: getOrdersRepository(),
  api: orderContract.api,
  searchFields: [],
})

export const orderRoutes = createCrudRoutes(ordersService, orderContract.api)
