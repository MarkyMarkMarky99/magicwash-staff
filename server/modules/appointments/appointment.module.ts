import { appointmentContract } from './appointment.contract.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getAppointmentRepository } from './appointment.repository.js'
import { AppointmentService } from './appointment.service.js'

// ── API behavior: BaseCrudService validates the request, builds the read query
//    (ReadQueryDTO.fromQuery with searchFields), calls the repository, and
//    projects each response by its schema shape. searchFields stays on real
//    queryable columns only — `address` is excluded on purpose because at query
//    time it is still the raw serialized snapshot JSON, so searching it would
//    match constant JSON keys (Phone/Line/Email/…) on every row. Customer-name
//    keyword search needs a real column and is out of scope. ──
export const appointmentService = new AppointmentService({
  repository: getAppointmentRepository(),
})

export const appointmentRoutes = createCrudRoutes(appointmentService, appointmentContract.api)
