import type { CreateInvoiceRequest, CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'
import { invoiceListQuerySchema } from '@contracts/invoices/invoice-view-api.schema'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceListItemDto, InvoiceListResponseDto } from '../types/invoices.types'
import { apiGetList } from '@/shared/api/api-client'

const INVOICES_ENDPOINT = '/api/invoices'

/**
 * GET /api/invoices — real network call via the shared apiGetList helper,
 * same pattern as customer.service.ts / order.service.ts. Validates `filter`
 * against the same `invoiceListQuerySchema` the backend validates against
 * (contracts/invoices/invoice-view-api.schema.ts).
 *
 * `total` is NOT provided by the backend today — BaseCrudService/okPaged
 * only returns page-only pagination meta `{ page, perPage }` (see
 * api/CLAUDE.md's Key Engine Rules), the same limitation customer/order
 * lists already have. InvoiceListPage only uses `total` as a display count
 * label, never for page-count navigation, so the current page's item count
 * is an honest stand-in, not a silent bug.
 */
export async function getInvoices(filter: InvoiceFilter): Promise<InvoiceListResponseDto> {
  const { items, pagination } = await apiGetList<InvoiceListItemDto>(INVOICES_ENDPOINT, {
    query: filter,
    querySchema: invoiceListQuerySchema,
  })

  return {
    invoices: items,
    total: items.length,
    page: pagination.page,
    perPage: pagination.perPage,
  }
}

/**
 * POST /api/invoices. Unlike every other endpoint in this app, the response
 * body IS the `CreateInvoiceResponse` discriminated union at the top level —
 * never wrapped in the generic `{ success, data, meta }` envelope (see
 * `server/modules/invoices/invoice.module.ts`). The HTTP status varies by
 * `kind` (201/422/500/502), but every kind is a well-formed JSON body, so this
 * always reads the body — regardless of `response.ok` — and lets the caller
 * dispatch on `body.kind` rather than the HTTP status.
 */
export async function createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
  const response = await fetch(INVOICES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  return response.json() as Promise<CreateInvoiceResponse>
}
