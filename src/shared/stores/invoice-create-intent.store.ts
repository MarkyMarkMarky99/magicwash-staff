import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { z } from 'zod'
import { orderListResponseSchema } from '@contracts/orders/order-api.schema'

/**
 * Holds an order for the invoice-create handoff. The complete order supports a
 * no-request fast path; route data remains the reload fallback.
 */
export type InvoiceCreateIntentOrder = z.infer<typeof orderListResponseSchema>

export const useInvoiceCreateIntentStore = defineStore('invoice-create-intent', () => {
  const order = ref<InvoiceCreateIntentOrder | null>(null)

  function set(next: InvoiceCreateIntentOrder) {
    order.value = next
  }

  return { order, set }
})
