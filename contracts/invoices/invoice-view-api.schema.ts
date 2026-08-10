import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

/**
 * Invoices READ contract (list + detail) — backs `InvoicesView`, not the
 * Invoice/InvoiceItem write tables in `invoice-api.schema.ts`.
 *
 * `customer` does NOT reuse `invoiceCustomerSnapshotInputSchema` — that
 * schema models what a CLIENT sends on create, where an absent phone/address
 * is an omitted (`undefined`) key. This portal read model instead has one
 * shared schema used directly by the sheet, backend, and frontend.
 *
 * Likewise `adjustments` (both invoice- and item-level) and `payments` do NOT
 * reuse `invoiceAdjustmentInputSchema` from `invoice-api.schema.ts` — that
 * schema models the create-only write direction (enum `calculation`,
 * non-null `value`, optional `refSource`/`refCode`). The portal has its own
 * response shapes because it is preprocessed specifically for display.
 *
 * ⚠ `invoiceViewPaymentSchema` is NOT grounded in a live example —
 * `InvoiceView.json`'s only example has an empty payments array. Fields are
 * inferred from `Payment.json` translated to camelCase, minus `slip_data`
 * (marked "do not expose to customers" there) and audit fields.
 */

export const invoiceViewStatusSchema = z.enum([
  'DRAFT',
  'UNPAID',
  'OVERDUE',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'VOID',
])

export const invoiceViewBillingTypeSchema = z.enum(['ORDER', 'CYCLE'])

/** ISO 8601 calendar date (YYYY-MM-DD), no time component. */
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

// sortBy excludes `customerName` — it lives inside the serialized `customer`
// cell, which GViz cannot sort into.
export const invoiceViewSortFieldSchema = z.enum(['issuedDate', 'dueDate', 'status', 'grandTotal'])

export const MAX_INVOICES_PER_PAGE = 100

export const invoiceListQuerySchema = z.object({
  keyword: z.string().default(''),
  customerId: z.string().trim().min(1).nullable().optional().default(null),
  status: invoiceViewStatusSchema.nullable().optional().default(null),
  dateFrom: isoDateSchema.nullable().optional().default(null),
  dateTo: isoDateSchema.nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_INVOICES_PER_PAGE)
    .default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: invoiceViewSortFieldSchema.default('issuedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const invoiceViewCustomerSchema = z.object({
  customerCode: z.string().nullable(),
  customerName: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
})

export const invoiceViewAdjustmentSchema = z.object({
  label: z.string().nullable(),
  calculation: z.string().nullable(),
  value: z.number().nullable(),
  refSource: z.string().nullable(),
  refCode: z.string().nullable(),
})

export const invoiceViewItemSchema = z.object({
  description: z.string().nullable(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  subtotal: z.number().nullable(),
  adjustments: z.array(invoiceViewAdjustmentSchema),
  netTotal: z.number().nullable(),
})

export const invoiceViewPaymentSchema = z.object({
  paymentId: z.string().nullable(),
  amount: z.number().nullable(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'QR_PROMPTPAY', 'GIFT_VOUCHER', 'OTHER']).nullable(),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'CANCELLED']),
  paidAt: z.string().nullable(),
  reference: z.string().nullable(),
  proofUrl: z.string().nullable(),
  notes: z.string().nullable(),
})

/**
 * The Portal Sheet's headers and their order. Nested values are JSON text in
 * cells and decoded generically by the GViz transport; no module transformer
 * normalizes or repairs them after reading.
 */
export const invoicePortalRowSchema = z.object({
  invoiceNumber: z.string(),
  status: invoiceViewStatusSchema,
  billingType: invoiceViewBillingTypeSchema,
  billingPeriodStart: z.string().nullable(),
  billingPeriodEnd: z.string().nullable(),
  issuedDate: z.string(),
  dueDate: z.string(),
  customerId: z.string(),
  customer: invoiceViewCustomerSchema,
  items: z.array(invoiceViewItemSchema),
  adjustments: z.array(invoiceViewAdjustmentSchema),
  payments: z.array(invoiceViewPaymentSchema),
  subtotal: z.number(),
  adjustmentTotal: z.number(),
  grandTotal: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
})

export const invoiceListResponseSchema = invoicePortalRowSchema.pick({
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

export const invoiceDetailResponseSchema = invoicePortalRowSchema

export const invoiceViewApiContract = {
  query: { list: invoiceListQuerySchema },
  response: {
    list: invoiceListResponseSchema,
    detail: invoiceDetailResponseSchema,
  },
} satisfies ModuleApiContract
