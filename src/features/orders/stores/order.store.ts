import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createOrderItem, updateOrderItem, reassignOrderItemQuantities, type OrderItemCreatePayload, type OrderItemUpdatePayload, type OrderItemQuantityReassignPayload } from '@/data/order-items/order-item.service'
import { createWorkOrder, type WorkOrderCreateDto, type WorkOrderCreatePayload } from '@/data/work-orders/work-order.service'

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

export const useOrderStore = defineStore('orders', () => {
  const itemSubmittingOrderId = ref<string | null>(null)
  const itemError = ref<string | null>(null)
  const itemErrorOrderId = ref<string | null>(null)
  function create(payload: WorkOrderCreatePayload): Promise<WorkOrderCreateDto> { return createWorkOrder(payload) }

  async function addItem(payload: OrderItemCreatePayload) {
    itemSubmittingOrderId.value = payload.orderId
    itemError.value = null
    itemErrorOrderId.value = payload.orderId
    try {
      await createOrderItem(payload)
    } catch (reason) {
      if (itemSubmittingOrderId.value === payload.orderId) {
        itemError.value = errorMessage(reason, 'Unable to add order item')
      }
      throw reason
    } finally {
      if (itemSubmittingOrderId.value === payload.orderId) itemSubmittingOrderId.value = null
    }
  }

  function clearItemError(orderId: string) {
    if (itemErrorOrderId.value !== orderId) return
    itemError.value = null
    itemErrorOrderId.value = null
  }

  function updateItem(id: string, payload: OrderItemUpdatePayload) { return updateOrderItem(id, payload) }
  function reassignQuantities(payload: OrderItemQuantityReassignPayload) { return reassignOrderItemQuantities(payload) }

  return { itemSubmittingOrderId, itemError, itemErrorOrderId, create, addItem, updateItem, reassignQuantities, clearItemError }
})
