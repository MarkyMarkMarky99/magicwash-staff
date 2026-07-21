import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { z } from 'zod'
import { customerListResponseSchema } from '@contracts/customers/customer-api.schema'

/**
 * Cross-feature handoff state: the customers feature selects a customer and the
 * booking feature consumes it. It lives in `shared` (not in either feature) so
 * neither feature imports the other; the type is derived straight from the
 * contract, so `shared` depends only on `@contracts`, never on a feature.
 *
 * Holds the customer DTO so booking can read `customerId`, `customerName`, and
 * `address` directly. Only the customers feature's CustomerCard writes this.
 */
export type SelectedCustomer = z.infer<typeof customerListResponseSchema>

export const useSelectedCustomerStore = defineStore('selected-customer', () => {
  const customer = ref<SelectedCustomer | null>(null)

  function select(next: SelectedCustomer) {
    customer.value = next
  }

  function clear() {
    customer.value = null
  }

  return { customer, select, clear }
})
