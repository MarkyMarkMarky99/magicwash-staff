import { defineStore } from 'pinia'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { listOrdersByCustomer, type OrderListDto } from './order.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

function errorMessage(reason: unknown): string {
  return reason instanceof Error && reason.message
    ? reason.message
    : 'Unable to load order history'
}

export const useCustomerOrdersStore = defineStore('customer-orders', () => {
  const items = shallowRef<OrderListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let activeCustomerId: string | null = null
  let loadedCustomerId: string | null = null
  let requestId = 0

  function applyResult(result: OrderListDto[], id: number, customerId: string): void {
    if (id !== requestId || activeCustomerId !== customerId) return
    items.value = result
    loadedCustomerId = customerId
    error.value = null
  }

  async function load(customerId: string, force = false): Promise<void> {
    if (!force && loadedCustomerId === customerId) return

    const id = ++requestId
    const customerChanged = activeCustomerId !== customerId
    activeCustomerId = customerId
    loadedCustomerId = null
    loading.value = true
    error.value = null
    if (customerChanged) items.value = []

    try {
      const result = await listOrdersByCustomer(customerId, (fresh) =>
        applyResult(fresh, id, customerId),
      )
      applyResult(result, id, customerId)
    } catch (reason) {
      if (id !== requestId || activeCustomerId !== customerId) return
      error.value = errorMessage(reason)
    } finally {
      if (id === requestId && activeCustomerId === customerId) loading.value = false
    }
  }

  const stopInvalidationListener = onCacheInvalidated('/api/orders', () => {
    if (activeCustomerId !== null) void load(activeCustomerId, true)
  })
  onScopeDispose(stopInvalidationListener)

  return { items, loading, error, load }
})
