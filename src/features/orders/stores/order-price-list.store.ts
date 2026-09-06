import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchOrderPriceList,
  type OrderPriceListItemDto,
  type OrderPriceListServiceType,
} from '@/features/orders/services/order-price-list.service'

function errorMessage(reason: unknown): string {
  return reason instanceof Error && reason.message ? reason.message : 'ไม่สามารถโหลดรายการราคาได้'
}

export const useOrderPriceListStore = defineStore('order-price-list', () => {
  const items = ref<OrderPriceListItemDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const truncated = ref(false)
  let requestId = 0

  async function reload(serviceType: OrderPriceListServiceType): Promise<void> {
    const id = ++requestId
    loading.value = true
    error.value = null
    items.value = []
    truncated.value = false

    try {
      const result = await fetchOrderPriceList(serviceType)
      if (id !== requestId) return
      items.value = result.items.filter((item) =>
        item.active === true && item.priceGroup === 'DEFAULT' && item.serviceType === serviceType,
      )
      truncated.value = result.truncated
    } catch (reason) {
      if (id !== requestId) return
      items.value = []
      error.value = errorMessage(reason)
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function reset(): void {
    requestId += 1
    items.value = []
    loading.value = false
    error.value = null
    truncated.value = false
  }

  return { items, loading, error, truncated, reload, reset }
})
