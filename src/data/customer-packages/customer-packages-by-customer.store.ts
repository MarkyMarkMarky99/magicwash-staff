import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import {
  getCustomerPackages,
  type CustomerPackageListItem,
} from './customer-package.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

export const useCustomerPackagesByCustomerStore = defineStore('customer-detail-packages-data', () => {
  const items = ref<CustomerPackageListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let activeCustomerId: string | null = null
  let loadedCustomerId: string | null = null
  let latestRequest = 0

  async function load(customerId: string, force = false) {
    if (!force && loadedCustomerId === customerId) return
    const requestId = ++latestRequest
    const customerChanged = activeCustomerId !== customerId
    activeCustomerId = customerId
    loadedCustomerId = null
    if (customerChanged) items.value = []
    loading.value = true
    error.value = null
    try {
      const result = await getCustomerPackages({
        keyword: '', customerId, status: null, packageCode: null,
        page: 1, perPage: 20, sortBy: 'startDate', sortOrder: 'desc',
      })
      if (requestId !== latestRequest || activeCustomerId !== customerId) return
      items.value = result.items
      loadedCustomerId = customerId
    } catch {
      if (requestId === latestRequest && activeCustomerId === customerId) {
        error.value = 'Unable to load customer packages'
      }
    } finally {
      if (requestId === latestRequest && activeCustomerId === customerId) loading.value = false
    }
  }

  const stopInvalidationListener = onCacheInvalidated('/api/customer-packages', () => {
    if (activeCustomerId !== null) void load(activeCustomerId, true)
  })
  onScopeDispose(stopInvalidationListener)

  return { items, loading, error, load }
})
