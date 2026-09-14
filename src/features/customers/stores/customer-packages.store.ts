import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { z } from 'zod'
import type { appendPackageTransactionRequestSchema } from '@contracts/customer-packages/customer-package-api.schema'
import { useCustomerPackagesByCustomerStore } from '@/data/customer-packages/customer-packages-by-customer.store'
import { appendPackageTransaction } from '@/data/package-transactions/package-transaction.service'

type TransactionRequest = z.infer<typeof appendPackageTransactionRequestSchema>

export const useCustomerPackagesStore = defineStore('customer-detail-packages', () => {
  const dataStore = useCustomerPackagesByCustomerStore()
  const { items, loading, error } = storeToRefs(dataStore)
  const submittingUsage = ref(false)

  async function recordUsage(request: TransactionRequest) {
    if (submittingUsage.value) return null
    submittingUsage.value = true
    try {
      return await appendPackageTransaction(request)
    } finally {
      submittingUsage.value = false
    }
  }

  return { items, loading, error, submittingUsage, load: dataStore.load, recordUsage }
})
