import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import {
  getWorkOrder,
  listWorkOrders,
  updateWorkOrder,
  type WorkOrderDetailDto,
  type WorkOrderListDto,
  type WorkOrderUpdatePayload,
} from './work-order.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

const PAGE_SIZE = 500

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

interface WorkOrderListFilter {
  keyword?: string
  status?: string
  page?: number
}

export const useWorkOrderStore = defineStore('work-orders', () => {
  const orders = ref<WorkOrderListDto[]>([])
  const pagination = ref({ page: 1, perPage: PAGE_SIZE })
  const listLoading = ref(false)
  const listError = ref<string | null>(null)
  const currentOrder = ref<WorkOrderDetailDto | null>(null)
  const detailLoading = ref(false)
  const detailError = ref<string | null>(null)
  let activeListFilter: WorkOrderListFilter | null = null
  let activeOrderId: string | null = null
  let listRequestSequence = 0
  let detailRequestSequence = 0

  async function loadList({ keyword = '', status = '', page = 1 }: WorkOrderListFilter = {}) {
    activeListFilter = { keyword, status, page }
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

  function seedDetail(orderId: string): WorkOrderDetailDto | null {
    const listed = orders.value.find((order) => order.orderId === orderId)
    if (!listed) return null
    return {
      ...listed,
      createdAt: null,
      createdBy: null,
      orderName: null,
      orderDescription: null,
      formImage: null,
      hangersImage: null,
      bagsImage: null,
      items: [],
    }
  }

  async function loadDetail(orderId: string) {
    activeOrderId = orderId
    const requestSequence = ++detailRequestSequence
    if (currentOrder.value?.orderId !== orderId) currentOrder.value = seedDetail(orderId)
    detailLoading.value = true
    detailError.value = null
    try {
      const order = await getWorkOrder(orderId)
      if (requestSequence !== detailRequestSequence || activeOrderId !== orderId) return
      currentOrder.value = order
    } catch (reason) {
      if (requestSequence !== detailRequestSequence || activeOrderId !== orderId) return
      currentOrder.value = null
      detailError.value = errorMessage(reason, 'Unable to load work order')
    } finally {
      if (requestSequence === detailRequestSequence && activeOrderId === orderId) {
        detailLoading.value = false
      }
    }
  }

  async function update(orderId: string, payload: WorkOrderUpdatePayload) {
    const persisted = await updateWorkOrder(orderId, payload)
    listRequestSequence += 1
    listLoading.value = false
    orders.value = orders.value.map((order) => order.orderId === orderId ? persisted : order)
      .filter((order) => !activeListFilter?.status || order.status === activeListFilter.status)
    if (currentOrder.value?.orderId === orderId) {
      detailRequestSequence += 1
      detailLoading.value = false
      currentOrder.value = { ...currentOrder.value, ...persisted }
    }
    return persisted
  }

  function clearDetail() {
    activeOrderId = null
    detailRequestSequence += 1
    currentOrder.value = null
    detailLoading.value = false
    detailError.value = null
  }

  const stopInvalidationListener = onCacheInvalidated('/api/work-orders', () => {
    if (activeListFilter !== null) void loadList(activeListFilter)
    if (activeOrderId !== null) void loadDetail(activeOrderId)
  })
  onScopeDispose(stopInvalidationListener)

  return {
    orders, pagination, listLoading, listError, currentOrder, detailLoading, detailError,
    loadList, loadDetail, clearDetail, update,
  }
})
