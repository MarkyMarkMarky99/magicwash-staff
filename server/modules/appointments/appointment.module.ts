import { z } from 'zod'
import { appointmentApiContract } from '../../../contracts/appointments/appointment-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { AppointmentService } from './appointment.service.js'
import { getAppointmentsRepository } from '../../sheets/Appointments/Appointments.repository.js'
import { appointmentsRowSchema } from '../../sheets/Appointments/Appointments.db-contract.js'
import { createAppointmentTransformer } from './appointment.transformer.js'

type AppointmentsDbRow = z.infer<typeof appointmentsRowSchema>

/** DB column -> API/domain field. This is derived from the authoritative
 * 15-column sheet contract; the legacy DeletedAt/DeletedBy columns are not
 * part of this migrated module's map. */
export const appointmentsFieldMap = {
  AppointmentID: 'appointmentId',
  CustomerID: 'customerId',
  AppointmentType: 'appointmentType',
  AppointmentDate: 'appointmentDate',
  TimeSlot: 'timeSlot',
  Status: 'status',
  Address: 'address',
  PickupOrderID: 'pickupOrderId',
  DeliveryOrderID: 'deliveryOrderId',
  Notes: 'notes',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
  CreatedBy: 'createdBy',
  UpdatedBy: 'updatedBy',
  ServiceTier: 'serviceTier',
} as const satisfies Record<keyof AppointmentsDbRow & string, string>

// ── API behavior: BaseCrudService validates the request, builds the read query
//    (ReadQueryDTO.fromQuery with searchFields), calls the repository, and
//    projects each response by its schema shape. searchFields stays on real
//    queryable columns only — `address` is excluded on purpose because at query
//    time it is still the raw serialized snapshot JSON, so searching it would
//    match constant JSON keys (Phone/Line/Email/…) on every row. Customer-name
//    keyword search needs a real column and is out of scope. ──
export const appointmentService = new AppointmentService({
  repository: getAppointmentsRepository,
  fieldMap: appointmentsFieldMap,
  // Address is intentionally handled by the structural transformer rather
  // than jsonColumns: it packs on writes and fans one snapshot out to four
  // response fields, which a single JSON-column decode cannot express.
  transformer: createAppointmentTransformer(),
})

export const appointmentRoutes = createCrudRoutes(appointmentService, appointmentApiContract)
