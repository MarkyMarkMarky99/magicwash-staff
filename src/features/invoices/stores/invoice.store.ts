import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getInvoices } from '../services/invoice.service'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceListItemDto } from '../types/invoices.types'

export const useInvoiceStore = defineStore('invoices', () => {
  const invoices = ref<InvoiceListItemDto[]>([])
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  const loading = ref(false)
  const error = ref<string | null>(null)
  // Prevent an older response from overwriting a newer request.
  let latestRequest = 0

  async function fetchInvoices(filter: InvoiceFilter) {
    const requestId = ++latestRequest
    loading.value = true
    error.value = null

    try {
      const result = await getInvoices(filter)
      if (requestId !== latestRequest) return
      invoices.value = result.invoices
      total.value = result.total
      page.value = result.page
      perPage.value = result.perPage
    } catch {
      if (requestId !== latestRequest) return
      error.value = 'Unable to load invoices'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  return {
    invoices,
    total,
    page,
    perPage,
    loading,
    error,
    fetchInvoices,
  }
})
