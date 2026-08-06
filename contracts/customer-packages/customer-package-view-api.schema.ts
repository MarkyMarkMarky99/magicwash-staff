import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

/**
 * Customer packages READ contract, backing the `CustomerPackageView` portal sheet.
 *
 * Field semantics are documented once, in the schema registry:
 *   G:\My Drive\Magicwash\Database\GoogleSheets\CustomerPackageView.json
 * Read it there rather than restating it here. Comments below cover only
 * mechanics of this codebase that the registry cannot describe.
 */

export const customerPackageStatusSchema = z.enum([
  'INACTIVE',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
])

export const packageTransactionTypeSchema = z.enum([
  'PURCHASE',
  'USAGE',
  'REFUND',
  'ADJUSTMENT',
  'EXPIRE',
  'VOID',
  'TRANSFER',
])

export const packageTransactionSchema = z.object({
  id: z.string(),
  type: packageTransactionTypeSchema,
  creditChange: z.number(),
  remainingCredit: z.number(),
  referenceSource: z.string().nullable(),
  referenceId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

/**
 * Key order is load-bearing: GViz binds columns by position, so this must list
 * all 19 sheet columns in sheet order. `transactionsJson` is decoded before the
 * row reaches this schema, hence `transactions` as an array.
 */
export const customerPackagePortalRowSchema = z.object({
  customerPackageId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  customerAddress: z.string().nullable(),
  packageCode: z.string(),
  packageName: z.string(),
  packageEligibleService: z.string(),
  startDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  status: customerPackageStatusSchema,
  serviceDay: z.string().nullable(),
  timeSlot: z.string().nullable(),
  invoiceId: z.string().nullable(),
  notes: z.string().nullable(),
  remainingCredit: z.number(),
  usedCredit: z.number(),
  totalCredit: z.number(),
  transactions: z.array(packageTransactionSchema),
})

export const customerPackageListResponseSchema = customerPackagePortalRowSchema.omit({
  transactions: true,
})

export const customerPackageDetailResponseSchema = customerPackagePortalRowSchema

/** Flat columns only — GViz cannot sort inside the serialized ledger cell. */
export const customerPackageSortFieldSchema = z.enum([
  'customerPackageId',
  'startDate',
  'expiryDate',
  'status',
  'remainingCredit',
])

export const MAX_CUSTOMER_PACKAGES_PER_PAGE = 100

/**
 * Every non-reserved key becomes an equality filter on the column of the same
 * name, so each must be a real flat column. `sortBy`/`sortOrder` must keep their
 * defaults — the query builder always emits `order by` and throws without one.
 */
export const customerPackageListQuerySchema = z.object({
  keyword: z.string().default(''),
  customerId: z.string().trim().min(1).nullable().optional().default(null),
  status: customerPackageStatusSchema.nullable().optional().default(null),
  packageCode: z.string().trim().min(1).nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_CUSTOMER_PACKAGES_PER_PAGE)
    .default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: customerPackageSortFieldSchema.default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * Create a package for a customer. The server owns the id, the timestamps and
 * the opening credit — the last of those comes from the package catalog.
 */
export const customerPackageCreateSchema = z.object({
  customerId: z.string().trim().min(1),
  packageCode: z.string().trim().min(1),
  invoiceId: z.string().trim().min(1).nullable().optional().default(null),
  startDate: z.string().nullable().optional().default(null),
  expiryDate: z.string().nullable().optional().default(null),
  serviceDay: z.string().nullable().optional().default(null),
  timeSlot: z.string().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
})

/** Every credit movement except the opening one, which only `create` may write. */
export const packageCreditMovementTypeSchema = packageTransactionTypeSchema.exclude([
  'PURCHASE',
])

/**
 * Changes to an existing package, keyed by what happened rather than by which
 * fields move. Where each intent lands is the service's business.
 */
export const customerPackageUpdateSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('reschedule'),
    startDate: z.string().nullable().optional(),
    expiryDate: z.string().nullable().optional(),
    serviceDay: z.string().nullable().optional(),
    timeSlot: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  z.object({
    intent: z.literal('cancel'),
    notes: z.string().nullable().optional(),
  }),
  z.object({
    intent: z.literal('recordCredit'),
    type: packageCreditMovementTypeSchema,
    /** Signed. Spending past the package is allowed; the overage is billed. */
    creditChange: z.number(),
    referenceSource: z.string().trim().min(1).nullable().optional().default(null),
    referenceId: z.string().trim().min(1).nullable().optional().default(null),
    notes: z.string().nullable().optional().default(null),
  }),
])

/** Writes answer with the whole document, so a client can replace its copy. */
export const customerPackageCreateResponseSchema = customerPackageDetailResponseSchema
export const customerPackageUpdateResponseSchema = customerPackageDetailResponseSchema

export const customerPackageViewApiContract = {
  query: { list: customerPackageListQuerySchema },
  request: {
    create: customerPackageCreateSchema,
    update: customerPackageUpdateSchema,
  },
  response: {
    list: customerPackageListResponseSchema,
    detail: customerPackageDetailResponseSchema,
    create: customerPackageCreateResponseSchema,
    update: customerPackageUpdateResponseSchema,
  },
} satisfies ModuleApiContract
