import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../../../shared/types/api-request.types'

// ── Domain value sets — the single source for runtime validation (the schemas)
//    and types (their z.infer). Sheet rows, response DTOs, and filters all derive
//    their enums from here; never hand-write a mirroring union elsewhere. ──
export const invoiceItemUnitSchema = z.enum(['PIECE', 'KG', 'PAIR', 'SET'])
export const paymentMethodSchema = z.enum(['CASH', 'TRANSFER', 'CREDIT_CARD', 'CHEQUE', 'OTHER'])

/** Payment rollup status stored on the PaymentSummary row. */
export const paymentSummaryStatusSchema = z.enum(['UNPAID', 'PARTIAL', 'PAID'])

/** Verification state of a single payment transaction. */
export const paymentStatusSchema = z.enum([
  'PENDING',
  'VERIFYING',
  'VERIFIED',
  'FAILED',
  'MANUAL_REVIEW',
])

/** Display status the API resolves for an invoice — the summary status, but
 *  UNPAID/PARTIAL collapse to OVERDUE once past the due date. Drives the badge. */
export const invoiceStatusSchema = z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'])

export type InvoiceItemUnit = z.infer<typeof invoiceItemUnitSchema>
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type PaymentSummaryStatus = z.infer<typeof paymentSummaryStatusSchema>
export type PaymentStatus = z.infer<typeof paymentStatusSchema>
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>

// ── Shared field schemas ──
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a valid YYYY-MM-DD date')
const moneySchema = z.number().nonnegative()
const quantitySchema = z.number().positive()

// ── Line item input: the client supplies the facts; the service computes
//    lineTotal (quantity × unitPrice) and the invoice subtotals/totals. ──
export const invoiceItemInputSchema = z.object({
  description: z.string().min(1),
  quantity: quantitySchema,
  unit: invoiceItemUnitSchema,
  unitPrice: moneySchema,
})

// ── Create: client sends business facts only. The service assigns id/invoiceNumber,
//    snapshots customer info from customerId, computes itemsSubtotal/subtotal/
//    totalAmount, seeds the PaymentSummary, and sets status + timestamps. ──
export const invoiceCreateSchema = z
  .object({
    customerId: z.string().min(1),
    // Customer snapshot — the client supplies it alongside customerId; the service
    // freezes it onto the invoice row (the tax document must stay stable over time).
    customerName: z.string().min(1),
    customerPhone: z.string().nullish(),
    customerAddress: z.string().nullish(),
    customerTaxId: z.string().nullish(),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    issuedDate: isoDateSchema.optional(), // defaults to today server-side
    dueDate: isoDateSchema.nullish(),
    items: z.array(invoiceItemInputSchema).min(1),
    discountAmount: moneySchema.default(0),
    surchargeAmount: moneySchema.default(0),
    taxAmount: moneySchema.default(0),
    whtAmount: moneySchema.default(0),
    createdBy: z.string().min(1),
  })
  .refine((inv) => inv.periodStart <= inv.periodEnd, {
    message: 'periodStart must be before or equal to periodEnd',
    path: ['periodStart'],
  })

// ── Record a payment against an invoice (invoiceId comes from the route param).
//    The service appends the Payment row and recomputes the PaymentSummary. ──
export const paymentCreateSchema = z.object({
  amount: moneySchema,
  method: paymentMethodSchema,
  proofUrl: z.string().url().nullish(),
  referenceNo: z.string().nullish(),
  notes: z.string().nullish(),
  createdBy: z.string().min(1),
})

// ── Update a payment — verification flow (e.g. PENDING → VERIFIED) or correction.
//    Recomputing the PaymentSummary is the service's job. "At least one change" is
//    derived from the data — any defined field other than the updatedBy actor counts —
//    so a new mutable field is covered automatically, no parallel list to keep in sync. ──
export const paymentUpdateSchema = z
  .object({
    amount: moneySchema.optional(),
    method: paymentMethodSchema.optional(),
    proofUrl: z.string().url().nullable().optional(),
    referenceNo: z.string().nullable().optional(),
    status: paymentStatusSchema.optional(),
    notes: z.string().nullable().optional(),
    receiptId: z.string().nullable().optional(),
    updatedBy: z.string().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

// Note: the InvoiceRow has no updated_at/updated_by columns — issued invoices are
// immutable tax documents. Mutations live on the payment side (record/verify) and
// soft-delete (deleted_at/by). No invoice-header update schema by design.

// ── Request DTOs derived from the schemas (no hand-written interfaces) ──
export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>
export type InvoiceCreateRequestDto = z.infer<typeof invoiceCreateSchema>
export type PaymentCreateRequestDto = z.infer<typeof paymentCreateSchema>
export type PaymentUpdateRequestDto = z.infer<typeof paymentUpdateSchema>

// ── List query: validates/coerces/defaults the raw URL params in one pass;
//    its output type (InvoiceFilter) is what the repository consumes. ──
// Sort fields must be real columns on the Invoices sheet — `status` is excluded
// because it lives on PaymentSummary (and OVERDUE is derived), not the invoice row.
export const invoiceSortFieldSchema = z.enum([
  'invoiceNumber',
  'customerId',
  'customerName',
  'issuedDate',
  'dueDate',
  'totalAmount',
  'createdAt',
])
export type InvoiceSortField = z.infer<typeof invoiceSortFieldSchema>

export const MAX_INVOICES_PER_PAGE = 100

export const invoiceListQuerySchema = z
  .object({
    keyword: z.string().default(''),
    customerId: z.string().nullable().optional().default(null),
    // `status` (incl. derived OVERDUE) is NOT a column on the Invoices sheet, so it
    // can't be GViz-filtered — the service applies it in memory after the rollup join.
    status: invoiceStatusSchema.nullable().optional().default(null),
    // issuedDate range
    dateFrom: isoDateSchema.nullable().optional().default(null),
    dateTo: isoDateSchema.nullable().optional().default(null),
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
  // ISO dates compare correctly as strings.
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: 'dateFrom must be before or equal to dateTo',
    path: ['dateFrom'],
  })

export type InvoiceFilter = z.infer<typeof invoiceListQuerySchema>
