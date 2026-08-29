import { defineStore } from 'pinia'
import { ref } from 'vue'
import { prototypeCustomers, prototypeOrderPhotos, prototypeOrders } from '@/features/orders/mocks/order-prototype.fixture'

const PAGE_SIZE = 5

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<typeof prototypeOrders>([])
  const pagination = ref({ page: 1, perPage: PAGE_SIZE, total: 0, totalPages: 1 })
  const listLoading = ref(false)
  const listError = ref<string | null>(null)
  const currentOrder = ref<(typeof prototypeOrders)[number] | null>(null)
  const detailLoading = ref(false)
  const detailError = ref<string | null>(null)
  const orderPhotos = ref<typeof prototypeOrderPhotos>([])
  const customers = ref(prototypeCustomers)

  async function loadList({ keyword = '', status = '', page = 1 }: { keyword?: string; status?: string; page?: number } = {}) {
    listLoading.value = true
    listError.value = null
    const search = keyword.trim().toLocaleLowerCase('th-TH')
    const matchingOrders = prototypeOrders.filter((order) => {
      const matchesKeyword = !search || [order.orderId, order.orderNumber, order.invoiceNumber, order.customerId].some((value) => value?.toLocaleLowerCase('th-TH').includes(search))
      return matchesKeyword && (!status || order.status === status)
    })
    const totalPages = Math.max(1, Math.ceil(matchingOrders.length / PAGE_SIZE))
    const resolvedPage = Math.min(Math.max(1, page), totalPages)
    const offset = (resolvedPage - 1) * PAGE_SIZE
    orders.value = matchingOrders.slice(offset, offset + PAGE_SIZE)
    pagination.value = { page: resolvedPage, perPage: PAGE_SIZE, total: matchingOrders.length, totalPages }
    listLoading.value = false
  }

  async function loadDetail(orderId: string) {
    detailLoading.value = true
    detailError.value = null
    currentOrder.value = prototypeOrders.find((order) => order.orderId === orderId) ?? null
    orderPhotos.value = prototypeOrderPhotos.filter((photo) => photo.orderId === orderId)
    detailLoading.value = false
  }

  function clearDetail() {
    currentOrder.value = null
    orderPhotos.value = []
    detailError.value = null
  }

  return { orders, pagination, listLoading, listError, currentOrder, detailLoading, detailError, orderPhotos, customers, loadList, loadDetail, clearDetail }
})
