import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

/**
 * Invoices READ contract (list + detail) — backs `InvoicesView`, not the
 * Invoice/InvoiceItem write tables in `invoice-api.schema.ts`.
 *
 * `customer` does NOT reuse `invoiceCustomerSnapshotInputSchema` — that
 * schema models what a CLIENT sends on create, where an absent phone/address
 * is an omitted (`undefined`) key. The read side is the opposite direction:
 * `invoice-view.transformer.ts`'s `parseCustomer()` always emits every key,
 * `null` when the sheet's `customerJson` doesn't have it. `invoiceViewCustomerSchema`
 * below models that shape instead — `.nullable()`, never `.optional()`.
 *
 * Likewise `adjustments` (both invoice- and item-level) and `payments` do NOT
 * reuse `invoiceAdjustmentInputSchema` from `invoice-api.schema.ts` — that
 * schema models the create-only write direction (enum `calculation`,
 * non-null `value`, optional `refSource`/`refCode`). The read side is
 * `invoice-view.transformer.ts`'s `mapAdjustment()`/`mapPayment()`, which
 * always emit every key and use `toNullableString`/`toNullableNumber` with no
 * enum enforcement, so `invoiceViewAdjustmentSchema` and
 * `invoiceViewPaymentSchema` model every field as `.nullable()` generic
 * `z.string()`/`z.number()` instead.
 *
 * ⚠ `invoiceViewPaymentSchema` is NOT grounded in a live example —
 * `InvoiceView.json`'s only example has an empty `paymentsJson`. Fields are
 * inferred from `Payment.json` translated to camelCase, minus `slip_data`
 * (marked "do not expose to customers" there) and audit fields. Flagged for
 * confirmation before this is relied on.
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

// sortBy excludes `customerName` (unlike the old frontend-only `InvoiceFilter`
// type) — it lives inside the serialized `customerJson` blob, which GViz
// cannot sort into.
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

/** Matches `InvoiceViewCustomer` in `invoice-view.transformer.ts` exactly —
 *  every key always present, `null` (not omitted) when the sheet's
 *  `customerJson` lacks it. */
export const invoiceViewCustomerSchema = z.object({
  customerCode: z.string().nullable(),
  customerName: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
})

/** Matches `InvoiceViewAdjustment` in `invoice-view.transformer.ts` exactly —
 *  every key always present, `null` (not omitted) and no enum enforcement,
 *  unlike the create-only `invoiceAdjustmentInputSchema`. */
export const invoiceViewAdjustmentSchema = z.object({
  label: z.string().nullable(),
  calculation: z.string().nullable(),
  value: z.number().nullable(),
  refSource: z.string().nullable(),
  refCode: z.string().nullable(),
})

/** Matches `InvoiceViewItem` in `invoice-view.transformer.ts` exactly — every
 *  field is `mapItem()`-produced via `toNullableString`/`toNullableNumber`,
 *  so a dirty row can legitimately leave any of them `null`. */
export const invoiceViewItemSchema = z.object({
  description: z.string().nullable(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  subtotal: z.number().nullable(),
  adjustments: z.array(invoiceViewAdjustmentSchema).default([]),
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

export const invoiceListResponseSchema = z.object({
  invoiceNumber: z.string(),
  status: invoiceViewStatusSchema,
  billingType: invoiceViewBillingTypeSchema,
  billingPeriodStart: z.string().nullable(),
  billingPeriodEnd: z.string().nullable(),
  issuedDate: z.string(),
  dueDate: z.string(),
  customerId: z.string(),
  customer: invoiceViewCustomerSchema,
  subtotal: z.number(),
  adjustmentTotal: z.number(),
  adjustments: z.array(invoiceViewAdjustmentSchema).default([]),
  grandTotal: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
})

export const invoiceDetailResponseSchema = invoiceListResponseSchema.extend({
  items: z.array(invoiceViewItemSchema).default([]),
  payments: z.array(invoiceViewPaymentSchema).default([]),
})

export const invoiceViewApiContract = {
  query: { list: invoiceListQuerySchema },
  response: {
    list: invoiceListResponseSchema,
    detail: invoiceDetailResponseSchema,
  },
} satisfies ModuleApiContract
