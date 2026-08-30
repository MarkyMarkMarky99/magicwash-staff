import { workOrderApiContract } from '../../../contracts/work-orders/work-order-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { WorkOrderService } from './work-order.service.js'

export const workOrderService = new WorkOrderService()
export const workOrderRoutes = createCrudRoutes(workOrderService, workOrderApiContract)
