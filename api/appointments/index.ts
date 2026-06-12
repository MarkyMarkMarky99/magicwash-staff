import { appointmentService } from '../modules/appointments/appointment.module'
import { ApiHandler, created, okPaginated } from '../shared/http'

// /api/appointments
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await appointmentService.list(req.query)
    return okPaginated(items, pagination)
  },
  POST: async (req) => created(await appointmentService.create(req.body)),
}).handle
