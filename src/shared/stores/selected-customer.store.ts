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
 * Holds a booking-ready customer snapshot. Writers may supply a list/detail
 * DTO or a legacy customer card shape; `select()` keeps this cross-feature
 * boundary in one place and falls back to the postal address only when the
 * source has no usable map location. That retains a location for the
 * Appointment create contract without inventing one when both are absent.
 */
export type SelectedCustomer = z.infer<typeof customerListResponseSchema>

export interface CustomerBookingSource {
  customerId: string
  customerIndex: string | null | undefined
  customerName: string
  phone: string | null | undefined
  address: string | null | undefined
  location: string | null | undefined
  customerType?: SelectedCustomer['customerType']
}

export const useSelectedCustomerStore = defineStore('selected-customer', () => {
  const customer = ref<SelectedCustomer | null>(null)

  function select(next: CustomerBookingSource) {
    customer.value = {
      customerId: next.customerId,
      customerIndex: next.customerIndex ?? '',
      customerName: next.customerName,
      phone: next.phone ?? null,
      address: next.address ?? null,
      location: usableValue(next.location) ? next.location : (usableValue(next.address) ? next.address : null),
      customerType: next.customerType ?? null,
    }
  }

  function clear() {
    customer.value = null
  }

  return { customer, select, clear }
})

function usableValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== ''
}
