import type { InvoiceStatusDto } from './invoices.types'

export interface InvoiceFilter {
  keyword: string
  customerId: string | null
  status: InvoiceStatusDto | null
  dateFrom: string | null
  dateTo: string | null
  page: number
  perPage: number
  sortBy: 'issuedDate' | 'dueDate' | 'status' | 'grandTotal'
  sortOrder: 'asc' | 'desc'
}
