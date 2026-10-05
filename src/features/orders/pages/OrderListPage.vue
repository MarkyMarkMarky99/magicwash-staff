<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import { getInvoiceTarget } from '@/shared/navigation/invoice-detail-route'
import { orderEditRoute } from '@/shared/navigation/form-routes'
import OrderCard from '@/features/orders/components/OrderCard.vue'
import OrderListActionsMenu from '@/features/orders/components/OrderListActionsMenu.vue'
import { useOrderListFilterRoute } from '@/features/orders/composables/use-order-list-filter-route'
import { orderStatusLabels } from '@/features/orders/order-status-labels'
import { useCustomerStore } from '@/data/customers/customer.store'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'

const router = useRouter()
const customerStore = useCustomerStore()
const orderStore = useWorkOrderStore()
const { customers } = storeToRefs(customerStore)
const { orders, listLoading, listError } = storeToRefs(orderStore)
const { keyword, status, page, setKeyword, setStatus, setPage } = useOrderListFilterRoute()
const statusTabs = [
  { key: '', label: 'All' },
  ...Object.entries(orderStatusLabels).map(([key, label]) => ({ key, label })),
]
const customersById = computed(() => new Map(
  customers.value.map((customer) => [customer.customerId, customer]),
))
const orderRows = computed(() => orders.value.map(
  (order) => ({
    ...order,
    customerName: customersById.value.get(order.customerId)?.customerName,
    customerIndex: customersById.value.get(order.customerId)?.customerIndex,
  }),
))

watch([keyword, status, page], () => void orderStore.loadList({ keyword: keyword.value, status: status.value, page: page.value }), { immediate: true })
function openOrder(orderId: string) { router.push({ name: 'order-detail', params: { orderId } }) }
function editOrder(orderId: string) { return router.push(orderEditRoute(orderId)) }
function viewPhotos(orderId: string) { router.push('/gallery/BEF-' + orderId) }
function viewInvoice(invoiceNumber: string) {
  const target = getInvoiceTarget(invoiceNumber)
  if (target) router.push(target)
}
</script>

<template>
  <ListPageLayout>
    <template #filters><GenericTabs :tabs="statusTabs" :active-key="status" @select="setStatus($event)" /></template>
    <ListContainer title="Orders" icon="local_laundry_service" searchable :search-value="keyword" search-placeholder="Search order number or customer code" @update:search-value="setKeyword($event)" count-label="orders" :loading="listLoading" :error="listError" :empty="!listLoading && !listError && orders.length === 0" empty-text="No orders match these filters" :skeleton-rows="5">
      <template #actions><OrderListActionsMenu /></template>
      <OrderCard v-for="order in orderRows" :key="order.orderId" :order="order" :show-customer-name="true" :show-photos="true" :show-invoice="true" :on-edit="editOrder" @select="openOrder" @view-photos="viewPhotos" @view-invoice="viewInvoice" />
    </ListContainer>
  </ListPageLayout>
</template>
