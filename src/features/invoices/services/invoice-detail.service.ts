import { z } from 'zod'
import { invoiceDetailResponseSchema } from '@contracts/invoices/invoice-api.schema'
import { apiGet, ApiError } from '@/shared/api/api-client'

export type InvoiceDetailDto = z.infer<typeof invoiceDetailResponseSchema>

const invoiceNumberSchema = z.string().trim().min(1)

export class InvalidInvoiceNumberError extends Error {
  constructor() {
    super('Invalid invoice number')
    this.name = 'InvalidInvoiceNumberError'
  }
}

/** Validates the route input before it reaches the detail lookup. */
export function normalizeInvoiceNumber(input: unknown): string {
  const parsed = invoiceNumberSchema.safeParse(input)
  if (!parsed.success) throw new InvalidInvoiceNumberError()
  return parsed.data
}

/** Validates input, translates a 404 to `null`, and rethrows other failures. */
export async function getInvoiceDetail(input: unknown): Promise<InvoiceDetailDto | null> {
  const invoiceNumber = normalizeInvoiceNumber(input)

  try {
    return await apiGet<InvoiceDetailDto>(`/api/invoices/${encodeURIComponent(invoiceNumber)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
