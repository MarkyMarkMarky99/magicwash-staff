import { customerService } from '../../server/modules/customers/customer.module'
import { ApiHandler, ok } from '../../server/shared/http'

// /api/customers/:id  — soft-delete deferred (no DELETE), mirroring appointments.
export default new ApiHandler({
  GET: async (req) => ok(await customerService.getById(req.params.id)),
  PATCH: async (req) => ok(await customerService.update(req.params.id, req.body)),
}).handle
