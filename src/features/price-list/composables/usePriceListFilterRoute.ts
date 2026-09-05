import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'

export interface PriceListFilter {
  category: string | null
  serviceType: string | null
}

export const defaultPriceListFilter: PriceListFilter = {
  category: null,
  serviceType: null,
}

export function usePriceListFilterRoute() {
  const route = useRoute()
  const router = useRouter()

  const filter = computed<PriceListFilter>(() => filterFromQuery(route.query))

  function updateFilter(payload: Partial<PriceListFilter>) {
    router.replace({
      name: 'price-list',
      query: filterToQuery({ ...filter.value, ...payload }),
    })
  }

  return { filter, updateFilter }
}

export function filterFromQuery(query: LocationQuery): PriceListFilter {
  return {
    category: readString(query.category) || null,
    serviceType: readString(query.serviceType) || null,
  }
}

export function filterToQuery(filter: PriceListFilter): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (filter.category) query.category = filter.category
  if (filter.serviceType) query.serviceType = filter.serviceType

  return query
}

function readString(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === null ? '' : String(raw)
}
