import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceStatusDto } from '../types/invoices.types'

export const defaultInvoiceFilter: InvoiceFilter = {
  keyword: '',
  customerId: null,
  status: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  perPage: 20,
  sortBy: 'issuedDate',
  sortOrder: 'desc',
}

const INVOICE_STATUSES: readonly InvoiceStatusDto[] = ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE']

const INVOICE_SORT_KEYS: readonly InvoiceFilter['sortBy'][] = [
  'invoiceNumber',
  'customerName',
  'issuedDate',
  'dueDate',
  'totalAmount',
  'status',
]

const SORT_ORDERS: readonly InvoiceFilter['sortOrder'][] = ['asc', 'desc']

/**
 * Keeps the invoice list filter in sync with the URL query string, which acts as
 * the single source of truth. `filter` is derived (and validated) from the route;
 * `updateFilter` writes a clean query back, omitting any value that equals its default.
 */
export function useInvoiceFilterRoute() {
  const route = useRoute()
  const router = useRouter()

  const filter = computed<InvoiceFilter>(() => filterFromQuery(route.query))

  function updateFilter(payload: Partial<InvoiceFilter>) {
    router.replace({
      name: 'invoice-list',
      query: filterToQuery({ ...filter.value, ...payload, page: payload.page ?? 1 }),
    })
  }

  return { filter, updateFilter }
}

export function filterFromQuery(query: LocationQuery): InvoiceFilter {
  return {
    keyword: readString(query.keyword),
    customerId: readString(query.customerId) || null,
    status: readEnum(query.status, INVOICE_STATUSES),
    dateFrom: readString(query.dateFrom) || null,
    dateTo: readString(query.dateTo) || null,
    page: readPositiveInt(query.page, defaultInvoiceFilter.page),
    perPage: readPositiveInt(query.perPage, defaultInvoiceFilter.perPage),
    sortBy: readEnum(query.sortBy, INVOICE_SORT_KEYS) ?? defaultInvoiceFilter.sortBy,
    sortOrder: readEnum(query.sortOrder, SORT_ORDERS) ?? defaultInvoiceFilter.sortOrder,
  }
}

export function filterToQuery(filter: InvoiceFilter): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (filter.keyword) query.keyword = filter.keyword
  if (filter.customerId) query.customerId = filter.customerId
  if (filter.status) query.status = filter.status
  if (filter.dateFrom) query.dateFrom = filter.dateFrom
  if (filter.dateTo) query.dateTo = filter.dateTo
  if (filter.page > defaultInvoiceFilter.page) query.page = String(filter.page)
  if (filter.perPage !== defaultInvoiceFilter.perPage) query.perPage = String(filter.perPage)
  if (filter.sortBy !== defaultInvoiceFilter.sortBy) query.sortBy = filter.sortBy
  if (filter.sortOrder !== defaultInvoiceFilter.sortOrder) query.sortOrder = filter.sortOrder

  return query
}

/** Query values can be `string`, `string[]`, `null`, or missing — normalize to a plain string. */
function readString(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === null ? '' : String(raw)
}

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(readString(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const raw = readString(value)
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null
}
