import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema'

/**
 * The customers API ↔ frontend contract: request/query schemas, response
 * schemas, and the API-facing enums they share. Everything the client sends
 * or receives is declared here — the DB-side contract lives in
 * `customer-db.schema.ts` and never crosses the API boundary.
 */

// ── Domain value sets — the single source for the API-facing enums; the db
//    contract and the filters derive theirs from here. No z.infer type exports
//    in this file: types are inferred at the point of use instead. ──
export const customerTypeSchema = z.enum(['Member', 'Regular'])
export const customerSourceSchema = z.enum(['Facebook Ads', 'Google Ads'])
export const preferredContactMethodSchema = z.enum(['Line', 'Messenger'])

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a valid YYYY-MM-DD date')

// ── phone is an `integer` column in the sheet, so the honest API type is a
//    number. CAVEAT: Thai numbers carry a leading 0 (0812345678) that an
//    integer drops — that is a pre-existing storage decision, not something
//    this contract re-derives. ──
const phoneSchema = z.number().int()

// ── Create: client sends business fields only. The server fills the identity
//    and metadata columns it owns — timestamp, customerId, customerIndex,
//    updatedAt, deletedAt. There is no CreatedBy column in this sheet, so the
//    write actor rides on `updatedBy` (the sole actor column). ──
export const customerCreateSchema = z.object({
  customerName: z.string().min(1),
  phone: phoneSchema.nullish(),
  address: z.string().nullish(),
  location: z.string().nullish(),
  // Omit to let the server default it to "today"; supply to backdate.
  registeredDate: isoDateSchema.nullish(),
  facebook: z.string().nullish(),
  lineId: z.string().nullish(),
  whatsapp: z.string().nullish(),
  email: z.string().nullish(),
  customerType: customerTypeSchema.nullish(),
  source: customerSourceSchema.nullish(),
  scheduledDays: z.string().nullish(),
  lastVisitDate: isoDateSchema.nullish(),
  preferredContactMethod: preferredContactMethodSchema.nullish(),
  updatedBy: z.string().min(1),
})

// ── Update: every mutable field optional, updatedBy required, at least one
//    change. Identity/creation columns (customerId, customerIndex, timestamp)
//    are not mutable here. "At least one change" is derived from the data
//    itself — any defined field other than the updatedBy actor counts — so a
//    new mutable field is covered automatically, with no parallel list to keep
//    in sync with the schema shape. ──
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
    scheduledDays: z.string().nullable().optional(),
    lastVisitDate: isoDateSchema.nullable().optional(),
    preferredContactMethod: preferredContactMethodSchema.nullable().optional(),
    updatedBy: z.string().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

// ── List query: validates/coerces/defaults the raw URL params in one pass.
//    Its inferred output — the CustomerFilter the repository consumes — is
//    derived in customer.module.ts, keeping this file to schema declarations. ──
export const customerSortFieldSchema = z.enum([
  'customerId',
  'customerIndex',
  'customerName',
  'customerType',
  'registeredDate',
  'lastVisitDate',
  'updatedAt',
])

export const MAX_CUSTOMERS_PER_PAGE = 100

export const customerListQuerySchema = z.object({
  keyword: z.string().default(''),
  customerType: customerTypeSchema.nullable().optional().default(null),
  source: customerSourceSchema.nullable().optional().default(null),
  preferredContactMethod: preferredContactMethodSchema.nullable().optional().default(null),
  location: z.string().nullable().optional().default(null),
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

// ── Responses: the backend → frontend contract, following the invoices
//    list/detail split — list is the lightweight subset the list view needs,
//    detail is the full business record. Field names are the camelCase twins
//    of row columns and DRIVE the projection (key order = DTO key order);
//    the engine verifies at compile time that every field has a backing
//    column with an honest type. NOT runtime-validated on reads — legacy
//    sheet data is dirty by decision, so reads must not 500 on it.
//    Metadata/audit columns (timestamp, updatedAt, updatedBy, deletedAt) stay
//    behind the API boundary — in neither response. ──

export const customerListResponseSchema = z.object({
  customerId: z.string(),
  customerIndex: z.string(),
  customerName: z.string(),
  phone: z.number().nullable(),
  customerType: customerTypeSchema.nullable(),
  location: z.string().nullable(),
  lastVisitDate: z.string().nullable(),
})

export const customerDetailResponseSchema = customerListResponseSchema.extend({
  address: z.string().nullable(),
  registeredDate: z.string().nullable(),
  facebook: z.string().nullable(),
  lineId: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  source: customerSourceSchema.nullable(),
  scheduledDays: z.string().nullable(),
  preferredContactMethod: preferredContactMethodSchema.nullable(),
})

/** The bundle `createSheetService` consumes — one import for the whole API contract. */
export const customerApiSchemas = {
  listQuery: customerListQuerySchema,
  createRequest: customerCreateSchema,
  updateRequest: customerUpdateSchema,
  listResponse: customerListResponseSchema,
  detailResponse: customerDetailResponseSchema,
} as const
