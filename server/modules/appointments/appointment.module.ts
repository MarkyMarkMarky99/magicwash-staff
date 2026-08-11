import { appointmentApiContract } from '../../../contracts/appointments/appointment-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { AppointmentService } from './appointment.service.js'
import { getAppointmentsRepository } from '../../sheets/Appointments/Appointments.repository.js'
import { createAppointmentTransformer } from './appointment.transformer.js'
import { appointmentsFieldMap } from './appointment.mapping.js'

export { appointmentsFieldMap } from './appointment.mapping.js'

// `address` is excluded from keyword search because its serialized snapshot JSON
// would match constant keys instead of customer data.
export const appointmentService = new AppointmentService({
  repository: getAppointmentsRepository,
  fieldMap: appointmentsFieldMap,
  // Address is intentionally handled by the structural transformer rather
  // than jsonColumns: it packs on writes and fans one snapshot out to four
  // response fields, which a single JSON-column decode cannot express.
  transformer: createAppointmentTransformer(),
})

export const appointmentRoutes = createCrudRoutes(appointmentService, appointmentApiContract)
