import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { listCustomers, type CustomerListDto } from '../services/customer.service'

/** Caches the full customer list; active filters remain in the URL query. */
export const useCustomerStore = defineStore('customers', () => {
  // shallowRef: the list is replaced whole, never patched per item, so deep
  // reactivity would only cost one proxy per customer for nothing.
  const customers = shallowRef<CustomerListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  /** Load the list once; pass `force` (or call `invalidate`) to refetch. */
  async function loadCustomers(force = false) {
    if (loaded.value && !force) return

    loading.value = true
    error.value = null
    try {
      customers.value = await listCustomers()
      loaded.value = true
    } catch {
      error.value = 'Unable to load customers'
    } finally {
      loading.value = false
    }
  }

  /** Drop the cache so the next `loadCustomers` refetches. */
  function invalidate() {
    loaded.value = false
  }

  return { customers, loading, error, loaded, loadCustomers, invalidate }
})
