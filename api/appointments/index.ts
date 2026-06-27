import { appointmentService } from '../../server/modules/appointments/appointment.module'
import { ApiHandler, created, okPaged } from '../../server/shared/http'

// /api/appointments
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await appointmentService.list(req.query)
    return okPaged(items, pagination)
  },
  POST: async (req) => created(await appointmentService.create(req.body)),
}).handle
