import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getInvoices } from '../services/invoice.service'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceResponseDto } from '../types/invoices.types'

export const useInvoiceStore = defineStore('invoices', () => {
  const invoices = ref<InvoiceResponseDto[]>([])
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchInvoices(filter: InvoiceFilter) {
    loading.value = true
    error.value = null

    try {
      const result = await getInvoices(filter)
      invoices.value = result.invoices
      total.value = result.total
      page.value = result.page
      perPage.value = result.perPage
    } catch {
      error.value = 'Unable to load invoices'
    } finally {
      loading.value = false
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
