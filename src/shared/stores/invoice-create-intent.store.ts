import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { z } from 'zod'
import { orderListResponseSchema } from '@contracts/orders/order-api.schema'

/**
 * Cross-feature handoff cache: the order-history feature sets this right
 * before navigating to `/invoices/create`. It lives in `shared` so neither
 * feature imports the other — same rationale as `delivery-booking-intent.store.ts`.
 *
 * Holds the WHOLE order, not just an id, so normal navigation can pre-populate
 * line items without another request. The route still carries the customer/order
 * ids so the create page can re-fetch after a reload; this in-memory value is
 * only a fast path. The type is derived straight from the orders contract, so
 * `shared` depends only on `@contracts`, never on the `customers` feature.
 */
export type InvoiceCreateIntentOrder = z.infer<typeof orderListResponseSchema>

export const useInvoiceCreateIntentStore = defineStore('invoice-create-intent', () => {
  const order = ref<InvoiceCreateIntentOrder | null>(null)

  function set(next: InvoiceCreateIntentOrder) {
    order.value = next
  }

  return { order, set }
})
