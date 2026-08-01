import { z } from 'zod'
import { invoiceDetailResponseSchema } from '@contracts/invoices/invoice-view-api.schema'
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
 * GET /api/invoices/:invoiceNumber — real network call via the shared
 * apiGet helper (same pattern as customer.service.ts's getCustomerById). A
 * 404 (BaseCrudService.getById throws ApiError.notFound when 0 rows match)
 * is translated to `null`, matching the old mock's
 * "unknown invoiceNumber -> undefined -> null" contract the caller
 * (InvoiceDetailPage.vue) already expects. Any other failure re-throws so
 * the page's generic error state still fires.
 */
export async function getInvoiceDetail(input: unknown): Promise<InvoiceDetailDto | null> {
  const invoiceNumber = normalizeInvoiceNumber(input)

  try {
    const data = await apiGet<unknown>(`/api/invoices/${encodeURIComponent(invoiceNumber)}`)
    return normalizeInvoiceDetail(data)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
