import type { InvoiceRecordRow, InvoiceRow, InvoiceItemRow, PaymentRow, PaymentSummaryRow } from '../types/invoice-db.types'
import type {
  InvoiceItemResponseDto,
  InvoiceResponseDto,
  InvoiceStatusDto,
  PaymentMethodDto,
  PaymentResponseDto,
} from '../types/invoice-response.types'

export function mapInvoiceRecordRowToResponseDto(record: InvoiceRecordRow): InvoiceResponseDto {
  const { invoice, paymentSummary } = record
  const items = record.items.map(mapInvoiceItemRowToResponseDto)
  const payments = record.payments.map(mapPaymentRowToResponseDto)
  const status = resolveInvoiceStatus(invoice, paymentSummary)
  const paymentMethod = resolvePaymentMethod(payments)

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    customerId: invoice.customer_id,
    customerName: invoice.customer_name,
    customerPhone: invoice.customer_phone,
    customerAddress: invoice.customer_address,
    customerTaxId: invoice.customer_tax_id,
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
    amountDue: paymentSummary?.amount_due ?? invoice.total_amount,
    amountPaid: paymentSummary?.amount_paid ?? 0,
    balance: paymentSummary?.balance ?? invoice.total_amount,
    paymentStatus: paymentSummary?.status ?? 'UNPAID',
    paymentMethod,
    status,
    items,
    payments,
    createdAt: invoice.created_at,
    createdBy: invoice.created_by,
    deletedAt: invoice.deleted_at,
    deletedBy: invoice.deleted_by,
  }
}

function mapInvoiceItemRowToResponseDto(item: InvoiceItemRow): InvoiceItemResponseDto {
  return {
    id: item.id,
    invoiceId: item.invoice_id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unit_price,
    lineTotal: item.line_total,
  }
}

function mapPaymentRowToResponseDto(payment: PaymentRow): PaymentResponseDto {
  return {
    id: payment.id,
    invoiceId: payment.invoice_id,
    amount: payment.amount,
    method: payment.method,
    proofUrl: payment.proof_url,
    referenceNo: payment.reference_no,
    status: payment.status,
    apiLog: payment.api_log,
    notes: payment.notes,
    receiptId: payment.receipt_id,
    createdAt: payment.created_at,
    createdBy: payment.created_by,
    updatedAt: payment.updated_at,
    updatedBy: payment.updated_by,
  }
}

function resolveInvoiceStatus(
  invoice: InvoiceRow,
  paymentSummary: PaymentSummaryRow | null,
): InvoiceStatusDto {
  if (paymentSummary?.status === 'PAID') {
    return 'PAID'
  }

  if (invoice.due_date && isPastDate(invoice.due_date)) {
    return 'OVERDUE'
  }

  return paymentSummary?.status ?? 'UNPAID'
}

function resolvePaymentMethod(payments: PaymentResponseDto[]): PaymentMethodDto | 'NONE' {
  return payments.find((payment) => payment.method !== null)?.method ?? 'NONE'
}

function isPastDate(date: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  return target.getTime() < today.getTime()
}
