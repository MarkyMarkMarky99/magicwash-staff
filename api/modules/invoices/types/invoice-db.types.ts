export type InvoiceItemUnitRow = 'PIECE' | 'KG' | 'PAIR' | 'SET'

export type PaymentMethodRow = 'CASH' | 'TRANSFER' | 'CREDIT_CARD' | 'CHEQUE' | 'OTHER'

export type PaymentSummaryStatusRow = 'UNPAID' | 'PARTIAL' | 'PAID'

export type PaymentStatusRow = 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW'

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

export interface InvoiceItemRow {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit: InvoiceItemUnitRow
  unit_price: number
  line_total: number
}

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

export interface InvoiceRecordRow {
  invoice: InvoiceRow
  items: InvoiceItemRow[]
  paymentSummary: PaymentSummaryRow | null
  payments: PaymentRow[]
}
