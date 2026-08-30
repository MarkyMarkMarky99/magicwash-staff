import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listCustomersForOrder, type CustomerLookupDto } from '@/features/orders/services/customer-lookup.service'
import { createOrderItem, type OrderItemCreatePayload } from '@/features/orders/services/order-item.service'
import { createWorkOrder, getWorkOrder, listWorkOrders, type WorkOrderCreateDto, type WorkOrderCreatePayload, type WorkOrderDetailDto, type WorkOrderListDto } from '@/features/orders/services/work-order.service'

const PAGE_SIZE = 500

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<WorkOrderListDto[]>([])
  const pagination = ref({ page: 1, perPage: PAGE_SIZE })
  const listLoading = ref(false)
  const listError = ref<string | null>(null)
  const currentOrder = ref<WorkOrderDetailDto | null>(null)
  const detailLoading = ref(false)
  const detailError = ref<string | null>(null)
  const itemSubmittingOrderId = ref<string | null>(null)
  const itemError = ref<string | null>(null)
  const itemErrorOrderId = ref<string | null>(null)
  const orderPhotos = ref([])
  const customers = ref<CustomerLookupDto[]>([])
  const customersLoading = ref(false)
  const customersError = ref<string | null>(null)
  let listRequestSequence = 0
  let detailRequestSequence = 0
  let customerRequestSequence = 0

  async function loadList({ keyword = '', status = '', page = 1 }: { keyword?: string; status?: string; page?: number } = {}) {
    const requestSequence = ++listRequestSequence
    listLoading.value = true
    listError.value = null
    try {
      const result = await listWorkOrders({ keyword, status: status || undefined, page, perPage: PAGE_SIZE })
      if (requestSequence !== listRequestSequence) return
      orders.value = result.items
      pagination.value = result.pagination
    } catch (reason) {
      if (requestSequence !== listRequestSequence) return
      orders.value = []
      listError.value = errorMessage(reason, 'Unable to load work orders')
    } finally {
      if (requestSequence === listRequestSequence) listLoading.value = false
    }
  }

  async function loadDetail(orderId: string) {
    const requestSequence = ++detailRequestSequence
    detailLoading.value = true
    detailError.value = null
    try {
      const order = await getWorkOrder(orderId)
      if (requestSequence !== detailRequestSequence) return
      currentOrder.value = order
    } catch (reason) {
      if (requestSequence !== detailRequestSequence) return
      currentOrder.value = null
      detailError.value = errorMessage(reason, 'Unable to load work order')
    } finally {
      if (requestSequence === detailRequestSequence) detailLoading.value = false
    }
  }

  async function loadCustomers() {
    const requestSequence = ++customerRequestSequence
    customersLoading.value = true
    customersError.value = null
    try {
      const result = await listCustomersForOrder()
      if (requestSequence !== customerRequestSequence) return
      customers.value = result
    } catch (reason) {
      if (requestSequence !== customerRequestSequence) return
      customers.value = []
      customersError.value = errorMessage(reason, 'Unable to load customers')
    } finally {
      if (requestSequence === customerRequestSequence) customersLoading.value = false
    }
  }

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

  function clearDetail() {
    detailRequestSequence += 1
    currentOrder.value = null
    orderPhotos.value = []
    detailLoading.value = false
    detailError.value = null
  }

  return { orders, pagination, listLoading, listError, currentOrder, detailLoading, detailError, itemSubmittingOrderId, itemError, itemErrorOrderId, orderPhotos, customers, customersLoading, customersError, loadList, loadDetail, loadCustomers, create, addItem, clearItemError, clearDetail }
})
