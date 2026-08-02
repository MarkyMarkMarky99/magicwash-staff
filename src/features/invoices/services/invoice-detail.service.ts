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

/**
 * GET /api/invoices/:invoiceNumber — real network call via the shared
 * apiGet helper (same pattern as customer.service.ts's getCustomerById). The
 * response is returned as-is (typed via the generic, no re-validation — see
 * api-client.ts's doc comment on why services never `.parse()` responses). A
 * 404 (BaseCrudService.getById throws ApiError.notFound when 0 rows match)
 * is translated to `null`, matching the old mock's
 * "unknown invoiceNumber -> undefined -> null" contract the caller
 * (InvoiceDetailPage.vue) already expects. Any other failure re-throws so
 * the page's generic error state still fires.
 */
export async function getInvoiceDetail(input: unknown): Promise<InvoiceDetailDto | null> {
  const invoiceNumber = normalizeInvoiceNumber(input)

  try {
    return await apiGet<InvoiceDetailDto>(`/api/invoices/${encodeURIComponent(invoiceNumber)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
