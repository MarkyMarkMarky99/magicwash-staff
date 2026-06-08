import { getInvoices } from '../services/invoice.service'
import type { InvoiceListQuery } from '../services/invoice.service'

interface InvoiceListRequestQuery {
  keyword?: string
  customerId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: string
  perPage?: string
  sortBy?: string
  sortOrder?: string
}

interface HandlerRequest {
  method?: string
  query?: InvoiceListRequestQuery
}

interface HandlerResponse {
  status: (code: number) => HandlerResponse
  json: (body: unknown) => void
}

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: `Method ${req.method ?? ''} not allowed` })
    return
  }

  const query = parseListQuery(req.query ?? {})

  try {
    const result = await getInvoices(query)
    res.status(200).json(result)
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to load invoices' })
  }
}

function parseListQuery(query: InvoiceListRequestQuery): InvoiceListQuery {
  return {
    keyword: query.keyword,
    customerId: query.customerId ?? null,
    status: query.status ?? null,
    dateFrom: query.dateFrom ?? null,
    dateTo: query.dateTo ?? null,
    page: query.page ? Number(query.page) : undefined,
    perPage: query.perPage ? Number(query.perPage) : undefined,
    sortBy: query.sortBy as InvoiceListQuery['sortBy'],
    sortOrder: query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : undefined,
  }
}
