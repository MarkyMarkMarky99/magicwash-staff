import type { CustomerCreatePrefill } from '@/shared/navigation/customer-create-prefill'
import type { CustomerFormData } from '../components/CustomerForm.vue'

export function applyCustomerCreatePrefill(form: CustomerFormData, values: CustomerCreatePrefill): CustomerFormData {
  const filled = { ...form }
  for (const field of ['customerName', 'phone', 'address', 'lineId', 'facebook', 'whatsapp', 'email', 'customerType'] as const) {
    const value = values[field]
    if (filled[field] === '' && value !== undefined) filled[field] = value
  }
  return filled
}
