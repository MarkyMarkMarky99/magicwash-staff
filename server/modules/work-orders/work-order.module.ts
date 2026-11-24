import { workOrderApiContract } from '../../../contracts/work-orders/work-order-api.schema.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { ok } from '../../shared/http/response.js'
import { bodyWithSessionActor } from '../../shared/http/session-actor.js'
import { withStockTakeFreezeGuard } from '../../shared/services/stock-take-freeze.js'
import { WorkOrderService } from './work-order.service.js'

export const workOrderService = new WorkOrderService()
const routes = createCrudRoutes(workOrderService, workOrderApiContract, { create: ['createdBy'], update: ['updatedBy'] }, { create: withStockTakeFreezeGuard, update: withStockTakeFreezeGuard })
export const workOrderRoutes = {
  collection: routes.collection,
  item: new ApiHandler({
    GET: (req) => routes.item!.handleRequest(req),
    PATCH: async (req) => {
      if (req.staff?.onBehalfOf) {
        const id = req.params.id!
        const payload = bodyWithSessionActor(req, 'updatedBy')
        return ok(await withStockTakeFreezeGuard(() => workOrderService.update(id, payload, { reportCascadeFailure: true })))
      }
      return routes.item!.handleRequest(req)
    },
  }),
}
