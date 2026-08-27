import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { z } from 'zod'
import {
  customerPackageListQuerySchema,
  customerPackageStatusSchema,
  customerPackageSortFieldSchema,
} from '@contracts/customer-packages/customer-package-api.schema'

export type CustomerPackageFilter = z.infer<typeof customerPackageListQuerySchema>
type CustomerPackageStatus = z.infer<typeof customerPackageStatusSchema>

export const defaultCustomerPackageFilter: CustomerPackageFilter = {
  keyword: '', customerId: null, status: null, packageCode: null, page: 1, perPage: 20, sortBy: 'startDate', sortOrder: 'desc',
}

const STATUSES: readonly CustomerPackageStatus[] = customerPackageStatusSchema.options
const SORT_KEYS: readonly CustomerPackageFilter['sortBy'][] = customerPackageSortFieldSchema.options
const SORT_ORDERS: readonly CustomerPackageFilter['sortOrder'][] = ['asc', 'desc']

export function useCustomerPackageFilterRoute() {
  const route = useRoute()
  const router = useRouter()
  const filter = computed<CustomerPackageFilter>(() => filterFromQuery(route.query))

  function updateFilter(payload: Partial<CustomerPackageFilter>) {
    router.replace({
      name: 'customer-package-list',
      query: filterToQuery({ ...filter.value, ...payload, page: payload.page ?? 1 }),
    })
  }

  return { filter, updateFilter }
}

export function filterFromQuery(query: LocationQuery): CustomerPackageFilter {
  return {
    keyword: readString(query.keyword),
    customerId: readString(query.customerId) || null,
    status: readEnum(query.status, STATUSES),
    packageCode: readString(query.packageCode) || null,
    page: readPositiveInt(query.page, defaultCustomerPackageFilter.page),
    perPage: readPositiveInt(query.perPage, defaultCustomerPackageFilter.perPage),
    sortBy: readEnum(query.sortBy, SORT_KEYS) ?? defaultCustomerPackageFilter.sortBy,
    sortOrder: readEnum(query.sortOrder, SORT_ORDERS) ?? defaultCustomerPackageFilter.sortOrder,
  }
}

export function filterToQuery(filter: CustomerPackageFilter): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  if (filter.keyword) query.keyword = filter.keyword
  if (filter.customerId) query.customerId = filter.customerId
  if (filter.status) query.status = filter.status
  if (filter.packageCode) query.packageCode = filter.packageCode
  if (filter.page > defaultCustomerPackageFilter.page) query.page = String(filter.page)
  if (filter.perPage !== defaultCustomerPackageFilter.perPage) query.perPage = String(filter.perPage)
  if (filter.sortBy !== defaultCustomerPackageFilter.sortBy) query.sortBy = filter.sortBy
  if (filter.sortOrder !== defaultCustomerPackageFilter.sortOrder) query.sortOrder = filter.sortOrder
  return query
}

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
  return (allowed as readonly string[]).includes(raw) ? raw as T : null
}
