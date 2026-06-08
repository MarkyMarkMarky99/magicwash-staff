export type InvoiceItemUnitDto = 'PIECE' | 'KG' | 'PAIR' | 'SET'

export type PaymentMethodDto = 'CASH' | 'TRANSFER' | 'CREDIT_CARD' | 'CHEQUE' | 'OTHER'

export type PaymentStatusDto = 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW'

export type PaymentSummaryStatusDto = 'UNPAID' | 'PARTIAL' | 'PAID'

export type InvoiceStatusDto = PaymentSummaryStatusDto | 'OVERDUE'

export interface InvoiceItemResponseDto {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unit: InvoiceItemUnitDto
  unitPrice: number
  lineTotal: number
}

export interface PaymentResponseDto {
  id: string
  invoiceId: string
  amount: number | null
  method: PaymentMethodDto | null
  proofUrl: string | null
  referenceNo: string | null
  status: PaymentStatusDto
  apiLog: Record<string, unknown> | null
  notes: string | null
  receiptId: string | null
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface InvoiceResponseDto {
  id: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerPhone: string | null
  customerAddress: string | null
  customerTaxId: string | null
  periodStart: string
  periodEnd: string
  issuedDate: string
  dueDate: string | null
  itemsSubtotal: number
  discountAmount: number
  surchargeAmount: number
  subtotal: number
  taxAmount: number
  whtAmount: number
  totalAmount: number
  amountDue: number
  amountPaid: number
  balance: number
  paymentStatus: PaymentSummaryStatusDto
  paymentMethod: PaymentMethodDto | 'NONE'
  status: InvoiceStatusDto
  items: InvoiceItemResponseDto[]
  payments: PaymentResponseDto[]
  createdAt: string
  createdBy: string
  deletedAt: string | null
  deletedBy: string | null
}

export interface InvoiceListResponseDto {
  invoices: InvoiceResponseDto[]
  total: number
  page: number
  perPage: number
}
