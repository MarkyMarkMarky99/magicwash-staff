import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import type { z } from 'zod'
import type { invoiceListResponseSchema } from '@contracts/invoices/invoice-api.schema'
import { getInvoices } from './invoice.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

type Invoice = z.infer<typeof invoiceListResponseSchema>

export const useCustomerInvoicesStore = defineStore('customer-detail-invoices', () => {
  const invoices = ref<Invoice[]>([])
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
    if (customerChanged) invoices.value = []
    loading.value = true
    error.value = null
    try {
      const result = await getInvoices({
        keyword: '', customerId, status: null, dateFrom: null, dateTo: null,
        page: 1, perPage: 20, sortBy: 'issuedDate', sortOrder: 'desc',
      })
      if (requestId !== latestRequest || activeCustomerId !== customerId) return
      invoices.value = result.invoices
      loadedCustomerId = customerId
    } catch {
      if (requestId === latestRequest && activeCustomerId === customerId) {
        error.value = 'Unable to load customer invoices'
      }
    } finally {
      if (requestId === latestRequest && activeCustomerId === customerId) loading.value = false
    }
  }

  const stopInvalidationListener = onCacheInvalidated('/api/invoices', () => {
    if (activeCustomerId !== null) void load(activeCustomerId, true)
  })
  onScopeDispose(stopInvalidationListener)

  return { invoices, loading, error, load }
})
