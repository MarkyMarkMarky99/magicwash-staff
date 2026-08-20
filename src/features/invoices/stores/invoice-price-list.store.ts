import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchAllInvoicePriceListItems,
  type InvoicePriceListItemDto,
} from '../services/invoice-price-list.service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/**
 * Invoice-create picker's own price-list store. Lives in the invoices feature
 * (no cross-feature import from `src/features/price-list/`) because this
 * overlay must re-fetch every open and walk every page — the browsing page
 * caches a single page.
 */
export const useInvoicePriceListStore = defineStore('invoice-price-list', () => {
  const items = ref<InvoicePriceListItemDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const truncated = ref(false)
  let requestId = 0

  async function reload(): Promise<void> {
    const id = ++requestId
    loading.value = true
    error.value = null
    items.value = []
    truncated.value = false

    try {
      const result = await fetchAllInvoicePriceListItems()
      if (id !== requestId) return

      // Strict equality: only `active === true` rows belong in the picker.
      items.value = result.items.filter((item) => item.active === true)
      truncated.value = result.truncated
    } catch (reason) {
      if (id !== requestId) return
      error.value = errorMessage(reason, 'Unable to load price list')
      items.value = []
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  return { items, loading, error, truncated, reload }
})
