import { customerService } from './customer.module.js'
import { ApiHandler, created, ok, okPaged } from '../../shared/http/index.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'

const collection = new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await customerService.list(req.query)
    return okPaged(items, pagination)
  },
  POST: async (req) => created(await customerService.create(req.body)),
})

const item = new ApiHandler({
  GET: async (req) => ok(await customerService.getById(req.params.id)),
  PATCH: async (req) => ok(await customerService.update(req.params.id, req.body)),
})

export const customerRoutes: GatewayModuleRoutes = { collection, item }
