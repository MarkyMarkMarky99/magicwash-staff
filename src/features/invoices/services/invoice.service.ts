import type { CreateInvoiceRequest, CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import { getMockInvoiceListPage } from '../mocks/invoice-view.mock'
import type { InvoiceListResponseDto } from '../types/invoices.types'

const INVOICES_ENDPOINT = '/api/invoices'

/**
 * Stand-in for GET /api/invoices until the read route is wired up in
 * `server/api/route-registry.ts` (that route is currently POST-only). Mirrors
 * `invoice-detail.service.ts`'s `getInvoiceDetail()`: calls the mock directly,
 * with no network attempt — Vite's dev-server SPA fallback returns `200 OK`
 * HTML for any unmatched path, so a real `fetch()` here can't be told apart
 * from a real response by status code alone.
 *
 * Delete this mock indirection once the real read endpoint exists.
 */
export async function getInvoices(filter: InvoiceFilter): Promise<InvoiceListResponseDto> {
  const page = getMockInvoiceListPage(filter)

  return {
    invoices: page.items,
    total: page.total,
    page: page.page,
    perPage: page.perPage,
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
