import { z } from 'zod'
import { invoiceDetailResponseSchema } from '@contracts/invoices/invoice-view-api.schema'
import { getMockInvoiceDetailResponse } from '../mocks/invoice-view.mock'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Customer snapshots are read from serialized sheet data. Keep a malformed or
 * missing snapshot displayable instead of allowing a single bad field to
 * crash the detail page.
 */
function normalizeCustomer(value: unknown): InvoiceDetailDto['customer'] {
  const customer = isRecord(value) ? value : {}

  return {
    customerCode: nullableText(customer.customerCode),
    customerName: nullableText(customer.customerName),
    phone: nullableText(customer.phone),
    address: nullableText(customer.address),
  }
}

function normalizeInvoiceDetail(value: unknown): InvoiceDetailDto | null {
  if (!isRecord(value)) return null

  const parsed = invoiceDetailResponseSchema.safeParse({
    ...value,
    customer: normalizeCustomer(value.customer),
  })

  return parsed.success ? parsed.data : null
}

/**
 * Stand-in for GET /api/invoices/:invoiceNumber until the read route is wired.
 * The mock returns the same envelope data shape as the read contract.
 */
export async function getInvoiceDetail(input: unknown): Promise<InvoiceDetailDto | null> {
  const invoiceNumber = normalizeInvoiceNumber(input)
  const response = getMockInvoiceDetailResponse(invoiceNumber)
  return normalizeInvoiceDetail(response?.data)
}
