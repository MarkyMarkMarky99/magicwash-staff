import { ref } from 'vue'
import { getCustomers, saveCustomer as apiSaveCustomer, deleteCustomer as apiDeleteCustomer } from '../api/customers.js'

export function useCustomers() {
  const customers = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  const fetchCustomers = async () => {
    isLoading.value = true
    error.value = null
    try {
      const data = await getCustomers()
      customers.value = data.customers || []
    } catch (e) {
      console.error('Error fetching customers:', e)
      error.value = 'ไม่สามารถโหลดข้อมูลได้ หรือไม่ได้เปิด Server API'
    } finally {
      isLoading.value = false
    }
  }

  const saveCustomer = async (data) => {
    isLoading.value = true
    error.value = null
    try {
      await apiSaveCustomer(data)
      await fetchCustomers() // Refresh after save
      return true
    } catch (e) {
      console.error('Error saving customer:', e)
      error.value = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const deleteCustomer = async (id) => {
    isLoading.value = true
    error.value = null
    try {
      await apiDeleteCustomer(id)
      await fetchCustomers() // Refresh after delete
      return true
    } catch (e) {
      console.error('Error deleting customer:', e)
      error.value = 'เกิดข้อผิดพลาดในการลบข้อมูล'
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    customers,
    isLoading,
    error,
    fetchCustomers,
    saveCustomer,
    deleteCustomer
  }
}
