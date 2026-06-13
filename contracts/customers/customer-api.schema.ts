import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema'

/**
 * The customers API ↔ frontend contract: request/query/response schemas and the
 * API-facing enums they share. The DB-side contract lives in
 * `customer-db.schema.ts` and never crosses this boundary.
 */

export const customerTypeSchema = z.enum(['Member', 'Regular', 'Corporate'])
export const customerSourceSchema = z.enum(['Facebook Ads', 'Google Ads'])
export const preferredContactMethodSchema = z.enum(['Line', 'Messenger'])

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a valid YYYY-MM-DD date')

// phone is an integer column; the honest API type is a number. Thai numbers
// lose their leading 0 (0812345678) — a pre-existing storage decision.
const phoneSchema = z.number().int()

// Create: client sends business fields only; the server owns the identity and
// metadata columns. There is no CreatedBy column, so the actor rides on updatedBy.
export const customerCreateSchema = z.object({
  customerName: z.string().min(1),
  phone: phoneSchema.nullish(),
  address: z.string().nullish(),
  location: z.string().nullish(),
  registeredDate: isoDateSchema.nullish(), // omit to default to today
  facebook: z.string().nullish(),
  lineId: z.string().nullish(),
  whatsapp: z.string().nullish(),
  email: z.string().nullish(),
  customerType: customerTypeSchema.nullish(),
  source: customerSourceSchema.nullish(),
  updatedBy: z.string().min(1),
})

// Update: PATCH — every mutable field optional, updatedBy required, at least one change.
export const customerUpdateSchema = z
  .object({
    customerName: z.string().min(1).optional(),
    phone: phoneSchema.nullable().optional(),
    address: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    registeredDate: isoDateSchema.nullable().optional(),
    facebook: z.string().nullable().optional(),
    lineId: z.string().nullable().optional(),
    whatsapp: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    customerType: customerTypeSchema.nullable().optional(),
    source: customerSourceSchema.nullable().optional(),
    updatedBy: z.string().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

// customerIndex is the default list order; registeredDate is the one alternate sort.
export const customerSortFieldSchema = z.enum(['customerIndex', 'registeredDate'])

export const MAX_CUSTOMERS_PER_PAGE = 100

export const customerListQuerySchema = z.object({
  // Free-text search across customerIndex / customerName / address (the
  // contains() clause in customer.module.ts); address replaces the dropped
  // dedicated location filter.
  keyword: z.string().default(''),
  customerType: customerTypeSchema.nullable().optional().default(null),
  // Soft-deleted rows (deletedAt set) are hidden unless explicitly included.
  includeDeleted: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_CUSTOMERS_PER_PAGE)
    .default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: customerSortFieldSchema.default('customerIndex'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

// Responses drive the projection (key order = DTO key order). list is the
// lightweight subset; detail adds contact + registration fields. source,
// scheduledDays, preferredContactMethod, lastVisitDate, and audit columns are
// withheld until a UI flow needs them.
export const customerListResponseSchema = z.object({
  customerId: z.string(),
  customerIndex: z.string(),
  customerName: z.string(),
  phone: z.number().nullable(),
  address: z.string().nullable(),
  location: z.string().nullable(),
  customerType: customerTypeSchema.nullable(),
})

export const customerDetailResponseSchema = customerListResponseSchema.extend({
  registeredDate: z.string().nullable(),
  facebook: z.string().nullable(),
  lineId: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
})

/** The bundle `createSheetService` consumes — one import for the whole API contract. */
export const customerApiSchemas = {
  listQuery: customerListQuerySchema,
  createRequest: customerCreateSchema,
  updateRequest: customerUpdateSchema,
  listResponse: customerListResponseSchema,
  detailResponse: customerDetailResponseSchema,
} as const
