import type { z } from 'zod'
import {
  invoicePrintRequestSchema,
  invoicePrintResponseSchema,
} from '@contracts/invoices/invoice-api.schema'
import { apiPost } from '@/shared/api/api-client'

export type InvoicePrintResponse = z.infer<typeof invoicePrintResponseSchema>

const INVOICE_PRINTS_ENDPOINT = '/api/invoice-prints'

export async function printInvoice(invoiceNumber: string): Promise<InvoicePrintResponse> {
  return apiPost<InvoicePrintResponse>(INVOICE_PRINTS_ENDPOINT, {
    data: { invoiceNumber },
    requestSchema: invoicePrintRequestSchema,
  })
}
