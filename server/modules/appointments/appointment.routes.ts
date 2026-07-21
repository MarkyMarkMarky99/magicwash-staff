import { appointmentService } from './appointment.module.js'
import { ApiHandler, created, ok, okPaged } from '../../shared/http/index.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'

const collection = new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await appointmentService.list(req.query)
    return okPaged(items, pagination)
  },
  POST: async (req) => created(await appointmentService.create(req.body)),
})

const item = new ApiHandler({
  GET: async (req) => ok(await appointmentService.getById(req.params.id)),
  PATCH: async (req) => ok(await appointmentService.update(req.params.id, req.body)),
})

export const appointmentRoutes: GatewayModuleRoutes = { collection, item }
