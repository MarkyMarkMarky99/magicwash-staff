import { defineStore } from 'pinia'
import { onScopeDispose, ref, shallowRef } from 'vue'
import {
  listAppointmentsByCustomer,
  type AppointmentListDto,
} from './waiting-pickup.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

export const useCustomerAppointmentsStore = defineStore('customer-appointments', () => {
  const items = shallowRef<AppointmentListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let activeCustomerId: string | null = null
  let loadedCustomerId: string | null = null
  let requestId = 0

  function applyResult(result: AppointmentListDto[], id: number, customerId: string): void {
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
    if (customerChanged) items.value = []
    loading.value = true
    error.value = null
    try {
      const result = await listAppointmentsByCustomer(customerId, (fresh) =>
        applyResult(fresh, id, customerId),
      )
      applyResult(result, id, customerId)
    } catch {
      if (id !== requestId || activeCustomerId !== customerId) return
      error.value = 'Unable to load appointments'
    } finally {
      if (id === requestId && activeCustomerId === customerId) loading.value = false
    }
  }

  const stopInvalidationListener = onCacheInvalidated('/api/appointments', () => {
    if (activeCustomerId !== null) void load(activeCustomerId, true)
  })
  onScopeDispose(stopInvalidationListener)

  return { items, loading, error, load }
})
