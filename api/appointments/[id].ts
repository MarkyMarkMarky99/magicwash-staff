import { appointmentService } from '../../server/modules/appointments/appointment.module'
import { ApiHandler, ok } from '../../server/shared/http'

// /api/appointments/:id
export default new ApiHandler({
  GET: async (req) => ok(await appointmentService.getById(req.params.id)),
  PATCH: async (req) => ok(await appointmentService.update(req.params.id, req.body)),
}).handle
