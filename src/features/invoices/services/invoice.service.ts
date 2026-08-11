import { createInvoiceResponseSchema, type CreateInvoiceRequest, type CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'
import { invoiceListQuerySchema } from '@contracts/invoices/invoice-view-api.schema'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceListItemDto, InvoiceListResponseDto } from '../types/invoices.types'
import { apiGetList } from '@/shared/api/api-client'
import { synthesizeNetworkFailureOutcome } from '../utils/invoice-outcome.utils'

const INVOICES_ENDPOINT = '/api/invoices'

/**
 * The backend returns page-only pagination metadata, so `items.length` is the
 * display count for the current page rather than a dataset total.
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
 *
 * Validated against `createInvoiceResponseSchema` rather than blindly cast:
 * an unhandled server-side throw (e.g. a thrown `syncInvoiceView` — see
 * `invoice.service.ts` (server)) is caught by the generic `ApiHandler`
 * catch instead of this route's own outcome mapping, returning the generic
 * `{success:false,error}` envelope — a body with no `kind` at all. A blind
 * cast would let that flow straight through as a `CreateInvoiceResponse`;
 * every `v-if="result.kind === …"` in `InvoiceCreatePage.vue` would then
 * miss and staff would see a BLANK result panel after a write that may have
 * fully succeeded. Falling back to `synthesizeNetworkFailureOutcome()`
 * (certainty `'unknown'`, never a retry) is the same truthful, non-blank
 * outcome an actual network failure already produces.
 */
export async function createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
  const response = await fetch(INVOICES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return synthesizeNetworkFailureOutcome('The server responded, but the reply could not be read. This may already have been saved.')
  }

  const parsed = createInvoiceResponseSchema.safeParse(body)
  if (!parsed.success) {
    return synthesizeNetworkFailureOutcome('The server responded, but not with a recognized outcome. This may already have been saved.')
  }
  return parsed.data
}
