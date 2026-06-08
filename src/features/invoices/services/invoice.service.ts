import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceListResponseDto } from '../types/invoices.types'

const INVOICES_ENDPOINT = '/api/modules/invoices'

export async function getInvoices(filter: InvoiceFilter): Promise<InvoiceListResponseDto> {
  const response = await fetch(`${INVOICES_ENDPOINT}?${buildQuery(filter)}`)

  if (!response.ok) {
    throw new Error(`Failed to load invoices: ${response.status}`)
  }

  return response.json() as Promise<InvoiceListResponseDto>
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
