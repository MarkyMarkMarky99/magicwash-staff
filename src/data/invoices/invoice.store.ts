import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import { getInvoices } from './invoice.service'
import type { InvoiceFilter } from './invoice-filter.types'
import type { InvoiceListItemDto } from './invoices.types'
import { onCacheInvalidated } from '@/shared/api/response-cache'

export const useInvoiceStore = defineStore('invoices', () => {
  const invoices = ref<InvoiceListItemDto[]>([])
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let activeFilter: InvoiceFilter | null = null
  let latestRequest = 0

  async function fetchInvoices(filter: InvoiceFilter) {
    activeFilter = { ...filter }
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

  const stopInvalidationListener = onCacheInvalidated('/api/invoices', () => {
    if (activeFilter !== null) void fetchInvoices(activeFilter)
  })
  onScopeDispose(stopInvalidationListener)

  return { invoices, total, page, perPage, loading, error, fetchInvoices }
})
