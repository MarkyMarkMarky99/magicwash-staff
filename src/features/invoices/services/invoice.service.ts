import type { CreateInvoiceRequest, CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceListResponseDto } from '../types/invoices.types'

const INVOICES_ENDPOINT = '/api/invoices'

export async function getInvoices(filter: InvoiceFilter): Promise<InvoiceListResponseDto> {
  const response = await fetch(`${INVOICES_ENDPOINT}?${buildQuery(filter)}`)

  if (!response.ok) {
    throw new Error(`Failed to load invoices: ${response.status}`)
  }

  return response.json() as Promise<InvoiceListResponseDto>
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

function buildQuery(filter: InvoiceFilter): string {
  const params = new URLSearchParams()

  if (filter.keyword) params.set('keyword', filter.keyword)
  if (filter.customerId) params.set('customerId', filter.customerId)
  if (filter.status) params.set('status', filter.status)
  if (filter.dateFrom) params.set('dateFrom', filter.dateFrom)
  if (filter.dateTo) params.set('dateTo', filter.dateTo)
  params.set('page', String(filter.page))
  params.set('perPage', String(filter.perPage))
  params.set('sortBy', filter.sortBy)
  params.set('sortOrder', filter.sortOrder)

  return params.toString()
}
