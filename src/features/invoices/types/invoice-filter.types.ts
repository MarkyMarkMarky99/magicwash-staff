import type { InvoiceStatusDto } from './invoices.types'

export interface InvoiceFilter {
  keyword: string
  customerId: string | null
  status: InvoiceStatusDto | null
  dateFrom: string | null
  dateTo: string | null
  page: number
  perPage: number
  sortBy:
    | 'invoiceNumber'
    | 'customerName'
    | 'issuedDate'
    | 'dueDate'
    | 'totalAmount'
    | 'status'
  sortOrder: 'asc' | 'desc'
}
