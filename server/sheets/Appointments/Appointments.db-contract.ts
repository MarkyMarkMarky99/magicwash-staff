import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const appointmentTypeSchema = z.enum(['PICKUP', 'DELIVERY', 'PICKUP_DELIVERY'])
const appointmentTimeSlotSchema = z.enum(['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00'])
const appointmentStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
])
const serviceTierSchema = z.enum(['PRIORITY', 'STANDARD', 'ECONOMY'])

/** KEY ORDER = physical Appointments sheet column order. */
export const appointmentsRowSchema = z.object({
  AppointmentID: z.string(),
  CustomerID: z.string(),
  AppointmentType: appointmentTypeSchema,
  AppointmentDate: z.string(),
  TimeSlot: appointmentTimeSlotSchema,
  Status: appointmentStatusSchema,
  // JSON customer snapshot string. The module transformer parses it later.
  Address: z.string().nullable(),
  PickupOrderID: z.string().nullable(),
  DeliveryOrderID: z.string().nullable(),
  Notes: z.string().nullable(),
  CreatedAt: z.string(),
  UpdatedAt: z.string().nullable(),
  CreatedBy: z.string().nullable(),
  UpdatedBy: z.string().nullable(),
  ServiceTier: serviceTierSchema.nullable(),
  DeletedAt: z.string().nullable(),
  DeletedBy: z.string().nullable(),
})

export const appointmentsDbContract = {
  row: appointmentsRowSchema,
  primaryKey: 'AppointmentID',
  sheetName: 'Appointments',
  spreadsheetId: 'APPOINTMENTS_SPREADSHEET_ID',
  // Appointment.json documents AppointmentDate as a real Sheets date so GViz localization and date-range queries work.
  valueInput: { AppointmentDate: 'USER_ENTERED' },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
