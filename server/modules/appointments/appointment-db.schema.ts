import { z } from 'zod'
import {
  appointmentStatusSchema,
  appointmentTimeSlotSchema,
  appointmentTypeSchema,
  serviceTierSchema,
} from '../../../contracts/appointments/appointment-api.schema'

/**
 * The appointments API ↔ database contract (Google Sheets / Apps Script):
 * the full stored row plus one exact payload schema per write action. This
 * side of the boundary speaks sheet column keys (PascalCase) and must never
 * reach the frontend — the API-facing contract lives in
 * `appointment-api.schema.ts`.
 */

// ── Stored row ───────────────────────────────────────────────────────────────

/**
 * The full stored row: what reads return and what Apps Script must answer
 * writes with. The GViz column letters derive from the key order.
 *
 * ⚠️ KEY ORDER = PHYSICAL COLUMN ORDER IN THE SHEET (1st key = column A).
 * Reordering keys here re-points every GViz query at the wrong columns —
 * only append new keys at the end, matching the sheet.
 *
 * Column types describe what may sit in a stored cell — including legacy
 * rows — NOT what an action must send; that's the payload schemas' job below
 * (e.g. CreatedBy is nullable here because old rows lack it, yet required on
 * APPEND).
 */
export const appointmentRowSchema = z.object({
  AppointmentID: z.string(),
  CustomerID: z.string(),
  AppointmentType: appointmentTypeSchema,
  AppointmentDate: z.string(),
  TimeSlot: appointmentTimeSlotSchema,
  Status: appointmentStatusSchema,
  Address: z.string().nullable(),
  PickupOrderID: z.string().nullable(),
  DeliveryOrderID: z.string().nullable(),
  Notes: z.string().nullable(),
  CreatedAt: z.string().nullable(),
  UpdatedAt: z.string().nullable(),
  CreatedBy: z.string().nullable(),
  UpdatedBy: z.string().nullable(),
  ServiceTier: serviceTierSchema.nullable(),
})

// ── Write action payloads — declared per action, NOT derived from the row.
//    Each schema is the exact body sent to Apps Script (key order = payload
//    key order); columns it omits (AppointmentID, Status, CreatedAt,
//    UpdatedAt on APPEND) are the DB layer's to fill. ──

export const appointmentAppendPayloadSchema = z.object({
  CustomerID: z.string().min(1),
  AppointmentType: appointmentTypeSchema,
  AppointmentDate: z.string(),
  TimeSlot: appointmentTimeSlotSchema,
  Address: z.string().nullable(),
  PickupOrderID: z.string().nullable(),
  DeliveryOrderID: z.string().nullable(),
  Notes: z.string().nullable(),
  // Required on APPEND even though the stored cells are nullable (legacy rows).
  CreatedBy: z.string().min(1),
  ServiceTier: serviceTierSchema,
})

/** PATCH semantics: only the fields being changed are sent; the id travels separately. */
export const appointmentUpdatePayloadSchema = z.object({
  AppointmentType: appointmentTypeSchema.optional(),
  AppointmentDate: z.string().optional(),
  TimeSlot: appointmentTimeSlotSchema.optional(),
  Status: appointmentStatusSchema.optional(),
  Address: z.string().nullable().optional(),
  PickupOrderID: z.string().nullable().optional(),
  DeliveryOrderID: z.string().nullable().optional(),
  Notes: z.string().nullable().optional(),
  // Every update must carry its actor.
  UpdatedBy: z.string().min(1),
  ServiceTier: serviceTierSchema.optional(),
})

// ── DB column -> API field. Appointments already obeys the historical
//    PascalCase/`ID`-suffix convention, so every entry is its plain twin — but
//    it is declared explicitly all the same: the engine no longer guesses, and
//    `satisfies` makes a missing or stray column a compile error. ──
export const appointmentFieldMap = {
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
} as const satisfies Record<keyof z.infer<typeof appointmentRowSchema> & string, string>

/** The bundle both engine factories consume — one import for the whole DB contract. */
export const appointmentDbSchemas = {
  row: appointmentRowSchema,
  idColumn: 'AppointmentID',
  fieldMap: appointmentFieldMap,
  appendPayload: appointmentAppendPayloadSchema,
  updatePayload: appointmentUpdatePayloadSchema,
} as const
