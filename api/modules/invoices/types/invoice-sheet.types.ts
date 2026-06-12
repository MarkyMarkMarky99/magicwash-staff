import type {
  InvoiceItemUnit,
  PaymentMethod,
  PaymentStatus,
  PaymentSummaryStatus,
} from './invoice.schema'

export type { InvoiceFilter, InvoiceSortField } from './invoice.schema'

/**
 * The sheet shape for the invoices feature — both halves in one place:
 *   1. the "name" half — each row interface (the columns by field name), and
 *   2. the "letter" half — each `*_COLUMNS` map (the GViz column letter).
 *
 * Data lives in Google Sheets only (no SQL), so the DB *is* the sheet: column
 * layout and row shape are one concern, not two files. Query builders address
 * columns through the `*_COLUMNS` maps, never with bare letters. The
 * `satisfies Record<keyof Row, string>` on each map forces every field to have
 * exactly one letter and rejects drift when a row shape changes.
 *
 * Invoices are normalized across four sheets: Invoices, InvoiceItems,
 * PaymentSummary, Payments.
 *
 * NOTE: the letters below define the canonical column order. If the live sheets
 * differ, adjust the letters here to match — this map is the single source.
 */

// Column value sets mirror the same domain enums as the API contract.
export type InvoiceItemUnitRow = InvoiceItemUnit
export type PaymentMethodRow = PaymentMethod
export type PaymentStatusRow = PaymentStatus
export type PaymentSummaryStatusRow = PaymentSummaryStatus

// ── Invoices sheet ──────────────────────────────────────────────────
export interface InvoiceRow {
  id: string
  invoice_number: string
  customer_id: string
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  customer_tax_id: string | null
  period_start: string
  period_end: string
  issued_date: string
  due_date: string | null
  items_subtotal: number
  discount_amount: number
  surcharge_amount: number
  subtotal: number
  tax_amount: number
  wht_amount: number
  total_amount: number
  created_at: string
  created_by: string
  deleted_at: string | null
  deleted_by: string | null
}

export const INVOICE_COLUMNS = {
  id: 'A',
  invoice_number: 'B',
  customer_id: 'C',
  customer_name: 'D',
  customer_phone: 'E',
  customer_address: 'F',
  customer_tax_id: 'G',
  period_start: 'H',
  period_end: 'I',
  issued_date: 'J',
  due_date: 'K',
  items_subtotal: 'L',
  discount_amount: 'M',
  surcharge_amount: 'N',
  subtotal: 'O',
  tax_amount: 'P',
  wht_amount: 'Q',
  total_amount: 'R',
  created_at: 'S',
  created_by: 'T',
  deleted_at: 'U',
  deleted_by: 'V',
} as const satisfies Record<keyof InvoiceRow, string>

// ── InvoiceItems sheet ──────────────────────────────────────────────
export interface InvoiceItemRow {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit: InvoiceItemUnitRow
  unit_price: number
  line_total: number
}

export const INVOICE_ITEM_COLUMNS = {
  id: 'A',
  invoice_id: 'B',
  description: 'C',
  quantity: 'D',
  unit: 'E',
  unit_price: 'F',
  line_total: 'G',
} as const satisfies Record<keyof InvoiceItemRow, string>

// ── PaymentSummary sheet (one row per invoice — the payment rollup) ──
export interface PaymentSummaryRow {
  id: string
  invoice_id: string
  amount_due: number
  amount_paid: number
  balance: number
  status: PaymentSummaryStatusRow
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string
  deleted_at: string | null
  deleted_by: string | null
}

export const PAYMENT_SUMMARY_COLUMNS = {
  id: 'A',
  invoice_id: 'B',
  amount_due: 'C',
  amount_paid: 'D',
  balance: 'E',
  status: 'F',
  created_at: 'G',
  created_by: 'H',
  updated_at: 'I',
  updated_by: 'J',
  deleted_at: 'K',
  deleted_by: 'L',
} as const satisfies Record<keyof PaymentSummaryRow, string>

// ── Payments sheet (one row per payment transaction) ────────────────
export interface PaymentRow {
  id: string
  invoice_id: string
  amount: number | null
  method: PaymentMethodRow | null
  proof_url: string | null
  reference_no: string | null
  status: PaymentStatusRow
  api_log: Record<string, unknown> | null
  notes: string | null
  receipt_id: string | null
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string
}

export const PAYMENT_COLUMNS = {
  id: 'A',
  invoice_id: 'B',
  amount: 'C',
  method: 'D',
  proof_url: 'E',
  reference_no: 'F',
  status: 'G',
  api_log: 'H',
  notes: 'I',
  receipt_id: 'J',
  created_at: 'K',
  created_by: 'L',
  updated_at: 'M',
  updated_by: 'N',
} as const satisfies Record<keyof PaymentRow, string>

// ── Aggregate read shape: one invoice with its related rows (detail view) ─────
export interface InvoiceRecordRow {
  invoice: InvoiceRow
  items: InvoiceItemRow[]
  paymentSummary: PaymentSummaryRow | null
  payments: PaymentRow[]
}

// ── Lightweight read shape for the list: header + rollup only, no items/payments.
//    Lets the list read just two sheets and join in memory (no N+1). ───────────
export interface InvoiceListRecordRow {
  invoice: InvoiceRow
  paymentSummary: PaymentSummaryRow | null
}

// ── Write payloads sent to Apps Script (APPEND / UPDATE), per sheet ──
export type InvoiceCreatePayload = InvoiceRow
export type InvoiceUpdatePayload = Partial<InvoiceRow> & Pick<InvoiceRow, 'id'> // soft-delete

export type InvoiceItemCreatePayload = InvoiceItemRow

export type PaymentSummaryCreatePayload = PaymentSummaryRow
export type PaymentSummaryUpdatePayload = Partial<PaymentSummaryRow> & Pick<PaymentSummaryRow, 'id'>

export type PaymentCreatePayload = PaymentRow
export type PaymentUpdatePayload = Partial<PaymentRow> & Pick<PaymentRow, 'id'>

// ── Composite write shapes: one logical mutation fanned across sheets. Built by
//    the mapper, consumed by the repository (both import from types/, not each other). ──
export interface InvoiceCreateRecord {
  invoice: InvoiceCreatePayload
  items: InvoiceItemCreatePayload[]
  paymentSummary: PaymentSummaryCreatePayload
}

/** A new payment plus the restated rollup it produces. */
export interface PaymentWrite {
  payment: PaymentCreatePayload
  summary: PaymentSummaryUpdatePayload
}

/** A payment patch (e.g. verification) plus the restated rollup it produces. */
export interface PaymentUpdateWrite {
  payment: PaymentUpdatePayload
  summary: PaymentSummaryUpdatePayload
}
