import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { z } from 'zod'
import { orderListResponseSchema } from '@contracts/orders/order-api.schema'

/**
 * Cross-feature handoff state: the order-history feature sets this right
 * before navigating to `/invoices/create`, and the invoice-create page
 * consumes it there. It lives in `shared` (not in either feature) so neither
 * feature imports the other — same rationale as `delivery-booking-intent.store.ts`.
 *
 * Holds the WHOLE order, not just an id. Unlike the delivery-booking intent
 * (which only needs an id to attach an appointment to), invoice creation
 * pre-populates line items from `order.items[]` (description/serviceType/
 * quantity), and there is nowhere to re-fetch the order from once the
 * customer's order-history page context is left. The type is derived
 * straight from the orders contract, so `shared` depends only on
 * `@contracts`, never on the `customers` feature.
 *
 * Exposes `consume()` (read + clear atomically) instead of separate
 * read/clear so no caller can ever read the value without also clearing it.
 */
export type InvoiceCreateIntentOrder = z.infer<typeof orderListResponseSchema>

export const useInvoiceCreateIntentStore = defineStore('invoice-create-intent', () => {
  const order = ref<InvoiceCreateIntentOrder | null>(null)

  function set(next: InvoiceCreateIntentOrder) {
    order.value = next
  }

  function consume(): InvoiceCreateIntentOrder | null {
    const value = order.value
    order.value = null
    return value
  }

  return { order, set, consume }
})
