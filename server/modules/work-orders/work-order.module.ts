import { workOrderApiContract } from '../../../contracts/work-orders/work-order-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { withStockTakeFreezeGuard } from '../../shared/services/stock-take-freeze.js'
import { WorkOrderService } from './work-order.service.js'

export const workOrderService = new WorkOrderService()
export const workOrderRoutes = createCrudRoutes(workOrderService, workOrderApiContract, { create: ['createdBy'], update: ['updatedBy'] }, { create: withStockTakeFreezeGuard, update: withStockTakeFreezeGuard })
