import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import {
  getCustomerPackages,
  type CustomerPackageListItem,
  type CustomerPackageListQuery,
} from './customer-package.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

export const useCustomerPackageStore = defineStore('customer-packages', () => {
  const items = ref<CustomerPackageListItem[]>([])
  const page = ref(1)
  const perPage = ref(20)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let activeFilter: CustomerPackageListQuery | null = null
  let latestRequest = 0

  async function fetchCustomerPackages(filter: CustomerPackageListQuery) {
    activeFilter = { ...filter }
    const requestId = ++latestRequest
    loading.value = true
    error.value = null
    try {
      const result = await getCustomerPackages(filter)
      if (requestId !== latestRequest) return
      items.value = result.items
      page.value = result.page
      perPage.value = result.perPage
    } catch {
      if (requestId !== latestRequest) return
      error.value = 'Unable to load customer packages'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  const stopInvalidationListener = onCacheInvalidated('/api/customer-packages', () => {
    if (activeFilter !== null) void fetchCustomerPackages(activeFilter)
  })
  onScopeDispose(stopInvalidationListener)

  return { items, page, perPage, loading, error, fetchCustomerPackages }
})
