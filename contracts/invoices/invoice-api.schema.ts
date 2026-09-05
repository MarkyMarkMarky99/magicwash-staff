import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

/** Invoices API contract for invoice reads, creation, and status-only updates. */

export const invoiceStatusSchema = z.enum([
  'DRAFT',
  'UNPAID',
  'OVERDUE',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'VOID',
])

export const invoiceBillingTypeSchema = z.enum(['ORDER', 'CYCLE', 'PACKAGE'])

/** ISO 8601 calendar date (YYYY-MM-DD), no time component. */
const invoiceReadIsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

// GViz cannot sort `customerName` inside the serialized `customer` cell.
export const invoiceSortFieldSchema = z.enum(['issuedDate', 'dueDate', 'status', 'grandTotal'])

export const MAX_INVOICES_PER_PAGE = 100

export const invoiceListQuerySchema = z.object({
  keyword: z.string().default(''),
  customerId: z.string().trim().min(1).nullable().optional().default(null),
  status: invoiceStatusSchema.nullable().optional().default(null),
  dateFrom: invoiceReadIsoDateSchema.nullable().optional().default(null),
  dateTo: invoiceReadIsoDateSchema.nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_INVOICES_PER_PAGE)
    .default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: invoiceSortFieldSchema.default('issuedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Adjustment order is significant; preserve it unchanged.

export const invoiceAdjustmentCalculationSchema = z.enum(['FIXED', 'PERCENT'])

export const invoiceAdjustmentInputSchema = z
  .object({
    label: z.string().trim().min(1),
    calculation: invoiceAdjustmentCalculationSchema,
    value: z.number().refine((value) => value !== 0, 'value must not be 0'),
    refSource: z.string().trim().min(1).optional(),
    refCode: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (adjustment) => (adjustment.refSource === undefined) === (adjustment.refCode === undefined),
    { message: 'refSource and refCode must both be present or both be omitted' },
  )

export type InvoiceAdjustmentInput = z.infer<typeof invoiceAdjustmentInputSchema>

export const invoiceCustomerSnapshotInputSchema = z
  .object({
    customerCode: z.string().trim().min(1),
    customerName: z.string().trim().min(1),
    phone: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
  })
  .strict()

export type InvoiceCustomerSnapshotInput = z.infer<typeof invoiceCustomerSnapshotInputSchema>

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

export const invoiceLineInputSchema = z
  .object({
    description: z.string().trim().min(1),
    unit: z.string().trim().min(1).optional(),
    quantity: z.number().positive(),
    unitPrice: z.number(),
    adjustments: z.array(invoiceAdjustmentInputSchema).default([]),
  })
  .strict()

export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>

const invoiceCreateFieldsSchema = z
  .object({
    invoiceNumber: z.string().trim().min(1),
    issuedDate: isoDateSchema,
    dueDate: isoDateSchema,
    customer: invoiceCustomerSnapshotInputSchema,
    adjustments: z.array(invoiceAdjustmentInputSchema).default([]),
    items: z.array(invoiceLineInputSchema).min(1),
  })
  .strict()

// Existing order callers remain valid without a billingType. Package purchases
// have no source order and must never enter the OrderForm linkage stage.
export const invoiceCreateSchema = z.union([
  invoiceCreateFieldsSchema.extend({
    billingType: z.literal('ORDER').optional(),
    sourceOrderId: z.string().trim().min(1),
  }),
  invoiceCreateFieldsSchema.extend({
    billingType: z.literal('PACKAGE'),
    sourceOrderId: z.null().optional(),
  }),
])

export type CreateInvoiceRequest = z.infer<typeof invoiceCreateSchema>

export const invoiceUpdatableStatusSchema = z.enum(['CANCELLED', 'VOID'])

export const invoiceStatusUpdateSchema = z
  .object({ status: invoiceUpdatableStatusSchema })
  .strict()

export type UpdateInvoiceRequest = z.infer<typeof invoiceStatusUpdateSchema>

export const invoiceCustomerSchema = z.object({
  customerCode: z.string().nullable(),
  customerName: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
})

export const invoiceAdjustmentSchema = z.object({
  label: z.string().nullable(),
  calculation: z.string().nullable(),
  value: z.number().nullable(),
  refSource: z.string().nullable(),
  refCode: z.string().nullable(),
})

export const invoiceItemSchema = z.object({
  description: z.string().nullable(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  subtotal: z.number().nullable(),
  adjustments: z.array(invoiceAdjustmentSchema),
  netTotal: z.number().nullable(),
})

export const invoicePaymentSchema = z.object({
  paymentId: z.string().nullable(),
  amount: z.number().nullable(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'QR_PROMPTPAY', 'GIFT_VOUCHER', 'OTHER']).nullable(),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'CANCELLED']),
  paidAt: z.string().nullable(),
  reference: z.string().nullable(),
  proofUrl: z.string().nullable(),
  notes: z.string().nullable(),
})

// Nested portal-sheet values are decoded by the shared GViz transport.
export const invoiceDetailResponseSchema = z.object({
  invoiceNumber: z.string(),
  status: invoiceStatusSchema,
  billingType: invoiceBillingTypeSchema,
  billingPeriodStart: z.string().nullable(),
  billingPeriodEnd: z.string().nullable(),
  issuedDate: z.string(),
  dueDate: z.string(),
  customerId: z.string(),
  customer: invoiceCustomerSchema,
  items: z.array(invoiceItemSchema),
  adjustments: z.array(invoiceAdjustmentSchema),
  payments: z.array(invoicePaymentSchema),
  subtotal: z.number(),
  adjustmentTotal: z.number(),
  grandTotal: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
})

export const invoiceListResponseSchema = invoiceDetailResponseSchema.pick({
  invoiceNumber: true,
  status: true,
  billingType: true,
  billingPeriodStart: true,
  billingPeriodEnd: true,
  issuedDate: true,
  dueDate: true,
  customerId: true,
  customer: true,
  adjustments: true,
  subtotal: true,
  adjustmentTotal: true,
  grandTotal: true,
  paidAmount: true,
  balanceDue: true,
})

// Keep write-stage outcomes distinct: retry safety depends on what may have persisted.

export const createInvoiceSuccessSchema = z.object({
  kind: z.literal('created'),
  invoiceNumber: z.string(),
  itemCount: z.number(),
  itemsTotal: z.number(),
  invoiceTotal: z.number(),
})

export const createInvoiceValidationErrorSchema = z.object({
  kind: z.literal('validation_error'),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
})

/** `rejected` means the stage definitively did not write; `unknown` may have written. */
export const invoiceWriteFailureCertaintySchema = z.enum(['rejected', 'unknown'])

export const createInvoiceItemsFailedSchema = z.object({
  kind: z.literal('items_write_failed'),
  message: z.string(),
  certainty: invoiceWriteFailureCertaintySchema,
})

export const createInvoiceHeaderFailedSchema = z.object({
  kind: z.literal('invoice_write_failed'),
  invoiceNumber: z.string(),
  itemCount: z.number(),
  certainty: invoiceWriteFailureCertaintySchema,
  // Items may already exist; never offer a plain retry.
})

export const createInvoiceOrderLinkFailedSchema = z.object({
  kind: z.literal('order_link_failed'),
  invoiceNumber: z.string(),
  sourceOrderId: z.string(),
  certainty: invoiceWriteFailureCertaintySchema,
  // The invoice already exists; never retry creation.
})

export const createInvoiceViewSyncFailedSchema = z.object({
  kind: z.literal('invoice_view_sync_failed'),
  invoiceNumber: z.string(),
  message: z.string(),
  certainty: invoiceWriteFailureCertaintySchema,
  // The invoice already exists; never retry creation.
})

export const createInvoiceResponseSchema = z.discriminatedUnion('kind', [
  createInvoiceSuccessSchema,
  createInvoiceValidationErrorSchema,
  createInvoiceItemsFailedSchema,
  createInvoiceHeaderFailedSchema,
  createInvoiceOrderLinkFailedSchema,
  createInvoiceViewSyncFailedSchema,
])

export type CreateInvoiceSuccess = z.infer<typeof createInvoiceSuccessSchema>
export type CreateInvoiceValidationError = z.infer<typeof createInvoiceValidationErrorSchema>
export type CreateInvoiceItemsFailed = z.infer<typeof createInvoiceItemsFailedSchema>
export type CreateInvoiceHeaderFailed = z.infer<typeof createInvoiceHeaderFailedSchema>
export type CreateInvoiceOrderLinkFailed = z.infer<typeof createInvoiceOrderLinkFailedSchema>
export type CreateInvoiceViewSyncFailed = z.infer<typeof createInvoiceViewSyncFailedSchema>
export type CreateInvoiceResponse = z.infer<typeof createInvoiceResponseSchema>

export const invoiceUpdateResponseSchema = z.object({
  invoiceNumber: z.string(),
  status: invoiceUpdatableStatusSchema,
  viewSynced: z.boolean(),
})

export type UpdateInvoiceResponse = z.infer<typeof invoiceUpdateResponseSchema>

// Duplicate-number checks are advisory; lookup failure must not block issuance.

export const invoiceNumberCheckResultSchema = z.object({
  invoiceNumber: z.string(),
  exists: z.boolean(),
})

export type InvoiceNumberCheckResult = z.infer<typeof invoiceNumberCheckResultSchema>

export const invoiceApiContract = {
  query: { list: invoiceListQuerySchema },
  request: {
    create: invoiceCreateSchema,
    update: invoiceStatusUpdateSchema,
  },
  response: {
    list: invoiceListResponseSchema,
    detail: invoiceDetailResponseSchema,
    create: createInvoiceSuccessSchema,
    update: invoiceUpdateResponseSchema,
  },
} satisfies ModuleApiContract
