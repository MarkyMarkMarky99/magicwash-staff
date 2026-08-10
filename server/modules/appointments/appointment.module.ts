import { appointmentApiContract } from '../../../contracts/appointments/appointment-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { AppointmentService } from './appointment.service.js'
import { getAppointmentsRepository } from '../../sheets/Appointments/Appointments.repository.js'
import { createAppointmentTransformer } from './appointment.transformer.js'
import { appointmentsFieldMap } from './appointment.mapping.js'

export { appointmentsFieldMap } from './appointment.mapping.js'

// ── API behavior: BaseCrudService validates the request, builds the read query
//    (ReadQueryDTO.fromQuery with searchFields), calls the repository, and
//    projects each response by its schema shape. searchFields stays on real
//    queryable columns only — `address` is excluded on purpose because at query
//    time it is still the raw serialized snapshot JSON, so searching it would
//    match constant JSON keys (Phone/Line/Email/…) on every row. Customer-name
//    keyword search needs a real column. ──
export const appointmentService = new AppointmentService({
  repository: getAppointmentsRepository,
  fieldMap: appointmentsFieldMap,
  // Address is intentionally handled by the structural transformer rather
  // than jsonColumns: it packs on writes and fans one snapshot out to four
  // response fields, which a single JSON-column decode cannot express.
  transformer: createAppointmentTransformer(),
})

export const appointmentRoutes = createCrudRoutes(appointmentService, appointmentApiContract)
