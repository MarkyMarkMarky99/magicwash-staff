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
  const itemSubmitting = ref(false)
  const itemError = ref<string | null>(null)
  const orderPhotos = ref([])
  const customers = ref<CustomerLookupDto[]>([])
  const customersLoading = ref(false)
  const customersError = ref<string | null>(null)

  async function loadList({ keyword = '', status = '', page = 1 }: { keyword?: string; status?: string; page?: number } = {}) {
    listLoading.value = true
    listError.value = null
    try {
      const result = await listWorkOrders({ keyword, status: status || undefined, page, perPage: PAGE_SIZE })
      orders.value = result.items
      pagination.value = result.pagination
    } catch (reason) {
      orders.value = []
      listError.value = errorMessage(reason, 'Unable to load work orders')
    } finally { listLoading.value = false }
  }

  async function loadDetail(orderId: string) {
    detailLoading.value = true
    detailError.value = null
    itemError.value = null
    try { currentOrder.value = await getWorkOrder(orderId) } catch (reason) {
      currentOrder.value = null
      detailError.value = errorMessage(reason, 'Unable to load work order')
    } finally { detailLoading.value = false }
  }

  async function loadCustomers() {
    customersLoading.value = true
    customersError.value = null
    try {
      customers.value = await listCustomersForOrder()
    } catch (reason) {
      customers.value = []
      customersError.value = errorMessage(reason, 'Unable to load customers')
    } finally { customersLoading.value = false }
  }

  function create(payload: WorkOrderCreatePayload): Promise<WorkOrderCreateDto> { return createWorkOrder(payload) }

  async function addItem(payload: OrderItemCreatePayload) {
    itemSubmitting.value = true
    itemError.value = null
    try { await createOrderItem(payload); await loadDetail(payload.orderId) } catch (reason) {
      itemError.value = errorMessage(reason, 'Unable to add order item')
      throw reason
    } finally { itemSubmitting.value = false }
  }

  function clearDetail() {
    currentOrder.value = null
    orderPhotos.value = []
    detailError.value = null
    itemError.value = null
  }

  return { orders, pagination, listLoading, listError, currentOrder, detailLoading, detailError, itemSubmitting, itemError, orderPhotos, customers, customersLoading, customersError, loadList, loadDetail, loadCustomers, create, addItem, clearDetail }
})
