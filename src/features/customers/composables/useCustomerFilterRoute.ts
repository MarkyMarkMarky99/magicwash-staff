import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { z } from 'zod'
import { customerTypeSchema } from '@contracts/customers/customer-api.schema'

/** The URL query is the filter source of truth; default values are omitted. */

type CustomerType = z.infer<typeof customerTypeSchema>

export interface CustomerFilter {
  keyword: string
  customerType: CustomerType | null
}

export const defaultCustomerFilter: CustomerFilter = {
  keyword: '',
  customerType: null,
}

const CUSTOMER_TYPES: readonly CustomerType[] = customerTypeSchema.options

export function useCustomerFilterRoute() {
  const route = useRoute()
  const router = useRouter()

  const filter = computed<CustomerFilter>(() => filterFromQuery(route.query))

  function updateFilter(payload: Partial<CustomerFilter>) {
    router.replace({
      name: 'customer-list',
      query: filterToQuery({ ...filter.value, ...payload }),
    })
  }

  return { filter, updateFilter }
}

export function filterFromQuery(query: LocationQuery): CustomerFilter {
  return {
    keyword: readString(query.keyword),
    customerType: readEnum(query.customerType, CUSTOMER_TYPES),
  }
}

export function filterToQuery(filter: CustomerFilter): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (filter.keyword) query.keyword = filter.keyword
  if (filter.customerType) query.customerType = filter.customerType

  return query
}

/** Query values can be `string`, `string[]`, `null`, or missing — normalize to a plain string. */
function readString(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === null ? '' : String(raw)
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const raw = readString(value)
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null
}
