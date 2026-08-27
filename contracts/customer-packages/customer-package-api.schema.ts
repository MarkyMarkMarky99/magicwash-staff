import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const packageTransactionTypeSchema = z.enum(['PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRE', 'VOID', 'TRANSFER'])
export const packageCreditMovementTypeSchema = packageTransactionTypeSchema.exclude(['PURCHASE'])
export const packageWriteFailureCertaintySchema = z.enum(['rejected', 'unknown'])

export const appendPackageTransactionRequestSchema = z.object({
  customerPackageId: z.string().trim().min(1),
  type: packageCreditMovementTypeSchema,
  creditChange: z.number().finite().refine((value) => value !== 0, { message: 'creditChange must not be zero' }),
  referenceSource: z.string().trim().min(1).nullable().optional().default(null),
  referenceId: z.string().trim().min(1).nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
  createdBy: z.string().trim().min(1),
}).strict().refine((data) => data.type !== 'USAGE' || data.creditChange < 0, {
  message: 'USAGE creditChange must be negative', path: ['creditChange'],
}).refine((data) => data.type !== 'REFUND' || data.creditChange > 0, {
  message: 'REFUND creditChange must be positive', path: ['creditChange'],
})

export const appendPackageTransactionSuccessSchema = z.object({ kind: z.literal('created'), transactionId: z.string(), customerPackageId: z.string(), customerId: z.string(), type: packageCreditMovementTypeSchema, creditChange: z.number(), createdAt: z.string() })
export const appendPackageTransactionValidationErrorSchema = z.object({ kind: z.literal('validation_error'), issues: z.array(z.object({ path: z.string(), message: z.string() })) })
export const appendPackageTransactionPackageNotFoundSchema = z.object({ kind: z.literal('package_not_found'), customerPackageId: z.string() })
export const appendPackageTransactionLookupFailedSchema = z.object({ kind: z.literal('package_lookup_failed'), customerPackageId: z.string(), message: z.string() })
export const appendPackageTransactionWriteFailedSchema = z.object({ kind: z.literal('transaction_write_failed'), customerPackageId: z.string(), message: z.string(), certainty: packageWriteFailureCertaintySchema })
export const appendPackageTransactionResponseSchema = z.discriminatedUnion('kind', [appendPackageTransactionSuccessSchema, appendPackageTransactionValidationErrorSchema, appendPackageTransactionPackageNotFoundSchema, appendPackageTransactionLookupFailedSchema, appendPackageTransactionWriteFailedSchema])

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
export const customerPackageServiceDaySchema = z.enum(['SUN', 'MON', 'WED', 'THU', 'FRI', 'SAT'])
export const customerPackageTimeSlotSchema = z.enum(['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00'])
export const createCustomerPackageRequestSchema = z.object({
  customerId: z.string().trim().min(1), packageCode: z.string().trim().min(1), invoiceId: z.string().trim().min(1).nullable().optional().default(null), startDate: isoDateSchema.nullable().optional().default(null), expiryDate: isoDateSchema.nullable().optional().default(null), serviceDay: customerPackageServiceDaySchema.nullable().optional().default(null), timeSlot: customerPackageTimeSlotSchema.nullable().optional().default(null), notes: z.string().nullable().optional().default(null), createdBy: z.string().trim().min(1),
}).strict()
export const createCustomerPackageSuccessSchema = z.object({ kind: z.literal('created'), customerPackageId: z.string(), customerId: z.string(), packageCode: z.string(), openingCredit: z.number(), transactionId: z.string(), createdAt: z.string() })
export const createCustomerPackageValidationErrorSchema = z.object({ kind: z.literal('validation_error'), issues: z.array(z.object({ path: z.string(), message: z.string() })) })
export const createCustomerPackageCatalogReadFailedSchema = z.object({ kind: z.literal('catalog_read_failed'), packageCode: z.string(), message: z.string() })
export const createCustomerPackageOpeningTransactionFailedSchema = z.object({ kind: z.literal('opening_transaction_write_failed'), customerPackageId: z.string(), message: z.string(), certainty: packageWriteFailureCertaintySchema })
export const createCustomerPackagePackageWriteFailedSchema = z.object({ kind: z.literal('package_write_failed'), customerPackageId: z.string(), transactionId: z.string(), openingCredit: z.number(), message: z.string(), certainty: packageWriteFailureCertaintySchema })
export const createCustomerPackageResponseSchema = z.discriminatedUnion('kind', [createCustomerPackageSuccessSchema, createCustomerPackageValidationErrorSchema, createCustomerPackageCatalogReadFailedSchema, createCustomerPackageOpeningTransactionFailedSchema, createCustomerPackagePackageWriteFailedSchema])

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

export const customerPackageApiContract = {
  query: { list: customerPackageListQuerySchema },
  response: {
    list: customerPackageListResponseSchema,
    detail: customerPackageDetailResponseSchema,
  },
} satisfies ModuleApiContract
