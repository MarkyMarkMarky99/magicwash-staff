import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCustomerPackagesByCustomerStore } from '@/data/customer-packages/customer-packages-by-customer.store'
import { confirmOrderCreditUsage } from '@/data/customer-packages/order-credit-usage.service'

export const useCustomerPackagesStore = defineStore('customer-detail-packages', () => {
  const dataStore = useCustomerPackagesByCustomerStore()
  const { items, loading, error } = storeToRefs(dataStore)
  const submittingUsage = ref(false)

  async function recordUsage(customerPackageId: string, orderId: string, createdBy: string, manualCredits?: number) {
    if (submittingUsage.value) return null
    submittingUsage.value = true
    try {
      await confirmOrderCreditUsage(customerPackageId, orderId, createdBy, manualCredits)
      return true
    } finally {
      submittingUsage.value = false
    }
  }

  return { items, loading, error, submittingUsage, load: dataStore.load, recordUsage }
})
