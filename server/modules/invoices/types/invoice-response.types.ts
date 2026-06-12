import type {
  InvoiceItemUnit,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentSummaryStatus,
} from './invoice.schema'

/**
 * Response contract for the invoices feature.
 *
 * These are the frontend-ready DTOs the API exposes — camelCase, business facts
 * resolved server-side (status, totals, balance), and NO DB/internal shape:
 * audit fields (`*By`, `updatedAt`, `deletedAt/By`) and the payment gateway
 * `apiLog` stay behind the API boundary. Presentation concerns (labels, tones)
 * are added by the frontend mapper, not here.
 */

// --- Enum contract (camelCase mirror of the DB enums) ---

export type InvoiceItemUnitDto = InvoiceItemUnit

export type PaymentMethodDto = PaymentMethod

export type PaymentStatusDto = PaymentStatus

export type PaymentSummaryStatusDto = PaymentSummaryStatus

/** Display status that drives the invoice badge. Superset of the payment summary
 *  status — replaces UNPAID/PARTIAL with OVERDUE once past the due date. */
export type InvoiceStatusDto = InvoiceStatus

// --- Nested shapes ---

export interface InvoiceCustomerDto {
  id: string
  name: string
  phone: string | null
  address: string | null
  taxId: string | null
}

export interface InvoiceItemResponseDto {
  id: string
  description: string
  quantity: number
  unit: InvoiceItemUnitDto
  unitPrice: number
  lineTotal: number
}

export interface PaymentItemDto {
  id: string
  amount: number | null
  method: PaymentMethodDto | null
  status: PaymentStatusDto
  proofUrl: string | null
  referenceNo: string | null
  receiptId: string | null
  /** When the payment was recorded — the display date of the transaction. */
  paidAt: string
}

// --- List endpoint: lightweight summary, no nested arrays ---

export interface InvoiceListItemDto {
  id: string
  invoiceNumber: string
  customerName: string
  issuedDate: string
  dueDate: string | null
  totalAmount: number
  amountPaid: number
  balance: number
  status: InvoiceStatusDto
  // No paymentMethod here: the list reads only Invoices + PaymentSummary (no N+1),
  // and method lives on the Payments sheet. It's available on the detail DTO instead.
}

// --- Detail endpoint: full breakdown for the invoice document + payment history ---

export interface InvoiceDetailDto {
  id: string
  invoiceNumber: string
  customer: InvoiceCustomerDto
  periodStart: string
  periodEnd: string
  issuedDate: string
  dueDate: string | null

  // Tax-document breakdown
  itemsSubtotal: number
  discountAmount: number
  surchargeAmount: number
  subtotal: number
  taxAmount: number
  whtAmount: number
  totalAmount: number

  // Payment rollup
  amountPaid: number
  balance: number
  status: InvoiceStatusDto

  items: InvoiceItemResponseDto[]
  payments: PaymentItemDto[]
}
