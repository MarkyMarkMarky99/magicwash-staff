import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../../../shared/types/api-request.types'

/**
 * The appointments API ↔ frontend contract: request/query schemas, response
 * schemas, and the API-facing enums they share. Everything the client sends
 * or receives is declared here — the DB-side contract lives in
 * `appointment-db.schema.ts` and never crosses the API boundary.
 */

// ── Domain value sets — the single source for the API-facing enums; the db
//    contract and the filter derive theirs from here. No z.infer type exports
//    in this file: types are inferred at the point of use instead. ──
export const appointmentTypeSchema = z.enum(['PICKUP', 'DELIVERY', 'PICKUP_DELIVERY'])
export const appointmentTimeSlotSchema = z.enum([
  '10:00-12:00',
  '13:00-15:00',
  '15:00-17:00',
  '18:00-20:00',
])
export const appointmentStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
])
export const serviceTierSchema = z.enum(['PRIORITY', 'STANDARD', 'ECONOMY'])

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a valid YYYY-MM-DD date')

// ── Create: client sends business fields only; createdBy comes from the frontend ──
export const appointmentCreateSchema = z.object({
  customerId: z.string().min(1),
  appointmentType: appointmentTypeSchema,
  appointmentDate: isoDateSchema,
  timeSlot: appointmentTimeSlotSchema,
  serviceTier: serviceTierSchema,
  address: z.string().nullish(),
  pickupOrderId: z.string().nullish(),
  deliveryOrderId: z.string().nullish(),
  notes: z.string().nullish(),
  createdBy: z.string().min(1),
})

// ── Update: every mutable field optional, updatedBy required, at least one change.
//    "At least one change" is derived from the data itself — any defined field other
//    than the updatedBy actor counts — so a new mutable field is covered automatically,
//    with no parallel list to keep in sync with the schema shape. ──
export const appointmentUpdateSchema = z
  .object({
    appointmentType: appointmentTypeSchema.optional(),
    appointmentDate: isoDateSchema.optional(),
    timeSlot: appointmentTimeSlotSchema.optional(),
    status: appointmentStatusSchema.optional(),
    address: z.string().nullable().optional(),
    pickupOrderId: z.string().nullable().optional(),
    deliveryOrderId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    serviceTier: serviceTierSchema.optional(),
    updatedBy: z.string().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

// ── List query: validates/coerces/defaults the raw URL params in one pass.
//    Its inferred output — the AppointmentFilter the repository consumes — is
//    derived in appointment.module.ts, keeping this file to schema declarations. ──
export const appointmentSortFieldSchema = z.enum([
  'appointmentId',
  'customerId',
  'appointmentDate',
  'timeSlot',
  'status',
  'appointmentType',
  'serviceTier',
  'createdAt',
  'updatedAt',
])

export const MAX_APPOINTMENTS_PER_PAGE = 100

export const appointmentListQuerySchema = z
  .object({
    keyword: z.string().default(''),
    customerId: z.string().nullable().optional().default(null),
    orderId: z.string().nullable().optional().default(null),
    status: appointmentStatusSchema.nullable().optional().default(null),
    appointmentType: appointmentTypeSchema.nullable().optional().default(null),
    timeSlot: appointmentTimeSlotSchema.nullable().optional().default(null),
    serviceTier: serviceTierSchema.nullable().optional().default(null),
    dateFrom: isoDateSchema.nullable().optional().default(null),
    dateTo: isoDateSchema.nullable().optional().default(null),
    includePending: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
    perPage: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_APPOINTMENTS_PER_PAGE)
      .default(API_PAGINATION_DEFAULTS.perPage),
    sortBy: appointmentSortFieldSchema.default('appointmentDate'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  // ISO dates compare correctly as strings.
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: 'dateFrom must be before or equal to dateTo',
    path: ['dateFrom'],
  })

// ── Responses: the backend → frontend contract, following the invoices
//    list/detail split — list is the lightweight subset the list view needs,
//    detail is the full business record. Field names are the camelCase twins
//    of row columns and DRIVE the projection (key order = DTO key order);
//    the engine verifies at compile time that every field has a backing
//    column with an honest type. NOT runtime-validated on reads — legacy
//    sheet data is dirty by decision, so reads must not 500 on it.
//    Audit fields (createdAt/updatedAt/createdBy/updatedBy) stay behind the
//    API boundary — in neither response. ──

export const appointmentListResponseSchema = z.object({
  appointmentId: z.string(),
  customerId: z.string(),
  appointmentType: appointmentTypeSchema,
  appointmentDate: z.string(),
  timeSlot: appointmentTimeSlotSchema,
  status: appointmentStatusSchema,
  serviceTier: serviceTierSchema.nullable(),
})

export const appointmentDetailResponseSchema = appointmentListResponseSchema.extend({
  address: z.string().nullable(),
  pickupOrderId: z.string().nullable(),
  deliveryOrderId: z.string().nullable(),
  notes: z.string().nullable(),
})

/** The bundle `createSheetService` consumes — one import for the whole API contract. */
export const appointmentApiSchemas = {
  listQuery: appointmentListQuerySchema,
  createRequest: appointmentCreateSchema,
  updateRequest: appointmentUpdateSchema,
  listResponse: appointmentListResponseSchema,
  detailResponse: appointmentDetailResponseSchema,
} as const
