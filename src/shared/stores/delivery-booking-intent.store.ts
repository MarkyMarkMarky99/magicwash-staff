import { defineStore } from 'pinia'
import { ref } from 'vue'

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
