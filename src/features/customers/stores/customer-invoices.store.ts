import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { z } from 'zod'
import type { invoiceListResponseSchema } from '@contracts/invoices/invoice-api.schema'
import { getInvoices } from '@/features/invoices/services/invoice.service'

type Invoice = z.infer<typeof invoiceListResponseSchema>

export const useCustomerInvoicesStore = defineStore('customer-detail-invoices', () => {
  const invoices = ref<Invoice[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let loadedCustomerId: string | null = null
  let latestRequest = 0

  async function load(customerId: string, force = false) {
    if (!force && loadedCustomerId === customerId) return
    const requestId = ++latestRequest
    loadedCustomerId = null
    invoices.value = []
    loading.value = true
    error.value = null
    try {
      const result = await getInvoices({
        keyword: '', customerId, status: null, dateFrom: null, dateTo: null,
        page: 1, perPage: 20, sortBy: 'issuedDate', sortOrder: 'desc',
      })
      if (requestId !== latestRequest) return
      invoices.value = result.invoices
      loadedCustomerId = customerId
    } catch {
      if (requestId === latestRequest) error.value = 'Unable to load customer invoices'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  return { invoices, loading, error, load }
})
