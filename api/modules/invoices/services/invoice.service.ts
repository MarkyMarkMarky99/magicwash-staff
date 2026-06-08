import { mapInvoiceRecordRowToResponseDto } from '../mappers/invoice.mapper'
import { findInvoiceRecords } from '../repositories/invoice.repository'
import type { InvoiceListResponseDto, InvoiceResponseDto } from '../types/invoice-response.types'

export interface InvoiceListQuery {
  keyword?: string
  customerId?: string | null
  status?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  page?: number
  perPage?: number
  sortBy?: keyof InvoiceResponseDto
  sortOrder?: 'asc' | 'desc'
}

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const DEFAULT_SORT_BY: keyof InvoiceResponseDto = 'issuedDate'
const DEFAULT_SORT_ORDER: 'asc' | 'desc' = 'desc'

export async function getInvoices(query: InvoiceListQuery): Promise<InvoiceListResponseDto> {
  const records = await findInvoiceRecords()
  const invoices = records.map(mapInvoiceRecordRowToResponseDto)

  const filtered = filterInvoices(invoices, query)
  const sorted = sortInvoices(filtered, query)

  const page = Math.max(query.page ?? DEFAULT_PAGE, 1)
  const perPage = Math.max(query.perPage ?? DEFAULT_PER_PAGE, 1)
  const start = (page - 1) * perPage

  return {
    invoices: sorted.slice(start, start + perPage),
    total: sorted.length,
    page,
    perPage,
  }
}

function filterInvoices(invoices: InvoiceResponseDto[], query: InvoiceListQuery): InvoiceResponseDto[] {
  const keyword = (query.keyword ?? '').trim().toLowerCase()

  return invoices.filter((invoice) => {
    const matchesKeyword =
      !keyword ||
      invoice.invoiceNumber.toLowerCase().includes(keyword) ||
      invoice.customerName.toLowerCase().includes(keyword) ||
      (invoice.customerPhone ?? '').toLowerCase().includes(keyword)
    const matchesCustomer = !query.customerId || invoice.customerId === query.customerId
    const matchesStatus = !query.status || invoice.status === query.status
    const matchesDateFrom = !query.dateFrom || invoice.issuedDate >= query.dateFrom
    const matchesDateTo = !query.dateTo || invoice.issuedDate <= query.dateTo

    return matchesKeyword && matchesCustomer && matchesStatus && matchesDateFrom && matchesDateTo
  })
}

function sortInvoices(invoices: InvoiceResponseDto[], query: InvoiceListQuery): InvoiceResponseDto[] {
  const sortBy = query.sortBy ?? DEFAULT_SORT_BY
  const sortOrder = query.sortOrder ?? DEFAULT_SORT_ORDER
  const sortDirection = sortOrder === 'asc' ? 1 : -1

  return [...invoices].sort((left, right) => {
    const leftValue = getSortValue(left, sortBy)
    const rightValue = getSortValue(right, sortBy)

    if (leftValue < rightValue) {
      return -1 * sortDirection
    }

    if (leftValue > rightValue) {
      return 1 * sortDirection
    }

    return 0
  })
}

function getSortValue(invoice: InvoiceResponseDto, sortBy: keyof InvoiceResponseDto): string | number {
  if (sortBy === 'dueDate') {
    return invoice.dueDate ?? ''
  }

  const value = invoice[sortBy]
  return typeof value === 'string' || typeof value === 'number' ? value : ''
}
