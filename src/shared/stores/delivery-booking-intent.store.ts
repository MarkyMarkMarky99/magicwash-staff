import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Cross-feature handoff state: the order-history feature sets this right before
 * navigating to `/new-booking`, and the booking pages consume it there. It lives
 * in `shared` (not in either feature) so neither feature imports the other.
 *
 * Holds only the order id to pre-attach a `DELIVERY` appointment to. Exposes
 * `consume()` (read + clear atomically) instead of separate read/clear so no
 * caller can ever read the value without also clearing it.
 */
export const useDeliveryBookingIntentStore = defineStore('delivery-booking-intent', () => {
  const orderId = ref<string | null>(null)

  function set(next: string) {
    orderId.value = next
  }

  function consume(): string | null {
    const value = orderId.value
    orderId.value = null
    return value
  }

  return { orderId, set, consume }
})
