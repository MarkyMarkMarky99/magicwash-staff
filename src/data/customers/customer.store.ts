import { defineStore } from 'pinia'
import { onScopeDispose, ref, shallowRef } from 'vue'
import {
  listCustomers,
  type CustomerListDto,
  type CustomerListResult,
} from './customer.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

export const useCustomerStore = defineStore('customers', () => {
  // The list is replaced wholesale, so shallowRef avoids per-customer proxies.
  const customers = shallowRef<CustomerListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  const truncated = ref(false)
  let loadPromise: Promise<void> | null = null
  let requestId = 0

  function applyResult(result: CustomerListResult, id: number): void {
    if (id !== requestId) return
    customers.value = result.items
    truncated.value = result.truncated
    loaded.value = !result.truncated
    error.value = null
  }

  async function loadCustomers(force = false): Promise<void> {
    if (loaded.value && !force) return
    if (loadPromise) return loadPromise

    const id = ++requestId
    loadPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        const result = await listCustomers((fresh) => applyResult(fresh, id))
        applyResult(result, id)
      } catch {
        if (id === requestId) error.value = 'Unable to load customers'
      } finally {
        if (id === requestId) loading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  const stopInvalidationListener = onCacheInvalidated('/api/customers', () => {
    if (customers.value.length > 0 || loaded.value || truncated.value) void loadCustomers(true)
  })
  onScopeDispose(stopInvalidationListener)

  return { customers, loading, error, loaded, truncated, loadCustomers }
})
