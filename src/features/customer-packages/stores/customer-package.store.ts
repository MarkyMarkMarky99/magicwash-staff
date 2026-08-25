import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CustomerPackageFilter } from '../composables/useCustomerPackageFilterRoute'
import { getCustomerPackages } from '../services/customer-package.service'
import type { z } from 'zod'
import { customerPackageListResponseSchema } from '@contracts/customer-packages/customer-package-view-api.schema'

type CustomerPackageListItem = z.infer<typeof customerPackageListResponseSchema>

export const useCustomerPackageStore = defineStore('customer-packages', () => {
  const items = ref<CustomerPackageListItem[]>([])
  const page = ref(1)
  const perPage = ref(20)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let latestRequest = 0

  async function fetchCustomerPackages(filter: CustomerPackageFilter) {
    const requestId = ++latestRequest
    loading.value = true
    error.value = null
    try {
      const result = await getCustomerPackages(filter)
      if (requestId !== latestRequest) return
      items.value = result.items
      page.value = result.page
      perPage.value = result.perPage
    } catch {
      if (requestId !== latestRequest) return
      error.value = 'Unable to load customer packages'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  return { items, page, perPage, loading, error, fetchCustomerPackages }
})
