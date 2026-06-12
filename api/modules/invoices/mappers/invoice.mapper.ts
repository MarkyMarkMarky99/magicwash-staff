import type {
  InvoiceCreatePayload,
  InvoiceCreateRecord,
  InvoiceItemCreatePayload,
  InvoiceItemRow,
  InvoiceListRecordRow,
  InvoiceRecordRow,
  PaymentCreatePayload,
  PaymentRow,
  PaymentSummaryCreatePayload,
  PaymentSummaryRow,
  PaymentSummaryStatusRow,
  PaymentSummaryUpdatePayload,
  PaymentUpdatePayload,
} from '../types/invoice-sheet.types'
import type {
  InvoiceCreateRequestDto,
  PaymentCreateRequestDto,
  PaymentUpdateRequestDto,
} from '../types/invoice.schema'
import type {
  InvoiceDetailDto,
  InvoiceItemResponseDto,
  InvoiceListItemDto,
  InvoiceStatusDto,
  PaymentItemDto,
} from '../types/invoice-response.types'

/**
 * Read-side transforms: DB record shapes -> frontend-ready DTOs.
 *
 * The display `status` (incl. derived OVERDUE) is resolved here as a PURE function
 * of the row + `today` — the clock is injected by the caller (service), never read
 * inside the mapper, so the transform stays deterministic and testable.
 *
 * Write-side payload builders live with the service step (they need server-computed
 * totals, ids, and the customer snapshot).
 */

/**
 * Resolve the badge status. UNPAID/PARTIAL collapse to OVERDUE once the due date
 * has passed; PAID always wins. `today` is an ISO `YYYY-MM-DD` string (compares
 * correctly with `<`). A missing rollup is treated as fully unpaid.
 */
export function resolveInvoiceStatus(
  summary: PaymentSummaryRow | null,
  dueDate: string | null,
  today: string,
): InvoiceStatusDto {
  const status = summary?.status ?? 'UNPAID'
  if (status === 'PAID') {
    return 'PAID'
  }
  if (dueDate && dueDate < today) {
    return 'OVERDUE'
  }
  return status
}

/** List record (header + rollup) -> lightweight list DTO. */
export function toListItemDto(record: InvoiceListRecordRow, today: string): InvoiceListItemDto {
  const { invoice, paymentSummary } = record
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name,
    issuedDate: invoice.issued_date,
    dueDate: invoice.due_date,
    totalAmount: invoice.total_amount,
    amountPaid: paymentSummary?.amount_paid ?? 0,
    balance: paymentSummary?.balance ?? invoice.total_amount,
    status: resolveInvoiceStatus(paymentSummary, invoice.due_date, today),
  }
}

/** Full record (header + items + rollup + payments) -> detail DTO. */
export function toDetailDto(record: InvoiceRecordRow, today: string): InvoiceDetailDto {
  const { invoice, items, paymentSummary, payments } = record
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    customer: {
      id: invoice.customer_id,
      name: invoice.customer_name,
      phone: invoice.customer_phone,
      address: invoice.customer_address,
      taxId: invoice.customer_tax_id,
    },
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
    issuedDate: invoice.issued_date,
    dueDate: invoice.due_date,
    itemsSubtotal: invoice.items_subtotal,
    discountAmount: invoice.discount_amount,
    surchargeAmount: invoice.surcharge_amount,
    subtotal: invoice.subtotal,
    taxAmount: invoice.tax_amount,
    whtAmount: invoice.wht_amount,
    totalAmount: invoice.total_amount,
    amountPaid: paymentSummary?.amount_paid ?? 0,
    balance: paymentSummary?.balance ?? invoice.total_amount,
    status: resolveInvoiceStatus(paymentSummary, invoice.due_date, today),
    items: items.map(toItemDto),
    payments: payments.map(toPaymentDto),
  }
}

function toItemDto(row: InvoiceItemRow): InvoiceItemResponseDto {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
  }
}

function toPaymentDto(row: PaymentRow): PaymentItemDto {
  return {
    id: row.id,
    amount: row.amount,
    method: row.method,
    status: row.status,
    proofUrl: row.proof_url,
    referenceNo: row.reference_no,
    receiptId: row.receipt_id,
    paidAt: row.created_at,
  }
}

// ── Write-side: request DTO + server meta -> DB rows ──────────────────
//
// Server-generated values (ids, invoice number, timestamps) are injected via meta.
// Monetary totals are computed here as pure functions of the input (deterministic,
// no I/O) — this is the only place input numbers become stored row numbers.

/** Round to 2 decimals to keep money off binary-float drift. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Values the server generates when creating an invoice. */
export interface InvoiceCreateMeta {
  invoiceId: string
  invoiceNumber: string
  issuedDate: string // resolved: input.issuedDate ?? today
  createdAt: string // ISO timestamp
  itemIds: string[] // one id per input item, same order
  paymentSummaryId: string
}

/** Create request + server meta -> the full multi-sheet write for one invoice. */
export function toCreateRecord(
  input: InvoiceCreateRequestDto,
  meta: InvoiceCreateMeta,
): InvoiceCreateRecord {
  const items: InvoiceItemCreatePayload[] = input.items.map((item, index) => ({
    id: meta.itemIds[index],
    invoice_id: meta.invoiceId,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unitPrice,
    line_total: round2(item.quantity * item.unitPrice),
  }))

  const itemsSubtotal = round2(items.reduce((sum, item) => sum + item.line_total, 0))
  const subtotal = round2(itemsSubtotal - input.discountAmount + input.surchargeAmount)
  const totalAmount = round2(subtotal + input.taxAmount - input.whtAmount)

  const invoice: InvoiceCreatePayload = {
    id: meta.invoiceId,
    invoice_number: meta.invoiceNumber,
    customer_id: input.customerId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone ?? null,
    customer_address: input.customerAddress ?? null,
    customer_tax_id: input.customerTaxId ?? null,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    issued_date: meta.issuedDate,
    due_date: input.dueDate ?? null,
    items_subtotal: itemsSubtotal,
    discount_amount: input.discountAmount,
    surcharge_amount: input.surchargeAmount,
    subtotal,
    tax_amount: input.taxAmount,
    wht_amount: input.whtAmount,
    total_amount: totalAmount,
    created_at: meta.createdAt,
    created_by: input.createdBy,
    deleted_at: null,
    deleted_by: null,
  }

  const paymentSummary: PaymentSummaryCreatePayload = {
    id: meta.paymentSummaryId,
    invoice_id: meta.invoiceId,
    amount_due: totalAmount,
    amount_paid: 0,
    balance: totalAmount,
    status: 'UNPAID',
    created_at: meta.createdAt,
    created_by: input.createdBy,
    updated_at: meta.createdAt,
    updated_by: input.createdBy,
    deleted_at: null,
    deleted_by: null,
  }

  return { invoice, items, paymentSummary }
}

/** Values the server generates when recording a payment. */
export interface PaymentCreateMeta {
  paymentId: string
  createdAt: string
}

/** Payment request + meta -> a new Payment row. New payments start unverified. */
export function toPaymentCreateRow(
  invoiceId: string,
  input: PaymentCreateRequestDto,
  meta: PaymentCreateMeta,
): PaymentCreatePayload {
  return {
    id: meta.paymentId,
    invoice_id: invoiceId,
    amount: input.amount,
    method: input.method,
    proof_url: input.proofUrl ?? null,
    reference_no: input.referenceNo ?? null,
    status: 'PENDING',
    api_log: null,
    notes: input.notes ?? null,
    receipt_id: null,
    created_at: meta.createdAt,
    created_by: input.createdBy,
    updated_at: meta.createdAt,
    updated_by: input.createdBy,
  }
}

/**
 * Payment update DTO -> partial Payment row for UPDATE.
 * Only present fields are sent; `undefined` = leave untouched, `null` = clear.
 */
export function toPaymentUpdateRow(
  paymentId: string,
  input: PaymentUpdateRequestDto,
  updatedAt: string,
): PaymentUpdatePayload {
  const row: PaymentUpdatePayload = {
    id: paymentId,
    updated_at: updatedAt,
    updated_by: input.updatedBy,
  }

  if (input.amount !== undefined) row.amount = input.amount
  if (input.method !== undefined) row.method = input.method
  if (input.proofUrl !== undefined) row.proof_url = input.proofUrl
  if (input.referenceNo !== undefined) row.reference_no = input.referenceNo
  if (input.status !== undefined) row.status = input.status
  if (input.notes !== undefined) row.notes = input.notes
  if (input.receiptId !== undefined) row.receipt_id = input.receiptId

  return row
}

/** Rollup status from the recomputed figures. */
export function summaryStatusFromBalance(
  amountPaid: number,
  balance: number,
): PaymentSummaryStatusRow {
  if (balance <= 0) return 'PAID'
  if (amountPaid > 0) return 'PARTIAL'
  return 'UNPAID'
}

/** Values the server stamps when restating a rollup. */
export interface SummaryRecomputeMeta {
  updatedAt: string
  updatedBy: string
}

/**
 * Recompute the rollup over the effective payment set. Only VERIFIED payments
 * count toward amount_paid (PENDING/VERIFYING/FAILED don't move the balance).
 * `amount_due` is fixed at issue time, so balance = amount_due − amount_paid.
 */
export function toSummaryUpdate(
  current: PaymentSummaryRow,
  payments: Pick<PaymentRow, 'amount' | 'status'>[],
  meta: SummaryRecomputeMeta,
): PaymentSummaryUpdatePayload {
  const amountPaid = round2(
    payments
      .filter((payment) => payment.status === 'VERIFIED')
      .reduce((sum, payment) => sum + (payment.amount ?? 0), 0),
  )
  const balance = round2(current.amount_due - amountPaid)

  return {
    id: current.id,
    amount_paid: amountPaid,
    balance,
    status: summaryStatusFromBalance(amountPaid, balance),
    updated_at: meta.updatedAt,
    updated_by: meta.updatedBy,
  }
}
