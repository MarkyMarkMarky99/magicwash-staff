import type { z } from 'zod'
import { appointmentsRowSchema } from '../../sheets/Appointments/Appointments.db-contract.js'

type AppointmentsDbRow = z.infer<typeof appointmentsRowSchema>

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
  DeletedAt: 'deletedAt',
  DeletedBy: 'deletedBy',
} as const satisfies Record<keyof AppointmentsDbRow & string, string>
