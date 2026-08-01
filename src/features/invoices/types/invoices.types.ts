import { z } from 'zod'
import {
  invoiceListResponseSchema,
  invoiceViewStatusSchema,
} from '@contracts/invoices/invoice-view-api.schema'

export type InvoiceItemUnitDto = 'PIECE' | 'KG' | 'PAIR' | 'SET'

export type PaymentMethodDto = 'CASH' | 'TRANSFER' | 'CREDIT_CARD' | 'CHEQUE' | 'OTHER'

export type PaymentStatusDto = 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW'

export type PaymentSummaryStatusDto = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'

export type InvoiceStatusDto = z.infer<typeof invoiceViewStatusSchema>

/** The read-contract projection used by both the invoice list and detail mock. */
export type InvoiceListItemDto = z.infer<typeof invoiceListResponseSchema>

export interface InvoiceItemResponseDto {
  id: string
  invoiceNumber: string
  description: string
  quantity: number
  unit: InvoiceItemUnitDto
  unitPrice: number
  lineTotal: number
}

export interface PaymentResponseDto {
  id: string
  invoiceNumber: string
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

export type InvoiceResponseDto = InvoiceListItemDto

export interface InvoiceListResponseDto {
  invoices: InvoiceListItemDto[]
  total: number
  page: number
  perPage: number
}
