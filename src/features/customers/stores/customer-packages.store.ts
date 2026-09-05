import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { z } from 'zod'
import type {
  customerPackageListResponseSchema,
  appendPackageTransactionRequestSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import { appendPackageTransaction, getCustomerPackages } from '@/features/customer-packages/services/customer-package.service'

type CustomerPackage = z.infer<typeof customerPackageListResponseSchema>
type TransactionRequest = z.infer<typeof appendPackageTransactionRequestSchema>

export const useCustomerPackagesStore = defineStore('customer-detail-packages', () => {
  const items = ref<CustomerPackage[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const submittingUsage = ref(false)
  let loadedCustomerId: string | null = null
  let latestRequest = 0

  async function load(customerId: string, force = false) {
    if (!force && loadedCustomerId === customerId) return
    const requestId = ++latestRequest
    loadedCustomerId = null
    items.value = []
    loading.value = true
    error.value = null
    try {
      const result = await getCustomerPackages({
        keyword: '', customerId, status: null, packageCode: null,
        page: 1, perPage: 20, sortBy: 'startDate', sortOrder: 'desc',
      })
      if (requestId !== latestRequest) return
      items.value = result.items
      loadedCustomerId = customerId
    } catch {
      if (requestId === latestRequest) error.value = 'Unable to load customer packages'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  async function recordUsage(request: TransactionRequest) {
    if (submittingUsage.value) return null
    submittingUsage.value = true
    try {
      return await appendPackageTransaction(request)
    } finally {
      submittingUsage.value = false
    }
  }

  return { items, loading, error, submittingUsage, load, recordUsage }
})
